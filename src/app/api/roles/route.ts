import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";
import { roleSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { ZodError } from "zod";

export async function GET() {
  try {
    const auth = await requireAuth("permissions.manage");
    if (auth.error) return auth.error;

    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: { permission: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(roles);
  } catch (error) {
    console.error("[Roles GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth("permissions.manage");
    if (auth.error) return auth.error;

    const body = await request.json();
    const data = roleSchema.parse(body);

    const role = await prisma.$transaction(async (tx) => {
      return tx.role.create({
        data: {
          name: data.name,
          description: data.description,
          permissions: data.permissionIds?.length
            ? {
                create: data.permissionIds.map((permissionId) => ({
                  permissionId,
                })),
              }
            : undefined,
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
      action: "role.created",
      entityType: "Role",
      entityId: role.id,
      metadata: { name: role.name, permissionCount: data.permissionIds?.length || 0 },
    });

    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A role with this name already exists" },
        { status: 409 }
      );
    }
    console.error("[Roles POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
