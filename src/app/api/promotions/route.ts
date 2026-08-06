import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getPaginationParams, validateEnumParam, parseJsonBody } from "@/lib/api-helpers";
import { promotionRequestSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { ZodError } from "zod";

const VALID_PROMOTION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
] as const;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    // PRD §5: promotions GET requires either promotion.submit OR promotion.approve
    const canSubmit = await can(auth.userId, "promotion.submit");
    const canApprove = await can(auth.userId, "promotion.approve");
    if (!canSubmit && !canApprove) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { page, limit, skip } = getPaginationParams(request);

    const statusResult = validateEnumParam(request, "status", VALID_PROMOTION_STATUSES);
    if (statusResult.error) return statusResult.error;

    const url = new URL(request.url);
    const memberId = url.searchParams.get("memberId");

    const where: Record<string, unknown> = {};
    if (statusResult.value) where.status = statusResult.value;
    if (memberId) where.memberId = memberId;

    const [promotions, total] = await Promise.all([
      prisma.promotionRequest.findMany({
        where,
        include: {
          member: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.promotionRequest.count({ where }),
    ]);

    return NextResponse.json({
      promotions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[Promotions GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth("promotion.submit");
    if (auth.error) return auth.error;

    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
    const data = promotionRequestSchema.parse(body);

    // Validate member exists
    const member = await prisma.member.findUnique({ where: { id: data.memberId } });
    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Validate roles exist
    const currentRole = await prisma.role.findUnique({ where: { id: data.currentRoleId } });
    if (!currentRole) {
      return NextResponse.json(
        { error: "Current role not found" },
        { status: 404 }
      );
    }

    const proposedRole = await prisma.role.findUnique({ where: { id: data.proposedRoleId } });
    if (!proposedRole) {
      return NextResponse.json(
        { error: "Proposed role not found" },
        { status: 404 }
      );
    }

    if (data.currentRoleId === data.proposedRoleId) {
      return NextResponse.json(
        { error: "Proposed role must be different from the current role" },
        { status: 400 }
      );
    }

    // PRD §8: the subject member must actually hold the current role for the
    // promotion premise to be valid (active assignment, never ended).
    const currentAssignment = await prisma.committeeMemberRole.findFirst({
      where: {
        memberId: data.memberId,
        roleId: data.currentRoleId,
        endedAt: null,
      },
      select: { id: true },
    });
    if (!currentAssignment) {
      return NextResponse.json(
        { error: "Member does not currently hold the specified current role" },
        { status: 400 }
      );
    }

    const promotion = await prisma.promotionRequest.create({
      data: {
        memberId: data.memberId,
        currentRoleId: data.currentRoleId,
        proposedRoleId: data.proposedRoleId,
        reason: data.reason,
        achievements: data.achievements,
        documentUrls: data.documentUrls || [],
        status: "DRAFT",
        submittedById: auth.userId,
      },
      include: {
        member: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    await logAudit({
      actorId: auth.userId,
      action: "promotion.created",
      entityType: "PromotionRequest",
      entityId: promotion.id,
      metadata: { memberId: data.memberId },
    });

    return NextResponse.json(promotion, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Promotions POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
