import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PUBLIC_MEMBER_SELECT } from "@/lib/member-select";

export async function GET() {
  try {
    const committee = await prisma.committee.findFirst({
      where: { isCurrent: true },
      orderBy: { startDate: "desc" },
      include: {
        memberRoles: {
          include: {
            // `select`, not `include` — an `include` here would ship every
            // Member scalar (phone, address, emergencyContact) to anonymous
            // callers just to render a name and avatar.
            member: { select: PUBLIC_MEMBER_SELECT },
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
