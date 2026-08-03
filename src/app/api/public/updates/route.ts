import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20") || 20));

    const where: Record<string, unknown> = {
      publishedAt: { not: null },
    };
    if (category) where.category = category;

    const updates = await prisma.clubUpdate.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: limit,
    });

    return NextResponse.json(updates);
  } catch (error) {
    console.error("[Public Updates GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
