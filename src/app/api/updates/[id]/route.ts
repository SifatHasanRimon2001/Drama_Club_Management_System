import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, parseJsonBody } from "@/lib/api-helpers";
import { clubUpdateSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { notifyAllActiveMembers } from "@/lib/notifications";
import { sanitizeRichText } from "@/lib/sanitize";
import { ZodError } from "zod";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const update = await prisma.clubUpdate.findUnique({
      where: { id },
    });

    if (!update) {
      return NextResponse.json(
        { error: "Update not found" },
        { status: 404 }
      );
    }

    if (!update.publishedAt) {
      return NextResponse.json(
        { error: "Update not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(update);
  } catch (error) {
    console.error("[Update GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("updates.publish");
    if (auth.error) return auth.error;

    const { id } = await params;
    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
    const data = clubUpdateSchema.partial().parse(body);

    const existing = await prisma.clubUpdate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Update not found" },
        { status: 404 }
      );
    }

    const update = await prisma.clubUpdate.update({
      where: { id },
      data: {
        title: data.title,
        bodyRichText: data.bodyRichText ? sanitizeRichText(data.bodyRichText) : undefined,
        category: data.category,
        mediaUrls: data.mediaUrls,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : undefined,
      },
    });

    // Notify members on update modification
    if (update.publishedAt) {
      try {
        await notifyAllActiveMembers({
          type: "ANNOUNCEMENT",
          title: `Update Modified: ${update.title}`,
          message: `A club update "${update.title}" has been modified.`,
          payload: { updateId: update.id },
          link: `/updates/${update.id}`,
          excludeUserId: auth.userId,
        });
      } catch (notifError) {
        console.error("[Update PATCH] Failed to notify:", notifError);
      }
    }

    await logAudit({
      actorId: auth.userId,
      action: "update.updated",
      entityType: "ClubUpdate",
      entityId: id,
      metadata: { changes: data },
    });

    return NextResponse.json(update);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Update PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("updates.publish");
    if (auth.error) return auth.error;

    const { id } = await params;

    const existing = await prisma.clubUpdate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Update not found" },
        { status: 404 }
      );
    }

    await prisma.clubUpdate.delete({ where: { id } });

    // Notify members on deletion
    if (existing.publishedAt) {
      try {
        await notifyAllActiveMembers({
          type: "ANNOUNCEMENT",
          title: `Update Removed: ${existing.title}`,
          message: `A club update "${existing.title}" has been removed.`,
          payload: { updateId: id },
          excludeUserId: auth.userId,
        });
      } catch (notifError) {
        console.error("[Update DELETE] Failed to notify:", notifError);
      }
    }

    await logAudit({
      actorId: auth.userId,
      action: "update.deleted",
      entityType: "ClubUpdate",
      entityId: id,
    });

    return NextResponse.json({ message: "Update deleted" });
  } catch (error) {
    console.error("[Update DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
