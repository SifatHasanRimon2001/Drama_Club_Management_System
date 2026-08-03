import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";
import { departmentUpdateSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { ZodError } from "zod";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("department.view");
    if (auth.error) return auth.error;

    const { id } = await params;
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        committee: true,
        coordinator: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        members: {
          include: {
            member: {
              include: {
                user: { select: { id: true, name: true, email: true, image: true } },
                committeeRoles: {
                  where: { committee: { isCurrent: true } },
                  include: { role: true },
                },
              },
            },
          },
        },
        events: {
          orderBy: { startAt: "desc" },
          take: 10,
        },
        tasks: {
          orderBy: { createdAt: "desc" },
          include: {
            assignee: {
              include: {
                user: { select: { id: true, name: true } },
              },
            },
          },
        },
        _count: {
          select: { members: true, events: true, tasks: true },
        },
      },
    });

    if (!department) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(department);
  } catch (error) {
    console.error("[Department GET]", error);
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
    const auth = await requireAuth("department.manage");
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const data = departmentUpdateSchema.parse(body);

    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Department not found" },
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

    const department = await prisma.department.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        coordinatorId: data.coordinatorId,
      },
    });

    await logAudit({
      actorId: auth.userId,
      action: "department.updated",
      entityType: "Department",
      entityId: id,
      metadata: { changes: data },
    });

    return NextResponse.json(department);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Department PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
