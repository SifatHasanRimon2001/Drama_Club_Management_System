import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, validateEnumParam } from "@/lib/api-helpers";
import { taskSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { ZodError } from "zod";

const VALID_TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("department.view");
    if (auth.error) return auth.error;

    const { id: departmentId } = await params;

    // Validate department exists
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    const statusResult = validateEnumParam(request, "status", VALID_TASK_STATUSES);
    if (statusResult.error) return statusResult.error;

    const url = new URL(request.url);
    const assigneeId = url.searchParams.get("assigneeId");

    const where: Record<string, unknown> = { departmentId };
    if (statusResult.value) where.status = statusResult.value;
    if (assigneeId) where.assigneeId = assigneeId;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("[Tasks GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("department.manage");
    if (auth.error) return auth.error;

    const { id: departmentId } = await params;
    const body = await request.json();
    const data = taskSchema.parse(body);

    // Validate department exists
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    // Validate assignee exists if provided
    if (data.assigneeId) {
      const assignee = await prisma.member.findUnique({ where: { id: data.assigneeId } });
      if (!assignee) {
        return NextResponse.json(
          { error: "Assignee not found" },
          { status: 404 }
        );
      }
    }

    const task = await prisma.task.create({
      data: {
        departmentId,
        title: data.title,
        description: data.description,
        assigneeId: data.assigneeId,
        status: data.status || "TODO",
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
      action: "task.created",
      entityType: "Task",
      entityId: task.id,
      metadata: { departmentId, title: task.title },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Tasks POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
