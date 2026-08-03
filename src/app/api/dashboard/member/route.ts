import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      include: {
        memberProfile: {
          include: {
            departments: {
              include: { department: true },
            },
            committeeRoles: {
              where: { committee: { isCurrent: true } },
              include: {
                role: true,
                committee: { select: { id: true, year: true } },
              },
            },
          },
        },
      },
    });

    if (!user?.memberProfile) {
      return NextResponse.json({
        user: { id: user?.id, name: user?.name, email: user?.email },
        member: null,
        departments: [],
        upcomingEvents: [],
        recentNotifications: [],
      });
    }

    const member = user.memberProfile;
    const departmentIds = member.departments.map((d) => d.departmentId);

    const [upcomingEvents, recentNotifications] = await Promise.all([
      prisma.event.findMany({
        where: {
          OR: [
            { departmentId: { in: departmentIds } },
            { departmentId: null },
          ],
          startAt: { gte: new Date() },
          status: { not: "DRAFT" },
        },
        orderBy: { startAt: "asc" },
        take: 5,
        include: { department: { select: { id: true, name: true } } },
      }),
      prisma.notification.findMany({
        where: { userId: auth.userId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, image: user.image },
      member: {
        id: member.id,
        memberCode: member.memberCode,
        phone: member.phone,
        photoUrl: member.photoUrl,
        status: member.status,
        joiningDate: member.joiningDate,
        currentRole: member.committeeRoles[0]?.role || null,
        committee: member.committeeRoles[0]?.committee || null,
      },
      departments: member.departments.map((d) => d.department),
      upcomingEvents,
      recentNotifications,
    });
  } catch (error) {
    console.error("[Dashboard Member GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
