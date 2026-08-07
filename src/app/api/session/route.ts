import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getUserPermissions } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ user: null });
    }

    const userId = (session.user as { id: string }).id;
    const permissions = await getUserPermissions(userId);
    const member = await prisma.member.findUnique({
      where: { userId },
      select: { id: true },
    });

    return NextResponse.json({
      user: {
        id: userId,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        memberId: member?.id ?? null,
        permissions,
      },
    });
  } catch (error) {
    console.error("[Session GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
