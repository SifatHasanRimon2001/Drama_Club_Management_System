import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { applicantSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";
import { ZodError, z } from "zod";
import { logAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/api-helpers";
import { clientIpKey, RateLimiter } from "@/lib/rate-limit";
import { buildDynamicSchema } from "@/lib/registration-form";

// Rate limiter: 3 applications per IP per hour
const applyRateLimiter = new RateLimiter(3, 60 * 60 * 1000);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = clientIpKey(request);
    if (!applyRateLimiter.allow(ip)) {
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

    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;

    // First validate base applicant fields
    const data = applicantSchema.parse(body);

    // Normalize email so duplicates are detected case-insensitively and
    // converted member accounts get the same lowercase email as register.
    const email = data.email.toLowerCase().trim();

    // Validate department preferences exist
    if (data.departmentPrefs.length > 0) {
      const validDepts = await prisma.department.findMany({
        where: { id: { in: data.departmentPrefs } },
        select: { id: true },
      });
      const validIds = new Set(validDepts.map((d) => d.id));
      const invalidPrefs = data.departmentPrefs.filter((id) => !validIds.has(id));
      if (invalidPrefs.length > 0) {
        return NextResponse.json(
          { error: `Invalid department preferences: ${invalidPrefs.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // PRD §5: Dynamically validate custom fields against formSchema.
    // The schema is ALWAYS applied (even when customResponses is omitted) so
    // required fields declared by the window cannot be bypassed by omitting
    // the whole customResponses object.
    const formSchema = window.formSchema as Record<string, unknown>;
    if (formSchema && typeof formSchema === "object" && "fields" in formSchema) {
      let dynamicSchema: z.ZodObject<z.ZodRawShape>;
      try {
        dynamicSchema = buildDynamicSchema(formSchema);
      } catch (schemaError) {
        if (schemaError instanceof Error) {
          return NextResponse.json(
            { error: schemaError.message },
            { status: 400 }
          );
        }
        throw schemaError;
      }
      try {
        dynamicSchema.parse(data.customResponses ?? {});
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

    // Check for duplicate email in this window
    const existing = await prisma.applicant.findFirst({
      where: {
        registrationWindowId: id,
        email,
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
        email,
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
        metadata: { registrationWindowId: id, email },
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
    // TOCTOU-safe duplicate handling: the pre-insert findFirst check may miss
    // a concurrent duplicate, in which case the DB unique constraint fires.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "You have already applied to this window" },
        { status: 409 }
      );
    }
    console.error("[Registration Apply POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
