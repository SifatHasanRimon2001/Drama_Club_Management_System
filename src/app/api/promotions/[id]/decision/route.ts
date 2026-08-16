import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, parseJsonBody } from "@/lib/api-helpers";
import { promotionDecisionSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { PUBLIC_MEMBER_SELECT } from "@/lib/member-select";
import { ZodError } from "zod";

/**
 * Raised inside the decision transaction when another request already moved
 * the promotion out of a reviewable state. Rolls the transaction back and is
 * translated into a 409 by the handler.
 */
class PromotionAlreadyDecidedError extends Error {
  constructor() {
    super("Promotion has already been decided");
    this.name = "PromotionAlreadyDecidedError";
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("promotion.approve");
    if (auth.error) return auth.error;

    const { id } = await params;
    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
    const data = promotionDecisionSchema.parse(body);

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

    if (promotion.status !== "SUBMITTED" && promotion.status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        { error: "Promotion is not in a reviewable state" },
        { status: 400 }
      );
    }

    // Prevent self-approval
    if (promotion.member.userId === auth.userId) {
      return NextResponse.json(
        { error: "You cannot approve your own promotion request" },
        { status: 403 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Re-assert the reviewable state as part of the write itself. The check
      // above ran outside the transaction, so two concurrent approvals (a
      // double-clicked button, a retried request) could both pass it and each
      // record a decision — producing duplicate audit entries and duplicate
      // "promotion approved" notifications for the member. Matching on the
      // status here means only the first writer updates a row; the loser sees
      // count 0 and is rejected as a conflict.
      const claimed = await tx.promotionRequest.updateMany({
        where: {
          id,
          status: { in: ["SUBMITTED", "PENDING_APPROVAL"] },
        },
        data: {
          status: data.status,
          reviewedById: auth.userId,
          reviewedAt: new Date(),
        },
      });

      if (claimed.count === 0) {
        throw new PromotionAlreadyDecidedError();
      }

      const updated = await tx.promotionRequest.findUniqueOrThrow({
        where: { id },
        include: {
          member: { select: PUBLIC_MEMBER_SELECT },
          currentRole: { select: { id: true, name: true } },
          proposedRole: { select: { id: true, name: true } },
          submittedBy: { select: { id: true, name: true } },
          reviewedBy: { select: { id: true, name: true } },
        },
      });

      // PRD §4: On APPROVED: create new CommitteeMemberRole, do NOT delete old one
      // "do not mutate history — the old row stays as a record of the prior role"
      if (data.status === "APPROVED") {
        const currentCommittee = await tx.committee.findFirst({
          where: { isCurrent: true },
        });

        if (!currentCommittee) {
          throw new Error("No current committee found. Cannot assign new role without an active committee.");
        }

        // Soft-end the old role (set endedAt) instead of deleting
        const oldRole = await tx.committeeMemberRole.findFirst({
          where: {
            committeeId: currentCommittee.id,
            memberId: promotion.memberId,
            roleId: promotion.currentRoleId,
            endedAt: null,
          },
        });

        if (oldRole) {
          await tx.committeeMemberRole.update({
            where: { id: oldRole.id },
            data: { endedAt: new Date() },
          });
        }

        // Check if member already has the proposed role (active)
        const existingNewRole = await tx.committeeMemberRole.findFirst({
          where: {
            committeeId: currentCommittee.id,
            memberId: promotion.memberId,
            roleId: promotion.proposedRoleId,
            endedAt: null,
          },
        });

        if (!existingNewRole) {
          await tx.committeeMemberRole.create({
            data: {
              committeeId: currentCommittee.id,
              memberId: promotion.memberId,
              roleId: promotion.proposedRoleId,
            },
          });
        }
      }

      return updated;
    });

    // Audit log OUTSIDE transaction — logging failure should not roll back business logic
    await logAudit({
      actorId: auth.userId,
      action: `promotion.${data.status.toLowerCase()}`,
      entityType: "PromotionRequest",
      entityId: id,
      metadata: {
        memberId: promotion.memberId,
        memberName: promotion.member.user.name,
        status: data.status,
      },
    });

    // PRD §3c: Promotion approved/rejected → PROMOTION in-app to subject member
    try {
      await createNotification({
        userId: promotion.member.userId,
        type: "PROMOTION",
        title: `Promotion ${data.status.toLowerCase()}`,
        message: `Your promotion request has been ${data.status.toLowerCase()}.`,
        payload: { promotionId: id, status: data.status },
        link: `/dashboard/promotions`,
      });
    } catch (notifError) {
      console.error("[Promotion Decision] Failed to send notification:", notifError);
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // Lost the race against a concurrent decision on the same request.
    if (error instanceof PromotionAlreadyDecidedError) {
      return NextResponse.json(
        { error: "This promotion has already been decided" },
        { status: 409 }
      );
    }
    console.error("[Promotion Decision POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
