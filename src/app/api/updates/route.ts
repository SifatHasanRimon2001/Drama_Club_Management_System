import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getPaginationParams, requireAuth, validateEnumParam, parseJsonBody } from "@/lib/api-helpers";
import { clubUpdateSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { notifyAllActiveMembers } from "@/lib/notifications";
import { sanitizeRichText } from "@/lib/sanitize";
import { ZodError } from "zod";

const VALID_UPDATE_CATEGORIES = [
  "ANNOUNCEMENT",
  "NOTICE",
  "ACHIEVEMENT",
  "PRODUCTION",
  "RECRUITMENT",
  "EVENT",
] as const;

export async function GET(request: NextRequest) {
  try {
    const { page, limit, skip } = getPaginationParams(request);

    const categoryResult = validateEnumParam(request, "category", VALID_UPDATE_CATEGORIES);
    if (categoryResult.error) return categoryResult.error;

    // PRD §5: public read for published updates only
    const where: Record<string, unknown> = {
      publishedAt: { not: null },
    };
    if (categoryResult.value) where.category = categoryResult.value;

    const [updates, total] = await Promise.all([
      prisma.clubUpdate.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip,
        take: limit,
        include: {
          author: { select: { id: true, name: true } },
        },
      }),
      prisma.clubUpdate.count({ where }),
    ]);

    return NextResponse.json({
      updates,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[Updates GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth("updates.publish");
    if (auth.error) return auth.error;

    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
    const data = clubUpdateSchema.parse(body);

    const update = await prisma.clubUpdate.create({
      data: {
        title: data.title,
        bodyRichText: sanitizeRichText(data.bodyRichText),
        category: data.category,
        mediaUrls: data.mediaUrls || [],
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : new Date(),
        authorId: auth.userId,
      },
    });

    // PRD §3c: New ClubUpdate published → ANNOUNCEMENT in-app to all active members
    if (update.publishedAt) {
      await notifyAllActiveMembers({
        type: "ANNOUNCEMENT",
        title: `New ${update.category.toLowerCase()}: ${update.title}`,
        message: update.title,
        payload: { updateId: update.id },
        link: `/updates/${update.id}`,
      });
    }

    await logAudit({
      actorId: auth.userId,
      action: "update.created",
      entityType: "ClubUpdate",
      entityId: update.id,
      metadata: { title: update.title, category: update.category },
    });

    return NextResponse.json(update, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Updates POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
