import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { applicantSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";
import { ZodError, z } from "zod";
import { logAudit } from "@/lib/audit";

// Rate limiter: 3 applications per IP per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3;
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour
let lastCleanup = Date.now();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  if (now - lastCleanup > 5 * 60 * 1000) {
    lastCleanup = now;
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.resetAt) rateLimitMap.delete(key);
    }
  }
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  return true;
}

/**
 * Build a dynamic Zod schema from the registration window's formSchema.
 * PRD §5: "validates against formSchema via Zod built dynamically"
 */
function buildDynamicSchema(formSchema: Record<string, unknown>): z.ZodObject<z.ZodRawShape> {
  const fields = (formSchema as { fields?: Array<{ name: string; type: string; required?: boolean; label?: string; options?: string[] }> }).fields || [];
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    let fieldSchema: z.ZodTypeAny;

    switch (field.type) {
      case "textarea":
      case "text":
        fieldSchema = z.string();
        break;
      case "select":
        // Validate against allowed options if provided
        if (field.options && field.options.length > 0) {
          fieldSchema = z.enum(field.options as [string, ...string[]]);
        } else {
          fieldSchema = z.string();
        }
        break;
      case "checkbox":
        fieldSchema = z.boolean().optional();
        break;
      case "number":
        fieldSchema = z.coerce.number();
        break;
      default:
        fieldSchema = z.string();
    }

    if (field.required && !(fieldSchema instanceof z.ZodBoolean)) {
      // Only apply .min() for string schemas; number schemas use .min() with different semantics
      if (fieldSchema instanceof z.ZodString) {
        fieldSchema = fieldSchema.min(1, `${field.label || field.name} is required`);
      }
      // For ZodNumber with required, just ensure it's not optional (it's already required by default)
    } else if (!field.required) {
      fieldSchema = fieldSchema.optional();
    }

    shape[field.name] = fieldSchema;
  }

  return z.object(shape);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const { id } = await params;

    // Check window exists and is LIVE
    const window = await prisma.registrationWindow.findUnique({
      where: { id },
    });

    if (!window) {
      return NextResponse.json(
        { error: "Registration window not found" },
        { status: 404 }
      );
    }

    if (window.status !== "LIVE") {
      return NextResponse.json(
        { error: "Registration is not currently open" },
        { status: 400 }
      );
    }

    const now = new Date();
    if (now < window.startDate || now > window.endDate) {
      return NextResponse.json(
        { error: "Registration is not within the allowed period" },
        { status: 400 }
      );
    }

    const body = await request.json();

    // First validate base applicant fields
    const data = applicantSchema.parse(body);

    // PRD §5: Dynamically validate custom fields against formSchema
    const formSchema = window.formSchema as Record<string, unknown>;
    if (formSchema && typeof formSchema === "object" && "fields" in formSchema) {
      const dynamicSchema = buildDynamicSchema(formSchema);
      // Validate custom responses if present
      if (data.customResponses && typeof data.customResponses === "object") {
        try {
          dynamicSchema.parse(data.customResponses);
        } catch (dynamicError) {
          if (dynamicError instanceof ZodError) {
            return NextResponse.json(
              { error: `Custom field validation: ${dynamicError.message}` },
              { status: 400 }
            );
          }
          throw dynamicError;
        }
      }
    }

    // Check for duplicate email in this window
    const existing = await prisma.applicant.findFirst({
      where: {
        registrationWindowId: id,
        email: data.email,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "You have already applied to this window" },
        { status: 409 }
      );
    }

    const applicant = await prisma.applicant.create({
      data: {
        registrationWindowId: id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        studentId: data.studentId,
        departmentPrefs: data.departmentPrefs,
        skills: data.skills || [],
        actingExperience: data.actingExperience,
        portfolioUrl: data.portfolioUrl,
        customResponses: (data.customResponses || undefined) as Prisma.InputJsonValue | undefined,
        status: "SUBMITTED",
      },
    });

    // PRD §8: Audit log on application submission
    try {
      await logAudit({
        actorId: "public",
        action: "applicant.submitted",
        entityType: "Applicant",
        entityId: applicant.id,
        metadata: { registrationWindowId: id, email: data.email },
      });
    } catch (auditError) {
      console.error("[Registration Apply POST] Failed to audit:", auditError);
    }

    return NextResponse.json(
      { message: "Application submitted successfully", id: applicant.id },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Registration Apply POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
