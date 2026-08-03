import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const album = await prisma.galleryAlbum.findUnique({
      where: { id },
      include: {
        items: {
          select: {
            id: true,
            r2Key: true,
            fileName: true,
            type: true,
            caption: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        },
        department: { select: { id: true, name: true } },
      },
    });

    if (!album) {
      return NextResponse.json(
        { error: "Album not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(album);
  } catch (error) {
    console.error("[Public Gallery Album GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
