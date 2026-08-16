import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";
import { can } from "@/lib/permissions";
import { INTERNAL_MEMBER_SELECT } from "@/lib/member-select";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    // PRD §5: promotions GET requires either promotion.submit OR promotion.approve
    const canSubmit = await can(auth.userId, "promotion.submit");
    const canApprove = await can(auth.userId, "promotion.approve");
    if (!canSubmit && !canApprove) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const promotion = await prisma.promotionRequest.findUnique({
      where: { id },
      include: {
        member: { select: INTERNAL_MEMBER_SELECT },
        currentRole: { select: { id: true, name: true } },
        proposedRole: { select: { id: true, name: true } },
        submittedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });

    if (!promotion) {
      return NextResponse.json(
        { error: "Promotion request not found" },
        { status: 404 }
      );
    }

    // Mirrors the list route: without `promotion.approve` a member may only
    // read their own request. 404 (not 403) so the endpoint does not confirm
    // that some other member's promotion exists.
    if (!canApprove) {
      const self = await prisma.member.findUnique({
        where: { userId: auth.userId },
        select: { id: true },
      });
      if (!self || promotion.memberId !== self.id) {
        return NextResponse.json(
          { error: "Promotion request not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(promotion);
  } catch (error) {
    console.error("[Promotion GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
