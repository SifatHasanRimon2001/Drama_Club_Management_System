import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";
import { taskSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { ZodError } from "zod";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const auth = await requireAuth("department.manage");
    if (auth.error) return auth.error;

    const { taskId } = await params;
    const body = await request.json();
    const data = taskSchema.partial().parse(body);

    const existing = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existing) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
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
        assignee: {
          include: { user: { select: { id: true, name: true } } },
        },
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

    const { taskId } = await params;

    const existing = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existing) {
      return NextResponse.json(
        { error: "Task not found" },
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
