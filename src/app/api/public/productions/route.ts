import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20") || 20, 1), 100);

    const events = await prisma.event.findMany({
      where: { type: "PERFORMANCE", status: { not: "DRAFT" } },
      include: {
        department: { select: { id: true, name: true } },
      },
      orderBy: { startAt: "desc" },
      take: limit,
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("[Public Productions GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
