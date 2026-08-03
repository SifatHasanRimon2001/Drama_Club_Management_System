import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const [settings, departmentCount, memberCount] = await Promise.all([
      prisma.systemSetting.findMany(),
      prisma.department.count(),
      prisma.member.count({ where: { status: "ACTIVE" } }),
    ]);

    const settingsMap: Record<string, unknown> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    return NextResponse.json({
      clubName: settingsMap.clubName || "Drama Club",
      clubDescription: settingsMap.clubDescription || "",
      logoUrl: settingsMap.logoUrl || null,
      departmentCount,
      activeMemberCount: memberCount,
    });
  } catch (error) {
    console.error("[Public About GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
