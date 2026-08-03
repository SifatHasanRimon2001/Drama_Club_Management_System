import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireAuth } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const auth = await requireAuth("permissions.manage");
    if (auth.error) return auth.error;

    const permissions = await prisma.permission.findMany({
      orderBy: { key: "asc" },
    });
    return NextResponse.json(permissions);
  } catch (error) {
    console.error("[Permissions GET]", error);
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

    const seeded = [];
    for (const key of PERMISSIONS) {
      const perm = await prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key },
      });
      seeded.push(perm);
    }

    await logAudit({
      actorId: auth.userId,
      action: "permissions.seed",
      entityType: "Permission",
      entityId: "all",
      metadata: { count: seeded.length },
    });

    return NextResponse.json({
      message: "Permissions seeded",
      count: seeded.length,
    });
  } catch (error) {
    console.error("[Permissions POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
