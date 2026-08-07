import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const update = await prisma.clubUpdate.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    if (!update || !update.publishedAt) {
      return NextResponse.json({ error: "Update not found" }, { status: 404 });
    }

    return NextResponse.json(update);
  } catch (error) {
    console.error("[Public Update GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
