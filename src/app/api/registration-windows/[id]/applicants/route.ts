import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, validateEnumParam } from "@/lib/api-helpers";

const VALID_APPLICANT_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACCEPTED",
  "REJECTED",
  "CONVERTED",
] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("registration.review");
    if (auth.error) return auth.error;

    const { id: windowId } = await params;

    const statusResult = validateEnumParam(request, "status", VALID_APPLICANT_STATUSES);
    if (statusResult.error) return statusResult.error;

    const url = new URL(request.url);
    const search = url.searchParams.get("search");

    const where: Record<string, unknown> = { registrationWindowId: windowId };
    if (statusResult.value) where.status = statusResult.value;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { studentId: { contains: search, mode: "insensitive" } },
      ];
    }

    const applicants = await prisma.applicant.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ applicants });
  } catch (error) {
    console.error("[Applicants GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
