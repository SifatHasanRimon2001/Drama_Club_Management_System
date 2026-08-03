import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getPaginationParams } from "@/lib/api-helpers";
import { committeeSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { ZodError } from "zod";
import { can } from "@/lib/permissions";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const sessionData = await auth();
    const userId = (sessionData?.user as { id?: string })?.id;
    const isAdmin = userId ? await can(userId, "committee.manage") : false;

    const url = new URL(request.url);
    const all = url.searchParams.get("all") === "true";

    // Public: only return current committee. Admin: can request all.
    if (all && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const where = all ? {} : { isCurrent: true };

    const committees = await prisma.committee.findMany({
      where,
      include: {
        memberRoles: {
          include: {
            member: {
              include: {
                user: { select: { id: true, name: true, image: true, ...(userId ? { email: true } : {}) } },
              },
            },
            role: true,
          },
        },
        departments: true,
      },
      orderBy: { startDate: "desc" },
    });

    return NextResponse.json(committees);
  } catch (error) {
    console.error("[Committees GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth("committee.manage");
    if (auth.error) return auth.error;

    const body = await request.json();
    const data = committeeSchema.parse(body);

    // If creating a new current committee, archive the previous one
    if (data.isCurrent !== false) {
      const committee = await prisma.$transaction(async (tx) => {
        await tx.committee.updateMany({
          where: { isCurrent: true },
          data: { isCurrent: false, endDate: new Date() },
        });

        return tx.committee.create({
          data: {
            year: data.year,
            startDate: new Date(data.startDate),
            endDate: data.endDate ? new Date(data.endDate) : undefined,
            isCurrent: data.isCurrent !== false,
          },
        });
      });

      await logAudit({
        actorId: auth.userId,
        action: "committee.created",
        entityType: "Committee",
        entityId: committee.id,
        metadata: { year: committee.year, isCurrent: committee.isCurrent },
      });

      return NextResponse.json(committee, { status: 201 });
    }

    const committee = await prisma.committee.create({
      data: {
        year: data.year,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        isCurrent: data.isCurrent !== false,
      },
    });

    await logAudit({
      actorId: auth.userId,
      action: "committee.created",
      entityType: "Committee",
      entityId: committee.id,
      metadata: { year: committee.year, isCurrent: committee.isCurrent },
    });

    return NextResponse.json(committee, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Committees POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
