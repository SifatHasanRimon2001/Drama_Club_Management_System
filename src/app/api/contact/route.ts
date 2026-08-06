import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { contactSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/api-helpers";
import { clientIpKey, RateLimiter } from "@/lib/rate-limit";
import { ZodError } from "zod";

// Simple in-memory rate limiter (per client, 5 requests per 15 minutes)
const contactRateLimiter = new RateLimiter(5, 15 * 60 * 1000);

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

export async function POST(request: NextRequest) {
  try {
    const ip = clientIpKey(request);

    if (!contactRateLimiter.allow(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
    const data = contactSchema.parse(body);

    // Sanitize input - strip HTML tags
    const sanitizedName = stripHtml(data.name);
    const sanitizedMessage = stripHtml(data.message);

    const submission = await prisma.contactSubmission.create({
      data: {
        name: sanitizedName,
        email: data.email,
        message: sanitizedMessage,
      },
    });

    await logAudit({
      actorId: "public",
      action: "contact.submitted",
      entityType: "ContactSubmission",
      entityId: submission.id,
      metadata: { email: data.email },
    });

    return NextResponse.json(
      { message: "Message received", id: submission.id },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Contact POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
