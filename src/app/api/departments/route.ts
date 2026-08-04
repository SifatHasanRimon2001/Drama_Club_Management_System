import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";
import { departmentSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { ZodError } from "zod";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth("department.view");
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const committeeId = url.searchParams.get("committeeId");
    const current = url.searchParams.get("current") === "true";

    const where: Record<string, unknown> = {};
    if (committeeId) where.committeeId = committeeId;
    if (current) {
      where.committee = { isCurrent: true };
    }

    const departments = await prisma.department.findMany({
      where,
      include: {
        committee: { select: { id: true, year: true, isCurrent: true } },
        coordinator: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        _count: {
          select: { members: true, events: true, tasks: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(departments);
  } catch (error) {
    console.error("[Departments GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth("department.manage");
    if (auth.error) return auth.error;

    const body = await request.json();
    const data = departmentSchema.parse(body);

    // Validate committee exists
    const committee = await prisma.committee.findUnique({ where: { id: data.committeeId } });
    if (!committee) {
      return NextResponse.json(
        { error: "Committee not found" },
        { status: 404 }
      );
    }

    // Validate coordinator exists if provided
    if (data.coordinatorId) {
      const coordinator = await prisma.member.findUnique({ where: { id: data.coordinatorId } });
      if (!coordinator) {
        return NextResponse.json(
          { error: "Coordinator not found" },
          { status: 404 }
        );
      }
    }

    const department = await prisma.department.create({
      data: {
        name: data.name,
        description: data.description,
        committeeId: data.committeeId,
        coordinatorId: data.coordinatorId,
      },
      include: {
        committee: { select: { id: true, year: true } },
      },
    });

    await logAudit({
      actorId: auth.userId,
      action: "department.created",
      entityType: "Department",
      entityId: department.id,
      metadata: { name: department.name, committeeId: data.committeeId },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Departments POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
