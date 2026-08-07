import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { requireAuth, parseJsonBody } from "@/lib/api-helpers";
import { applicantConvertSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { ZodError } from "zod";

function generateTempPassword(): string {
  const bytes = crypto.randomBytes(12);
  return `Dcms${bytes.toString("base64url")}!`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("member.create");
    if (auth.error) return auth.error;

    const { id } = await params;
    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
    const { password } = applicantConvertSchema.parse(body);

    const applicant = await prisma.applicant.findUnique({
      where: { id },
      include: { registrationWindow: { select: { title: true } } },
    });

    if (!applicant) {
      return NextResponse.json(
        { error: "Applicant not found" },
        { status: 404 }
      );
    }

    if (applicant.convertedMemberId) {
      return NextResponse.json(
        { error: "Applicant has already been converted" },
        { status: 409 }
      );
    }

    if (applicant.status !== "ACCEPTED") {
      return NextResponse.json(
        { error: "Only accepted applicants can be converted" },
        { status: 400 }
      );
    }

    // Generate a temporary password if none provided
    const tempPassword = password || generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // Normalize to lowercase so the created account matches the register
    // flow and login is case-insensitive.
    const email = applicant.email.toLowerCase().trim();

    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          name: applicant.name,
          email,
          passwordHash,
        },
      });

      // Create member
      const memberCode = `DCMS-${uuidv4().slice(0, 8).toUpperCase()}`;
      const member = await tx.member.create({
        data: {
          userId: user.id,
          memberCode,
          phone: applicant.phone,
          status: "ACTIVE",
          joiningDate: new Date(),
        },
      });

      // Assign departments from applicant preferences (only valid department IDs)
      if (applicant.departmentPrefs.length > 0) {
        const validDepts = await tx.department.findMany({
          where: { id: { in: applicant.departmentPrefs } },
          select: { id: true },
        });
        if (validDepts.length > 0) {
          await tx.memberDepartment.createMany({
            data: validDepts.map((d) => ({
              memberId: member.id,
              departmentId: d.id,
            })),
          });
        }
      }

      // Update applicant
      await tx.applicant.update({
        where: { id },
        data: {
          status: "CONVERTED",
          convertedMemberId: member.id,
        },
      });

      return { user, member, memberCode };
    });

    await logAudit({
      actorId: auth.userId,
      action: "applicant.converted",
      entityType: "Applicant",
      entityId: id,
      metadata: {
        name: applicant.name,
        email,
        memberId: result.member.id,
        memberCode: result.memberCode,
      },
    });

    return NextResponse.json({
      message: "Applicant converted to member",
      member: {
        id: result.member.id,
        memberCode: result.memberCode,
        name: result.user.name,
        email: result.user.email,
      },
      tempPassword: password ? undefined : tempPassword,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // Handle Prisma unique constraint violation (duplicate email)
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }
    console.error("[Applicant Convert POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
