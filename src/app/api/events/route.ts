import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getPaginationParams, requireAuth, validateEnumParam, parseJsonBody } from "@/lib/api-helpers";
import { eventSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { notifyDepartmentMembers, notifyAllActiveMembers } from "@/lib/notifications";
import { ZodError } from "zod";

const VALID_EVENT_TYPES = [
  "WORKSHOP",
  "REHEARSAL",
  "PERFORMANCE",
  "AUDITION",
  "FESTIVAL",
  "TRAINING",
] as const;

export async function GET(request: NextRequest) {
  try {
    const { page, limit, skip } = getPaginationParams(request);
    const url = new URL(request.url);

    const typeResult = validateEnumParam(request, "type", VALID_EVENT_TYPES);
    if (typeResult.error) return typeResult.error;

    const departmentId = url.searchParams.get("departmentId");
    const upcoming = url.searchParams.get("upcoming") === "true";

    // Filter out DRAFT events for public read (PRD §5: public read published)
    const where: Record<string, unknown> = {
      status: { not: "DRAFT" },
    };
    if (typeResult.value) where.type = typeResult.value;
    if (departmentId) where.departmentId = departmentId;
    if (upcoming) where.startAt = { gte: new Date() };

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: {
          department: { select: { id: true, name: true } },
        },
        orderBy: { startAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.event.count({ where }),
    ]);

    return NextResponse.json({
      events,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[Events GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth("events.manage");
    if (auth.error) return auth.error;

    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
    const data = eventSchema.parse(body);

    // Validate endAt > startAt if endAt provided
    if (data.endAt && new Date(data.endAt) <= new Date(data.startAt)) {
      return NextResponse.json(
        { error: "endAt must be after startAt" },
        { status: 400 }
      );
    }

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

    const event = await prisma.event.create({
      data: {
        title: data.title,
        type: data.type,
        departmentId: data.departmentId,
        status: "UPCOMING",
        startAt: new Date(data.startAt),
        endAt: data.endAt ? new Date(data.endAt) : undefined,
        location: data.location,
        description: data.description,
      },
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    // PRD §3c: New Event → EVENT in-app to department members (all members if dept is null)
    try {
      if (data.departmentId) {
        await notifyDepartmentMembers({
          departmentId: data.departmentId,
          type: "EVENT",
          title: `New Event: ${event.title}`,
          message: `A new ${event.type.toLowerCase()} has been scheduled for ${event.startAt?.toLocaleDateString() ?? "TBD"}.`,
          payload: { eventId: event.id },
          link: `/events/${event.id}`,
        });
      } else {
        await notifyAllActiveMembers({
          type: "EVENT",
          title: `New Event: ${event.title}`,
          message: `A new ${event.type.toLowerCase()} has been scheduled for ${event.startAt?.toLocaleDateString() ?? "TBD"}.`,
          payload: { eventId: event.id },
          link: `/events/${event.id}`,
        });
      }
    } catch (notifError) {
      console.error("[Event POST] Failed to notify:", notifError);
    }

    await logAudit({
      actorId: auth.userId,
      action: "event.created",
      entityType: "Event",
      entityId: event.id,
      metadata: { title: event.title, type: event.type },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Events POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
