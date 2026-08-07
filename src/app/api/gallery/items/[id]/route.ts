import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { deleteR2Object } from "@/lib/r2";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("gallery.manage");
    if (auth.error) return auth.error;

    const { id } = await params;

    const existing = await prisma.galleryItem.findUnique({
      where: { id },
      include: { album: { select: { id: true, name: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Best-effort cleanup of the underlying R2 object; the DB row is removed
    // regardless so the gallery UI never shows stale entries.
    try {
      await deleteR2Object(existing.r2Key);
    } catch (r2Error) {
      console.error("[Gallery Item DELETE] Failed to delete R2 object:", r2Error);
    }

    await prisma.galleryItem.delete({ where: { id } });

    await logAudit({
      actorId: auth.userId,
      action: "gallery.item_deleted",
      entityType: "GalleryItem",
      entityId: id,
      metadata: { albumId: existing.albumId, fileName: existing.fileName },
    });

    return NextResponse.json({ message: "Item deleted" });
  } catch (error) {
    console.error("[Gallery Item DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
