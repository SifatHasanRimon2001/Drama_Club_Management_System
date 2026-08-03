import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";
import { eventSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { notifyDepartmentMembers, notifyAllActiveMembers } from "@/lib/notifications";
import { ZodError } from "zod";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.status === "DRAFT") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error("[Event GET]", error);
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
    const auth = await requireAuth("events.manage");
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const data = eventSchema.partial().parse(body);

    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // Validate endAt > startAt if both provided
    const startAt = data.startAt ? new Date(data.startAt) : existing.startAt;
    const endAt = data.endAt ? new Date(data.endAt) : existing.endAt;
    if (endAt && endAt <= startAt) {
      return NextResponse.json(
        { error: "endAt must be after startAt" },
        { status: 400 }
      );
    }

    // Validate department exists if provided and changed
    if (data.departmentId && data.departmentId !== existing.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: data.departmentId } });
      if (!dept) {
        return NextResponse.json(
          { error: "Department not found" },
          { status: 404 }
        );
      }
    }

    const event = await prisma.event.update({
      where: { id },
      data: {
        title: data.title,
        type: data.type,
        departmentId: data.departmentId,
        startAt: data.startAt ? new Date(data.startAt) : undefined,
        endAt: data.endAt ? new Date(data.endAt) : undefined,
        location: data.location,
        description: data.description,
      },
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    // Notify department members on update (PRD §3c: null dept = all members)
    const deptId = data.departmentId !== undefined ? data.departmentId : existing.departmentId;
    if (deptId) {
      try {
        await notifyDepartmentMembers({
          departmentId: deptId,
          type: "EVENT",
          title: `Event Updated: ${event.title}`,
          message: `The event "${event.title}" has been updated.`,
          payload: { eventId: event.id },
          link: `/events/${event.id}`,
          excludeUserId: auth.userId,
        });
      } catch (notifError) {
        console.error("[Event PATCH] Failed to notify:", notifError);
      }
    } else {
      try {
        await notifyAllActiveMembers({
          type: "EVENT",
          title: `Event Updated: ${event.title}`,
          message: `The event "${event.title}" has been updated.`,
          payload: { eventId: event.id },
          link: `/events/${event.id}`,
          excludeUserId: auth.userId,
        });
      } catch (notifError) {
        console.error("[Event PATCH] Failed to notify:", notifError);
      }
    }

    await logAudit({
      actorId: auth.userId,
      action: "event.updated",
      entityType: "Event",
      entityId: id,
      metadata: { changes: data },
    });

    return NextResponse.json(event);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Event PATCH]", error);
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
    const auth = await requireAuth("events.manage");
    if (auth.error) return auth.error;

    const { id } = await params;

    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    await prisma.event.delete({ where: { id } });

    // Notify department members on deletion (PRD §3c: null dept = all members)
    if (existing.departmentId) {
      try {
        await notifyDepartmentMembers({
          departmentId: existing.departmentId,
          type: "EVENT",
          title: `Event Cancelled: ${existing.title}`,
          message: `The event "${existing.title}" has been cancelled.`,
          payload: { eventId: id },
          excludeUserId: auth.userId,
        });
      } catch (notifError) {
        console.error("[Event DELETE] Failed to notify:", notifError);
      }
    } else {
      try {
        await notifyAllActiveMembers({
          type: "EVENT",
          title: `Event Cancelled: ${existing.title}`,
          message: `The event "${existing.title}" has been cancelled.`,
          payload: { eventId: id },
          excludeUserId: auth.userId,
        });
      } catch (notifError) {
        console.error("[Event DELETE] Failed to notify:", notifError);
      }
    }

    await logAudit({
      actorId: auth.userId,
      action: "event.deleted",
      entityType: "Event",
      entityId: id,
    });

    return NextResponse.json({ message: "Event deleted" });
  } catch (error) {
    console.error("[Event DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
