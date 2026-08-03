import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { createNotification } from "@/lib/notifications";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("promotion.submit");
    if (auth.error) return auth.error;

    const { id } = await params;
    const promotion = await prisma.promotionRequest.findUnique({
      where: { id },
      include: {
        member: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!promotion) {
      return NextResponse.json(
        { error: "Promotion request not found" },
        { status: 404 }
      );
    }

    // Ownership check: user must be the member being promoted, the member's sponsor (submittedById), or have approve permission
    const isMember = promotion.member.userId === auth.userId;
    const isSponsor = promotion.submittedById === auth.userId;
    const isApprover = await can(auth.userId, "promotion.approve");
    if (!isMember && !isSponsor && !isApprover) {
      return NextResponse.json(
        { error: "You can only submit your own or your sponsored promotion requests" },
        { status: 403 }
      );
    }

    if (promotion.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft promotions can be submitted" },
        { status: 400 }
      );
    }

    const updated = await prisma.promotionRequest.update({
      where: { id },
      data: { status: "SUBMITTED" },
    });

    // Notify all users with promotion.approve permission
    try {
      const approverRolePermissions = await prisma.rolePermission.findMany({
        where: {
          permission: { key: "promotion.approve" },
        },
        include: {
          role: {
            include: {
              committeeMemberRoles: {
                where: { committee: { isCurrent: true } },
                include: {
                  member: { select: { userId: true } },
                },
              },
            },
          },
        },
      });

      const approverUserIds = new Set<string>();
      for (const rp of approverRolePermissions) {
        for (const cmr of rp.role.committeeMemberRoles) {
          approverUserIds.add(cmr.member.userId);
        }
      }

      for (const userId of approverUserIds) {
        await createNotification({
          userId,
          type: "PROMOTION",
          title: "New Promotion Request",
          message: `${promotion.member.user.name} has submitted a promotion request for review.`,
          payload: { promotionId: id },
          link: `/promotions/${id}`,
        });
      }
    } catch (notifError) {
      console.error("[Promotion Submit] Failed to notify approvers:", notifError);
    }

    await logAudit({
      actorId: auth.userId,
      action: "promotion.submitted",
      entityType: "PromotionRequest",
      entityId: id,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[Promotion Submit POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
