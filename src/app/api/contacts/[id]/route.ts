import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, parseJsonBody } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("settings.manage");
    if (auth.error) return auth.error;

    const { id } = await params;
    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;

    const handled = Boolean((parsed.body as { handled?: unknown } | null)?.handled);
    const existing = await prisma.contactSubmission.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const submission = await prisma.contactSubmission.update({
      where: { id },
      data: { handledAt: handled ? new Date() : null },
    });

    await logAudit({
      actorId: auth.userId,
      action: handled ? "contact.handled" : "contact.reopened",
      entityType: "ContactSubmission",
      entityId: id,
      metadata: { email: existing.email },
    });

    return NextResponse.json(submission);
  } catch (error) {
    console.error("[Contact PATCH]", error);
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
    const auth = await requireAuth("settings.manage");
    if (auth.error) return auth.error;

    const { id } = await params;
    const existing = await prisma.contactSubmission.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    await prisma.contactSubmission.delete({ where: { id } });

    await logAudit({
      actorId: auth.userId,
      action: "contact.deleted",
      entityType: "ContactSubmission",
      entityId: id,
      metadata: { email: existing.email },
    });

    return NextResponse.json({ message: "Message deleted" });
  } catch (error) {
    console.error("[Contact DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
