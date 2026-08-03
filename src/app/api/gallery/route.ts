import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";
import { galleryAlbumSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { ZodError } from "zod";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const departmentId = url.searchParams.get("departmentId");

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (departmentId) where.departmentId = departmentId;

    const albums = await prisma.galleryAlbum.findMany({
      where,
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(albums);
  } catch (error) {
    console.error("[Gallery Albums GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth("gallery.manage");
    if (auth.error) return auth.error;

    const body = await request.json();
    const data = galleryAlbumSchema.parse(body);

    // Validate department exists if provided
    if (data.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: data.departmentId } });
      if (!dept) {
        return NextResponse.json(
          { error: "Department not found" },
          { status: 404 }
        );
      }
    }

    const album = await prisma.galleryAlbum.create({
      data: {
        name: data.name,
        category: data.category,
        departmentId: data.departmentId,
      },
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    await logAudit({
      actorId: auth.userId,
      action: "gallery.album_created",
      entityType: "GalleryAlbum",
      entityId: album.id,
      metadata: { name: album.name, category: album.category },
    });

    return NextResponse.json(album, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Gallery Albums POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
