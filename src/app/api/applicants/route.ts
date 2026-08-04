import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getPaginationParams, validateEnumParam } from "@/lib/api-helpers";

const VALID_APPLICANT_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACCEPTED",
  "REJECTED",
  "CONVERTED",
] as const;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth("registration.review");
    if (auth.error) return auth.error;

    const { page, limit, skip } = getPaginationParams(request);
    const url = new URL(request.url);
    const windowId = url.searchParams.get("windowId");

    const statusResult = validateEnumParam(request, "status", VALID_APPLICANT_STATUSES);
    if (statusResult.error) return statusResult.error;

    const search = url.searchParams.get("search");

    const where: Record<string, unknown> = {};
    if (windowId) where.registrationWindowId = windowId;
    if (statusResult.value) where.status = statusResult.value;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { studentId: { contains: search, mode: "insensitive" } },
      ];
    }

    const [applicants, total] = await Promise.all([
      prisma.applicant.findMany({
        where,
        include: {
          registrationWindow: {
            select: { id: true, title: true },
          },
          convertedMember: {
            select: { id: true, memberCode: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.applicant.count({ where }),
    ]);

    return NextResponse.json({
      applicants,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[Applicants GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
