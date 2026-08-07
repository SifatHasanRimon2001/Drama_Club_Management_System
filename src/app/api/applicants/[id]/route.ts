import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, parseJsonBody } from "@/lib/api-helpers";
import { applicantDecisionSchema } from "@/lib/validations";
import { canTransition } from "@/lib/applicant-transitions";
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
    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
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

    // PRD §4: State machine — SUBMITTED -> [UNDER_REVIEW, ACCEPTED, REJECTED], UNDER_REVIEW -> [ACCEPTED, REJECTED]
    const transition = canTransition(applicant.status, data.status);
    if (!transition.ok) {
      return NextResponse.json(
        { error: transition.error },
        { status: 400 }
      );
    }

    const previousStatus = applicant.status;
    const updated = await prisma.applicant.update({
      where: { id },
      data: { status: data.status },
    });

    // Send email notification to applicant (only on accept/reject)
    if (data.status === "ACCEPTED" || data.status === "REJECTED") {
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
