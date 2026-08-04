import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateEnumParam } from "@/lib/api-helpers";

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
    const categoryResult = validateEnumParam(request, "category", VALID_UPDATE_CATEGORIES);
    if (categoryResult.error) return categoryResult.error;

    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20") || 20));

    const where: Record<string, unknown> = {
      publishedAt: { not: null },
    };
    if (categoryResult.value) where.category = categoryResult.value;

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
