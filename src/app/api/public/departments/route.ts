import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PUBLIC_MEMBER_SELECT } from "@/lib/member-select";

export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      where: { committee: { isCurrent: true } },
      include: {
        coordinator: { select: PUBLIC_MEMBER_SELECT },
        _count: { select: { members: true, events: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(departments);
  } catch (error) {
    console.error("[Public Departments GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
