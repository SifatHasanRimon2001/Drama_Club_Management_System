import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getPaginationParams, validateEnumParam, parseJsonBody } from "@/lib/api-helpers";
import { memberSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { ZodError } from "zod";

const VALID_MEMBER_STATUSES = [
  "PENDING",
  "ACTIVE",
  "ALUMNI",
  "INACTIVE",
  "SUSPENDED",
] as const;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth("member.view");
    if (auth.error) return auth.error;

    const { page, limit, skip } = getPaginationParams(request);
    const url = new URL(request.url);

    const statusResult = validateEnumParam(request, "status", VALID_MEMBER_STATUSES);
    if (statusResult.error) return statusResult.error;

    const departmentId = url.searchParams.get("departmentId");
    const search = url.searchParams.get("search");

    const where: Record<string, unknown> = {};
    if (statusResult.value) where.status = statusResult.value;
    if (departmentId) {
      where.departments = { some: { departmentId } };
    }
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { memberCode: { contains: search, mode: "insensitive" } },
      ];
    }

    const [members, total] = await Promise.all([
      prisma.member.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
          departments: {
            include: { department: { select: { id: true, name: true } } },
          },
          committeeRoles: {
            where: { committee: { isCurrent: true } },
            include: {
              role: { select: { id: true, name: true } },
              committee: { select: { id: true, year: true } },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { joiningDate: "desc" },
      }),
      prisma.member.count({ where }),
    ]);

    return NextResponse.json({
      members,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[Members GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth("member.create");
    if (auth.error) return auth.error;

    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
    const data = memberSchema.parse(body);

    const existing = await prisma.member.findFirst({
      where: { OR: [{ userId: data.userId }, { memberCode: data.memberCode }] },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Member already exists for this user or member code" },
        { status: 409 }
      );
    }

    // The referenced user must exist (prevents an FK violation 500)
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 400 }
      );
    }

    const member = await prisma.member.create({
      data: {
        userId: data.userId,
        memberCode: data.memberCode,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        address: data.address,
        emergencyContact: data.emergencyContact,
        photoUrl: data.photoUrl,
        status: data.status ?? "PENDING",
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await logAudit({
      actorId: auth.userId,
      action: "member.created",
      entityType: "Member",
      entityId: member.id,
      metadata: { memberCode: data.memberCode, userId: data.userId },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Members POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
