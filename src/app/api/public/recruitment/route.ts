import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const windows = await prisma.registrationWindow.findMany({
      where: {
        status: "LIVE",
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
      select: {
        id: true,
        title: true,
        description: true,
        bannerUrl: true,
        startDate: true,
        endDate: true,
        formSchema: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(windows);
  } catch (error) {
    console.error("[Public Recruitment GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
