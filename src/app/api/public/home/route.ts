import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PUBLIC_MEMBER_SELECT } from "@/lib/member-select";

export async function GET() {
  try {
    const [committee, departments, recentUpdates, upcomingEvents] =
      await Promise.all([
        prisma.committee.findFirst({
          where: { isCurrent: true },
          include: {
            memberRoles: {
              include: {
                // Narrowed at the query level so no personal field is ever
                // loaded, rather than fetched and stripped afterwards.
                member: { select: PUBLIC_MEMBER_SELECT },
                role: true,
              },
            },
          },
        }),
        prisma.department.findMany({
          where: { committee: { isCurrent: true } },
          include: {
            coordinator: { select: PUBLIC_MEMBER_SELECT },
            _count: { select: { members: true, events: true } },
          },
        }),
        prisma.clubUpdate.findMany({
          where: { publishedAt: { not: null } },
          orderBy: { publishedAt: "desc" },
          take: 5,
        }),
        prisma.event.findMany({
          where: { startAt: { gte: new Date() }, status: { not: "DRAFT" } },
          orderBy: { startAt: "asc" },
          take: 5,
          include: { department: { select: { id: true, name: true } } },
        }),
      ]);

    return NextResponse.json({
      committee,
      departments,
      recentUpdates,
      upcomingEvents,
    });
  } catch (error) {
    console.error("[Public Home GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
