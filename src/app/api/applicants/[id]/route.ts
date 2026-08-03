import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";
import { applicantDecisionSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { sendEmail, applicantStatusEmail } from "@/lib/email";
import { ZodError } from "zod";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("registration.review");
    if (auth.error) return auth.error;

    const { id } = await params;
    const applicant = await prisma.applicant.findUnique({
      where: { id },
      include: {
        registrationWindow: true,
        convertedMember: true,
      },
    });

    if (!applicant) {
      return NextResponse.json(
        { error: "Applicant not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(applicant);
  } catch (error) {
    console.error("[Applicant GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("registration.review");
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const data = applicantDecisionSchema.parse(body);

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

    // PRD §4: State machine — only SUBMITTED/UNDER_REVIEW can be ACCEPTED/REJECTED
    const validTransitions: Record<string, string[]> = {
      SUBMITTED: ["UNDER_REVIEW", "ACCEPTED", "REJECTED"],
      UNDER_REVIEW: ["ACCEPTED", "REJECTED"],
    };
    const allowed = validTransitions[applicant.status];
    if (!allowed || !allowed.includes(data.status)) {
      return NextResponse.json(
        { error: `Cannot transition from ${applicant.status} to ${data.status}` },
        { status: 400 }
      );
    }

    const previousStatus = applicant.status;
    const updated = await prisma.applicant.update({
      where: { id },
      data: { status: data.status },
    });

    // Send email notification to applicant
    try {
      const emailContent = applicantStatusEmail(
        applicant.name,
        data.status === "ACCEPTED" ? "accepted" : "rejected",
        applicant.registrationWindow.title
      );
      await sendEmail({
        to: applicant.email,
        subject: emailContent.subject,
        html: emailContent.html,
      });
    } catch (emailError) {
      console.error("[Applicant PATCH] Failed to send email:", emailError);
    }

    await logAudit({
      actorId: auth.userId,
      action: `applicant.${data.status.toLowerCase()}`,
      entityType: "Applicant",
      entityId: id,
      metadata: {
        name: applicant.name,
        email: applicant.email,
        previousStatus,
        newStatus: data.status,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Applicant PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
