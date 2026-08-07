import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getPaginationParams, requireAuth } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth("permissions.manage");
    if (auth.error) return auth.error;

    const { page, limit, skip } = getPaginationParams(request);
    const action = request.nextUrl.searchParams.get("action")?.trim() || undefined;
    const entityType = request.nextUrl.searchParams.get("entityType")?.trim() || undefined;
    const actorId = request.nextUrl.searchParams.get("actorId")?.trim() || undefined;

    const where: Record<string, unknown> = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (actorId) where.actorId = actorId;

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const actorIds = [...new Set(entries.map((e) => e.actorId).filter(Boolean))];
    const actors = actorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true },
        })
      : [];
    const actorMap = new Map(actors.map((a) => [a.id, a.name]));

    const [actions, entityTypes] = await Promise.all([
      prisma.auditLog.groupBy({
        by: ["action"],
        _count: { _all: true },
        orderBy: { _count: { action: "desc" } },
      }),
      prisma.auditLog.groupBy({
        by: ["entityType"],
        _count: { _all: true },
        orderBy: { _count: { entityType: "desc" } },
      }),
    ]);

    return NextResponse.json({
      entries: entries.map((e) => ({
        ...e,
        actorName:
          e.actorId === "public"
            ? "Public"
            : actorMap.get(e.actorId) || "Unknown",
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      filters: {
        actions: actions.map((a) => a.action),
        entityTypes: entityTypes.map((e) => e.entityType),
      },
    });
  } catch (error) {
    console.error("[AuditLog GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
