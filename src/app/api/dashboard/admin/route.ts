import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";

export async function GET() {
  try {
    const auth = await requireAuth("permissions.manage");
    if (auth.error) return auth.error;

    const now = new Date();

    const [
      totalMembers,
      membersByStatus,
      registrationStats,
      pendingPromotionsList,
      pendingPromotionsCount,
      upcomingEvents,
      recentGalleryItems,
    ] = await Promise.all([
      prisma.member.count(),
      prisma.member.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.registrationWindow.findMany({
        include: {
          _count: { select: { applicants: true } },
          applicants: {
            where: { status: { in: ["ACCEPTED", "CONVERTED"] } },
            select: { id: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      // PRD §12: pending promotions LIST with member info
      prisma.promotionRequest.findMany({
        where: { status: { in: ["SUBMITTED", "PENDING_APPROVAL"] } },
        include: {
          member: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.promotionRequest.count({
        where: { status: { in: ["SUBMITTED", "PENDING_APPROVAL"] } },
      }),
      prisma.event.findMany({
        where: { startAt: { gte: now }, status: { not: "DRAFT" } },
        include: { department: { select: { id: true, name: true } } },
        orderBy: { startAt: "asc" },
        take: 5,
      }),
      prisma.galleryItem.findMany({
        include: {
          album: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    const statusBreakdown: Record<string, number> = {};
    for (const s of membersByStatus) {
      statusBreakdown[s.status] = s._count.id;
    }

    // PRD §12: registration statistics with conversion rate
    const registrationSummary = registrationStats.map((w) => ({
      id: w.id,
      title: w.title,
      status: w.status,
      applicantCount: w._count.applicants,
      conversionCount: w.applicants.length,
      conversionRate: w._count.applicants > 0
        ? Math.round((w.applicants.length / w._count.applicants) * 100)
        : 0,
    }));

    return NextResponse.json({
      members: {
        total: totalMembers,
        byStatus: statusBreakdown,
      },
      registrations: registrationSummary,
      pendingPromotions: {
        count: pendingPromotionsCount,
        list: pendingPromotionsList,
      },
      upcomingEvents,
      recentGalleryItems,
    });
  } catch (error) {
    console.error("[Dashboard Admin GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
