import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateEnumParam } from "@/lib/api-helpers";

const VALID_ALBUM_CATEGORIES = [
  "PRODUCTIONS",
  "WORKSHOPS",
  "BEHIND_THE_SCENES",
  "FESTIVALS",
  "REHEARSALS",
  "CLUB_LIFE",
] as const;

export async function GET(request: NextRequest) {
  try {
    const categoryResult = validateEnumParam(request, "category", VALID_ALBUM_CATEGORIES);
    if (categoryResult.error) return categoryResult.error;

    const url = new URL(request.url);
    const departmentId = url.searchParams.get("departmentId");

    const where: Record<string, unknown> = {};
    if (categoryResult.value) where.category = categoryResult.value;
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
