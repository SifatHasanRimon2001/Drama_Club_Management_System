import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, parseJsonBody } from "@/lib/api-helpers";
import { settingsSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

const ALLOWED_SETTING_KEYS = [
  "clubName",
  "clubDescription",
  "contactEmail",
  "contactPhone",
  "socialLinks",
  "theme",
  "logoUrl",
  "bannerUrl",
  "registrationEnabled",
  "maintenanceMode",
];

export async function GET() {
  try {
    const auth = await requireAuth("settings.manage");
    if (auth.error) return auth.error;

    const settings = await prisma.systemSetting.findMany();
    const settingsMap: Record<string, unknown> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }
    return NextResponse.json(settingsMap);
  } catch (error) {
    console.error("[Settings GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth("settings.manage");
    if (auth.error) return auth.error;

    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
    settingsSchema.parse(body);

    // Validate all keys are allowed
          const invalidKeys = Object.keys(body as Record<string, unknown>).filter((k) => !ALLOWED_SETTING_KEYS.includes(k));
    if (invalidKeys.length > 0) {
      return NextResponse.json(
        { error: `Invalid setting keys: ${invalidKeys.join(", ")}. Allowed: ${ALLOWED_SETTING_KEYS.join(", ")}` },
        { status: 400 }
      );
    }

    const updates = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
        const setting = await tx.systemSetting.upsert({
          where: { key },
          update: { value: value as Prisma.InputJsonValue },
          create: { key, value: value as Prisma.InputJsonValue },
        });
        results.push(setting);
      }
      return results;
    });

    await logAudit({
      actorId: auth.userId,
      action: "settings.updated",
      entityType: "SystemSetting",
      entityId: "all",
          metadata: { keys: Object.keys(body as Record<string, unknown>) },
    });

    return NextResponse.json({ message: "Settings updated", count: updates.length });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Settings PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
