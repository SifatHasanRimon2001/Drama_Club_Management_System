import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, parseJsonBody } from "@/lib/api-helpers";
import { memberUpdateSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { ZodError } from "zod";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("member.view");
    if (auth.error) return auth.error;

    const { id } = await params;
    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        departments: {
          include: { department: true },
        },
        committeeRoles: {
          include: {
            role: true,
            committee: true,
          },
          orderBy: { committee: { startDate: "desc" } },
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json(member);
  } catch (error) {
    console.error("[Member GET]", error);
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
    const auth = await requireAuth("member.edit");
    if (auth.error) return auth.error;

    const { id } = await params;
    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
    const data = memberUpdateSchema.parse(body);

    const existing = await prisma.member.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const member = await prisma.member.update({
      where: { id },
      data: {
        phone: data.phone,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        address: data.address,
        emergencyContact: data.emergencyContact,
        photoUrl: data.photoUrl,
        status: data.status,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await logAudit({
      actorId: auth.userId,
      action: "member.updated",
      entityType: "Member",
      entityId: id,
      metadata: { changes: data },
    });

    return NextResponse.json(member);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Member PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
