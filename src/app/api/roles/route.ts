import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, parseJsonBody } from "@/lib/api-helpers";
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

    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
    const data = roleSchema.parse(body);

    // Validate all permission IDs exist and dedupe (prevents P2003/P2002 500s)
    const permissionIds = Array.from(new Set(data.permissionIds || []));
    if (permissionIds.length > 0) {
      const found = await prisma.permission.findMany({
        where: { id: { in: permissionIds } },
        select: { id: true },
      });
      const foundIds = new Set(found.map((p) => p.id));
      const missing = permissionIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Unknown permission ID(s): ${missing.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const role = await prisma.$transaction(async (tx) => {
      return tx.role.create({
        data: {
          name: data.name,
          description: data.description,
          permissions: permissionIds.length
            ? {
                create: permissionIds.map((permissionId) => ({
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
      metadata: { name: role.name, permissionCount: permissionIds.length },
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
