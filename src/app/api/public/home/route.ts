import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const [committee, departments, recentUpdates, upcomingEvents] =
      await Promise.all([
        prisma.committee.findFirst({
          where: { isCurrent: true },
          include: {
            memberRoles: {
              include: {
                member: {
                  include: {
                    user: { select: { id: true, name: true, image: true } },
                  },
                },
                role: true,
              },
            },
          },
        }),
        prisma.department.findMany({
          where: { committee: { isCurrent: true } },
          include: {
            coordinator: {
              include: {
                user: { select: { id: true, name: true } },
              },
            },
            _count: { select: { members: true } },
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

    // Strip emails from committee member roles for public response
    const safeCommittee = committee
      ? {
          ...committee,
          memberRoles: committee.memberRoles.map((mr) => ({
            ...mr,
            member: {
              ...mr.member,
              user: {
                id: mr.member.user.id,
                name: mr.member.user.name,
                image: mr.member.user.image,
              },
            },
          })),
        }
      : null;

    return NextResponse.json({
      committee: safeCommittee,
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
