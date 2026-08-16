import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, parseJsonBody } from "@/lib/api-helpers";
import { taskSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { PUBLIC_MEMBER_SELECT } from "@/lib/member-select";
import { ZodError } from "zod";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const auth = await requireAuth("department.manage");
    if (auth.error) return auth.error;

    const { id: departmentId, taskId } = await params;
    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
    const data = taskSchema.partial().parse(body);

    const existing = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existing) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    if (existing.departmentId !== departmentId) {
      return NextResponse.json(
        { error: "Task does not belong to this department" },
        { status: 404 }
      );
    }

    // Mirrors the create path: without this, an unknown assignee reaches the
    // database and the foreign-key violation surfaces as a 500 instead of a
    // useful 404. `null` is a legitimate value here — it unassigns the task.
    if (data.assigneeId) {
      const assignee = await prisma.member.findUnique({
        where: { id: data.assigneeId },
        select: { id: true },
      });
      if (!assignee) {
        return NextResponse.json(
          { error: "Assignee not found" },
          { status: 404 }
        );
      }
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        title: data.title,
        description: data.description,
        assigneeId: data.assigneeId,
        status: data.status,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
      include: {
        assignee: { select: PUBLIC_MEMBER_SELECT },
      },
    });

    await logAudit({
      actorId: auth.userId,
      action: "task.updated",
      entityType: "Task",
      entityId: taskId,
      metadata: { changes: data },
    });

    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Task PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const auth = await requireAuth("department.manage");
    if (auth.error) return auth.error;

    const { id: departmentId, taskId } = await params;

    const existing = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existing) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    if (existing.departmentId !== departmentId) {
      return NextResponse.json(
        { error: "Task does not belong to this department" },
        { status: 404 }
      );
    }

    await prisma.task.delete({ where: { id: taskId } });

    await logAudit({
      actorId: auth.userId,
      action: "task.deleted",
      entityType: "Task",
      entityId: taskId,
    });

    return NextResponse.json({ message: "Task deleted" });
  } catch (error) {
    console.error("[Task DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
