import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getPaginationParams } from "@/lib/api-helpers";
import { galleryItemSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { notifyDepartmentMembers } from "@/lib/notifications";
import { ZodError } from "zod";

export async function GET(request: NextRequest) {
  try {
    const { page, limit, skip } = getPaginationParams(request);
    const url = new URL(request.url);
    const albumId = url.searchParams.get("albumId");

    const where: Record<string, unknown> = {};
    if (albumId) where.albumId = albumId;

    const [items, total] = await Promise.all([
      prisma.galleryItem.findMany({
        where,
        include: {
          album: {
            select: { id: true, name: true, category: true, departmentId: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.galleryItem.count({ where }),
    ]);

    return NextResponse.json({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[Gallery Items GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth("gallery.upload");
    if (auth.error) return auth.error;

    const body = await request.json();
    const data = galleryItemSchema.parse(body);

    // Validate album exists
    const album = await prisma.galleryAlbum.findUnique({ where: { id: data.albumId } });
    if (!album) {
      return NextResponse.json(
        { error: "Album not found" },
        { status: 404 }
      );
    }

    const item = await prisma.galleryItem.create({
      data: {
        albumId: data.albumId,
        r2Key: data.r2Key,
        fileName: data.fileName,
        type: data.type,
        caption: data.caption,
        uploadedById: auth.userId,
      },
      include: {
        album: true,
      },
    });

    // Notify department members if album has a department, exclude the uploader
    if (item.album.departmentId) {
      await notifyDepartmentMembers({
        departmentId: item.album.departmentId,
        type: "GALLERY",
        title: `New media uploaded`,
        message: `A new ${item.type.toLowerCase()} has been added to ${item.album.name}.`,
        payload: { itemId: item.id, albumId: item.albumId },
        excludeUserId: auth.userId,
      });
    }

    await logAudit({
      actorId: auth.userId,
      action: "gallery.item_uploaded",
      entityType: "GalleryItem",
      entityId: item.id,
      metadata: {
        albumId: data.albumId,
        fileName: data.fileName,
        type: data.type,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Gallery Items POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
