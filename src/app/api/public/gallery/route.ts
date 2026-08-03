import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const departmentId = url.searchParams.get("departmentId");

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (departmentId) where.departmentId = departmentId;

    const albums = await prisma.galleryAlbum.findMany({
      where,
      include: {
        items: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        department: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(albums);
  } catch (error) {
    console.error("[Public Gallery GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
