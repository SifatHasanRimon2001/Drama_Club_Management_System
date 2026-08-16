import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, validateEnumParam, parseJsonBody } from "@/lib/api-helpers";
import { can } from "@/lib/permissions";
import { taskSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { PUBLIC_MEMBER_SELECT } from "@/lib/member-select";
import { ZodError } from "zod";

const VALID_TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
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

    // Spec §5: tasks GET requires department.manage, or being a member/coordinator of the department
    const hasManage = await can(auth.userId, "department.manage");
    if (!hasManage) {
      const member = await prisma.member.findUnique({
        where: { userId: auth.userId },
        select: { id: true },
      });
      const isDepartmentMember = member
        ? await prisma.memberDepartment.findUnique({
            where: {
              memberId_departmentId: {
                memberId: member.id,
                departmentId,
              },
            },
          })
        : null;
      const isCoordinator = !!member && department.coordinatorId === member.id;
      if (!isDepartmentMember && !isCoordinator) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        );
      }
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
        assignee: { select: PUBLIC_MEMBER_SELECT },
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
    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
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
        assignee: { select: PUBLIC_MEMBER_SELECT },
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
