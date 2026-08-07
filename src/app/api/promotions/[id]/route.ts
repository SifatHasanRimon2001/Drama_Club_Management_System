import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";
import { can } from "@/lib/permissions";

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
        member: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
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

    return NextResponse.json(promotion);
  } catch (error) {
    console.error("[Promotion GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
