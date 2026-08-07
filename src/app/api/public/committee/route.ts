import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const committee = await prisma.committee.findFirst({
      where: { isCurrent: true },
      orderBy: { startDate: "desc" },
      include: {
        memberRoles: {
          include: {
            member: {
              include: {
                user: { select: { id: true, name: true, image: true } },
              },
            },
            role: true,
          },
        },
        departments: true,
      },
    });

    if (!committee) {
      return NextResponse.json(
        { error: "No active committee found" },
        { status: 404 }
      );
    }

    return NextResponse.json(committee);
  } catch (error) {
    console.error("[Public Committee GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
