import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, parseJsonBody } from "@/lib/api-helpers";
import { committeeRoleSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { INTERNAL_MEMBER_SELECT } from "@/lib/member-select";
import { ZodError } from "zod";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("committee.manage");
    if (auth.error) return auth.error;

    const { id: committeeId } = await params;
    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
    const { memberId, roleId } = committeeRoleSchema.parse(body);

    // Validate committee exists
    const committee = await prisma.committee.findUnique({ where: { id: committeeId } });
    if (!committee) {
      return NextResponse.json(
        { error: "Committee not found" },
        { status: 404 }
      );
    }

    // Validate member exists
    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Validate role exists
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      );
    }

    const existing = await prisma.committeeMemberRole.findFirst({
      where: { committeeId, memberId, roleId, endedAt: null },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Member already has this role in this committee" },
        { status: 409 }
      );
    }

    const memberRole = await prisma.committeeMemberRole.create({
      data: { committeeId, memberId, roleId },
      include: {
        member: { select: INTERNAL_MEMBER_SELECT },
        role: true,
        committee: true,
      },
    });

    await logAudit({
      actorId: auth.userId,
      action: "committee.role_assigned",
      entityType: "CommitteeMemberRole",
      entityId: memberRole.id,
      metadata: { committeeId, memberId, roleId },
    });

    return NextResponse.json(memberRole, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Committee Roles POST]", error);
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
    const auth = await requireAuth("committee.manage");
    if (auth.error) return auth.error;

    const { id: committeeId } = await params;
    const url = new URL(request.url);
    const memberRoleId = url.searchParams.get("memberRoleId");

    if (!memberRoleId) {
      return NextResponse.json(
        { error: "memberRoleId query param is required" },
        { status: 400 }
      );
    }

    // Validate the role belongs to this committee
    const existingRole = await prisma.committeeMemberRole.findUnique({
      where: { id: memberRoleId },
    });

    if (!existingRole) {
      return NextResponse.json(
        { error: "Committee member role not found" },
        { status: 404 }
      );
    }

    if (existingRole.committeeId !== committeeId) {
      return NextResponse.json(
        { error: "This role does not belong to the specified committee" },
        { status: 403 }
      );
    }

    // PRD §4: Soft-delete by setting endedAt to preserve history
    await prisma.committeeMemberRole.update({
      where: { id: memberRoleId },
      data: { endedAt: new Date() },
    });

    await logAudit({
      actorId: auth.userId,
      action: "committee.role_removed",
      entityType: "CommitteeMemberRole",
      entityId: memberRoleId,
      metadata: { committeeId },
    });

    return NextResponse.json({ message: "Role removed from committee" });
  } catch (error) {
    console.error("[Committee Roles DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
