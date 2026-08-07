import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20") || 20));
    const upcoming = url.searchParams.get("upcoming") !== "false";
    const type = url.searchParams.get("type");

    const where: Record<string, unknown> = { status: { not: "DRAFT" } };
    if (upcoming) where.startAt = { gte: new Date() };
    if (type) where.type = type;

    const events = await prisma.event.findMany({
      where,
      include: {
        department: { select: { id: true, name: true } },
      },
      orderBy: { startAt: "asc" },
      take: limit,
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("[Public Events GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
