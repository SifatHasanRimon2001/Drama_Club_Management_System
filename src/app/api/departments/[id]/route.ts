import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, parseJsonBody } from "@/lib/api-helpers";
import { departmentUpdateSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { INTERNAL_MEMBER_SELECT, PUBLIC_MEMBER_SELECT } from "@/lib/member-select";
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
        // Directory-level projections: `department.view` is held by ordinary
        // members, who have no business reading a colleague's home address.
        coordinator: { select: INTERNAL_MEMBER_SELECT },
        members: {
          include: {
            member: {
              select: {
                ...INTERNAL_MEMBER_SELECT,
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
            assignee: { select: PUBLIC_MEMBER_SELECT },
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
    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
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

    // Validate committee exists if provided
    if (data.committeeId) {
      const committee = await prisma.committee.findUnique({ where: { id: data.committeeId } });
      if (!committee) {
        return NextResponse.json(
          { error: "Committee not found" },
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
        committeeId: data.committeeId,
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("department.manage");
    if (auth.error) return auth.error;

    const { id } = await params;

    const existing = await prisma.department.findUnique({
      where: { id },
      include: {
        _count: { select: { events: true, tasks: true, members: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    // Tasks and member links cascade; events and albums keep history with
    // department set to null. Only block deletion while real data is attached
    // so archives are not silently destroyed.
    if (existing._count.events > 0 || existing._count.tasks > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete a department with events or tasks. Archive it instead, or reassign its events and delete its tasks first.",
        },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.memberDepartment.deleteMany({ where: { departmentId: id } });
      await tx.department.delete({ where: { id } });
    });

    await logAudit({
      actorId: auth.userId,
      action: "department.deleted",
      entityType: "Department",
      entityId: id,
      metadata: { name: existing.name },
    });

    return NextResponse.json({ message: "Department deleted" });
  } catch (error) {
    console.error("[Department DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
