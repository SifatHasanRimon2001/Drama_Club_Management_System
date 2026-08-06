import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, parseJsonBody } from "@/lib/api-helpers";
import { memberDepartmentSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { ZodError } from "zod";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("department.manage");
    if (auth.error) return auth.error;

    const { id } = await params;
    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
    const { departmentId } = memberDepartmentSchema.parse(body);

    // Validate member exists
    const member = await prisma.member.findUnique({ where: { id } });
    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Validate department exists
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    const existing = await prisma.memberDepartment.findUnique({
      where: { memberId_departmentId: { memberId: id, departmentId } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Member already in this department" },
        { status: 409 }
      );
    }

    const assignment = await prisma.memberDepartment.create({
      data: { memberId: id, departmentId },
      include: {
        department: { select: { id: true, name: true } },
        member: { select: { id: true, memberCode: true } },
      },
    });

    await logAudit({
      actorId: auth.userId,
      action: "member.department_added",
      entityType: "MemberDepartment",
      entityId: `${id}-${departmentId}`,
      metadata: { memberId: id, departmentId },
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Member Departments POST]", error);
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
    const auth = await requireAuth("department.manage");
    if (auth.error) return auth.error;

    const { id } = await params;
    const url = new URL(request.url);
    const departmentId = url.searchParams.get("departmentId");

    if (!departmentId) {
      return NextResponse.json(
        { error: "departmentId query param is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.memberDepartment.findUnique({
      where: { memberId_departmentId: { memberId: id, departmentId } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Member is not in this department" },
        { status: 404 }
      );
    }

    await prisma.memberDepartment.delete({
      where: { memberId_departmentId: { memberId: id, departmentId } },
    });

    await logAudit({
      actorId: auth.userId,
      action: "member.department_removed",
      entityType: "MemberDepartment",
      entityId: `${id}-${departmentId}`,
      metadata: { memberId: id, departmentId },
    });

    return NextResponse.json({ message: "Removed from department" });
  } catch (error) {
    console.error("[Member Departments DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
