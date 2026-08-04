import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";
import { roleUpdateSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { ZodError } from "zod";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("permissions.manage");
    if (auth.error) return auth.error;

    const { id } = await params;
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    return NextResponse.json(role);
  } catch (error) {
    console.error("[Role GET]", error);
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
    const auth = await requireAuth("permissions.manage");
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const data = roleUpdateSchema.parse(body);

    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Update role fields and replace permissions if provided
    const role = await prisma.$transaction(async (tx) => {
      // If permissionIds provided, replace all
      if (data.permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        if (data.permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: data.permissionIds.map((permissionId) => ({
              roleId: id,
              permissionId,
            })),
          });
        }
      }

      return tx.role.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
        },
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      });
    });

    await logAudit({
      actorId: auth.userId,
      action: "role.updated",
      entityType: "Role",
      entityId: id,
      metadata: { name: role.name, changes: data },
    });

    return NextResponse.json(role);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Role PATCH]", error);
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
    const auth = await requireAuth("permissions.manage");
    if (auth.error) return auth.error;

    const { id } = await params;

    const existing = await prisma.role.findUnique({
      where: { id },
      include: {
        committeeMemberRoles: { where: { endedAt: null }, take: 1 },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    if (existing.committeeMemberRoles.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete a role that is actively assigned to committee members. Remove all assignments first." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.role.delete({ where: { id } });
    });

    await logAudit({
      actorId: auth.userId,
      action: "role.deleted",
      entityType: "Role",
      entityId: id,
      metadata: { name: existing.name },
    });

    return NextResponse.json({ message: "Role deleted" });
  } catch (error) {
    console.error("[Role DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
