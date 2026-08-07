import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, parseJsonBody } from "@/lib/api-helpers";
import { galleryAlbumSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { ZodError } from "zod";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("gallery.manage");
    if (auth.error) return auth.error;

    const { id } = await params;
    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const data = galleryAlbumSchema.partial().parse(parsed.body);

    const existing = await prisma.galleryAlbum.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    if (data.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: data.departmentId } });
      if (!dept) {
        return NextResponse.json({ error: "Department not found" }, { status: 404 });
      }
    }

    const album = await prisma.galleryAlbum.update({
      where: { id },
      data: {
        name: data.name,
        category: data.category,
        departmentId: data.departmentId,
      },
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    });

    await logAudit({
      actorId: auth.userId,
      action: "gallery.album_updated",
      entityType: "GalleryAlbum",
      entityId: id,
      metadata: { changes: data },
    });

    return NextResponse.json(album);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Gallery Album PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("gallery.manage");
    if (auth.error) return auth.error;

    const { id } = await params;

    const existing = await prisma.galleryAlbum.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    // Items cascade on album delete (schema onDelete: Cascade).
    await prisma.galleryAlbum.delete({ where: { id } });

    await logAudit({
      actorId: auth.userId,
      action: "gallery.album_deleted",
      entityType: "GalleryAlbum",
      entityId: id,
      metadata: { name: existing.name, itemCount: existing._count.items },
    });

    return NextResponse.json({ message: "Album deleted" });
  } catch (error) {
    console.error("[Gallery Album DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
