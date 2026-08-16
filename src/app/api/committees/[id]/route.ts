import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getSession, parseJsonBody } from "@/lib/api-helpers";
import { committeeSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { INTERNAL_MEMBER_SELECT, PUBLIC_MEMBER_SELECT } from "@/lib/member-select";
import { ZodError } from "zod";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    const isAuthenticated = !!session?.user;

    const committee = await prisma.committee.findUnique({
      where: { id },
      include: {
        memberRoles: {
          include: {
            // Audience-scoped, mirroring /api/committees: anonymous callers
            // get identity only, never personal contact fields.
            member: {
              select: isAuthenticated ? INTERNAL_MEMBER_SELECT : PUBLIC_MEMBER_SELECT,
            },
            role: true,
          },
        },
        departments: true,
      },
    });

    if (!committee) {
      return NextResponse.json(
        { error: "Committee not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(committee);
  } catch (error) {
    console.error("[Committee GET]", error);
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
    const auth = await requireAuth("committee.manage");
    if (auth.error) return auth.error;

    const { id } = await params;
    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
    const data = committeeSchema.partial().parse(body);

    const existing = await prisma.committee.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Committee not found" },
        { status: 404 }
      );
    }

    // If setting isCurrent to true, archive all other current committees
    if (data.isCurrent === true) {
      const committee = await prisma.$transaction(async (tx) => {
        await tx.committee.updateMany({
          where: { isCurrent: true, id: { not: id } },
          data: { isCurrent: false, endDate: new Date() },
        });

        return tx.committee.update({
          where: { id },
          data: {
            year: data.year,
            startDate: data.startDate ? new Date(data.startDate) : undefined,
            endDate: data.endDate ? new Date(data.endDate) : undefined,
            isCurrent: data.isCurrent,
          },
        });
      });

      await logAudit({
        actorId: auth.userId,
        action: "committee.updated",
        entityType: "Committee",
        entityId: id,
        metadata: { changes: data },
      });

      return NextResponse.json(committee);
    }

    const committee = await prisma.committee.update({
      where: { id },
      data: {
        year: data.year,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        isCurrent: data.isCurrent,
      },
    });

    await logAudit({
      actorId: auth.userId,
      action: "committee.updated",
      entityType: "Committee",
      entityId: id,
      metadata: { changes: data },
    });

    return NextResponse.json(committee);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Committee PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
