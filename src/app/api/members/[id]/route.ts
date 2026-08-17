import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, parseJsonBody } from "@/lib/api-helpers";
import { can } from "@/lib/permissions";
import { memberUpdateSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { DIRECTORY_MEMBER_SELECT, PERSONAL_MEMBER_FIELDS } from "@/lib/member-select";
import { ZodError } from "zod";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticated only: a member may read their own profile, and anyone with
    // `member.view` may read any profile.
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { id } = await params;
    const member = await prisma.member.findUnique({
      where: { id },
      select: { userId: true, status: true },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const isOwner = member.userId === auth.userId;
    if (isOwner) {
      // Stale-JWT guard (mirrors `can()`): suspended/inactive members lose API
      // access immediately even while their session token is still valid.
      if (member.status === "SUSPENDED" || member.status === "INACTIVE") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      const allowed = await can(auth.userId, "member.view");
      if (!allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Personal contact details are gated behind ownership or `member.edit`.
    // `member.view` alone is the directory permission — every role holds it,
    // so treating it as sufficient for phone/address/DOB/emergency contact
    // made the whole membership's personal data readable by every member.
    const canSeePersonal = isOwner || (await can(auth.userId, "member.edit"));

    const full = await prisma.member.findUnique({
      where: { id },
      select: {
        ...DIRECTORY_MEMBER_SELECT,
        ...(canSeePersonal ? PERSONAL_MEMBER_FIELDS : {}),
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

    return NextResponse.json(full);
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
