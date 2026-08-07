import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getPaginationParams, validateEnumParam, parseJsonBody } from "@/lib/api-helpers";
import { can } from "@/lib/permissions";
import { registrationWindowSchema, registrationFormSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

const VALID_REGISTRATION_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "LIVE",
  "CLOSED",
] as const;

export async function GET(request: NextRequest) {
  try {
    // Reviewers (registration.review) need the window list to filter/appraise
    // applicants; managers (registration.manage) get full access.
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const canManage = await can(auth.userId, "registration.manage");
    const canReview = await can(auth.userId, "registration.review");
    if (!canManage && !canReview) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { page, limit, skip } = getPaginationParams(request);

    const statusResult = validateEnumParam(request, "status", VALID_REGISTRATION_STATUSES);
    if (statusResult.error) return statusResult.error;

    const where: Record<string, unknown> = {};
    if (statusResult.value) where.status = statusResult.value;

    const [windows, total] = await Promise.all([
      prisma.registrationWindow.findMany({
        where,
        include: { _count: { select: { applicants: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.registrationWindow.count({ where }),
    ]);

    return NextResponse.json({
      windows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[RegistrationWindows GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth("registration.manage");
    if (auth.error) return auth.error;

    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
    const data = registrationWindowSchema.parse(body);

    // Validate endDate > startDate
    if (new Date(data.endDate) <= new Date(data.startDate)) {
      return NextResponse.json(
        { error: "endDate must be after startDate" },
        { status: 400 }
      );
    }

    // Validate the custom form definition before persisting it
    if (data.formSchema) {
      const formResult = registrationFormSchema.safeParse(data.formSchema);
      if (!formResult.success) {
        return NextResponse.json(
          { error: formResult.error.issues[0]?.message ?? "Invalid formSchema" },
          { status: 400 }
        );
      }
    }

    const window = await prisma.registrationWindow.create({
      data: {
        title: data.title,
        description: data.description,
        bannerUrl: data.bannerUrl,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: data.status || "DRAFT",
        formSchema: (data.formSchema || {}) as Prisma.InputJsonValue,
      },
    });

    await logAudit({
      actorId: auth.userId,
      action: "registration_window.created",
      entityType: "RegistrationWindow",
      entityId: window.id,
      metadata: { title: window.title, status: window.status },
    });

    return NextResponse.json(window, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[RegistrationWindows POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
