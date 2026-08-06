import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, parseJsonBody } from "@/lib/api-helpers";
import { registrationWindowSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { ALLOWED_STATUS_TRANSITIONS, allowedTransitionsFor } from "@/lib/registration-window-transitions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if requester is authenticated
    const sessionData = await auth();
    const userId = (sessionData?.user as { id?: string })?.id;
    const isAdmin = userId ? await can(userId, "registration.manage") : false;

    const window = await prisma.registrationWindow.findUnique({
      where: { id },
      include: { _count: { select: { applicants: true } } },
    });

    if (!window) {
      return NextResponse.json(
        { error: "Registration window not found" },
        { status: 404 }
      );
    }

    // Non-admin can only see LIVE windows
    if (!isAdmin && window.status !== "LIVE") {
      return NextResponse.json(
        { error: "Registration window not found" },
        { status: 404 }
      );
    }

    // Non-admin: strip internal fields
    if (!isAdmin) {
      const { applicants: _applicants, ...safeWindow } = window as typeof window & { applicants?: unknown };
      void _applicants;
      return NextResponse.json(safeWindow);
    }

    return NextResponse.json(window);
  } catch (error) {
    console.error("[RegistrationWindow GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth("registration.manage");
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
    const data = registrationWindowSchema.partial().parse(body);

    const existing = await prisma.registrationWindow.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Registration window not found" },
        { status: 404 }
      );
    }

    // Validate endDate > startDate if both provided
    const startDate = data.startDate ? new Date(data.startDate) : existing.startDate;
    const endDate = data.endDate ? new Date(data.endDate) : existing.endDate;
    if (endDate <= startDate) {
      return NextResponse.json(
        { error: "endDate must be after startDate" },
        { status: 400 }
      );
    }

    // Enforce the registration window state machine
    if (data.status && data.status !== existing.status) {
      const allowed = allowedTransitionsFor(existing.status);
      if (!allowed.includes(data.status)) {
        return NextResponse.json(
          {
            error: `Invalid status transition: ${existing.status} -> ${data.status}. Allowed transitions: ${Object.entries(ALLOWED_STATUS_TRANSITIONS)
              .flatMap(([from, tos]) => tos.map((to) => `${from}->${to}`))
              .join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    const window = await prisma.registrationWindow.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        bannerUrl: data.bannerUrl,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        status: data.status,
        formSchema: data.formSchema as Prisma.InputJsonValue | undefined,
      },
    });

    await logAudit({
      actorId: authResult.userId,
      action: "registration_window.updated",
      entityType: "RegistrationWindow",
      entityId: id,
      metadata: { changes: data },
    });

    return NextResponse.json(window);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[RegistrationWindow PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
