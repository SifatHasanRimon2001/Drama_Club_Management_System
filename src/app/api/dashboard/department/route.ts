import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const departmentId = url.searchParams.get("departmentId");

    if (!departmentId) {
      return NextResponse.json(
        { error: "departmentId query param is required" },
        { status: 400 }
      );
    }

    // Verify user has access to this department
    const member = await prisma.member.findUnique({
      where: { userId: auth.userId },
      include: {
        departments: { where: { departmentId } },
        coordinatedDepts: { where: { id: departmentId } },
      },
    });

    if (!member || (member.departments.length === 0 && member.coordinatedDepts.length === 0)) {
      return NextResponse.json(
        { error: "You do not have access to this department" },
        { status: 403 }
      );
    }

    const now = new Date();

    const [
      department,
      departmentMembers,
      memberCount,
      events,
      tasks,
      taskCounts,
      recruitmentStats,
    ] = await Promise.all([
      prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true, name: true },
      }),
      // PRD §12: department member list
      prisma.memberDepartment.findMany({
        where: { departmentId },
        include: {
          member: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
        },
      }),
      prisma.memberDepartment.count({ where: { departmentId } }),
      prisma.event.findMany({
        where: { departmentId, startAt: { gte: now }, status: { not: "DRAFT" } },
        orderBy: { startAt: "asc" },
        take: 10,
      }),
      prisma.task.findMany({
        where: { departmentId },
        include: {
          assignee: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.task.groupBy({
        by: ["status"],
        where: { departmentId },
        _count: { id: true },
      }),
      prisma.applicant.findMany({
        where: {
          departmentPrefs: { has: departmentId },
        },
        select: { id: true, status: true, name: true },
      }),
    ]);

    const taskStatusCounts: Record<string, number> = {};
    for (const t of taskCounts) {
      taskStatusCounts[t.status] = t._count.id;
    }

    const recruitmentByStatus: Record<string, number> = {};
    for (const a of recruitmentStats) {
      recruitmentByStatus[a.status] = (recruitmentByStatus[a.status] || 0) + 1;
    }

    return NextResponse.json({
      department,
      members: departmentMembers.map((md) => ({
        id: md.member.id,
        memberCode: md.member.memberCode,
        name: md.member.user.name,
        email: md.member.user.email,
        image: md.member.user.image,
        status: md.member.status,
      })),
      memberCount,
      events,
      tasks,
      taskCounts: taskStatusCounts,
      recruitment: {
        total: recruitmentStats.length,
        byStatus: recruitmentByStatus,
      },
    });
  } catch (error) {
    console.error("[Dashboard Department GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
