import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/api-helpers";
import { clientIpKey, RateLimiter } from "@/lib/rate-limit";
import { ZodError } from "zod";

// Rate limiter: 3 registrations per client per hour
const registerRateLimiter = new RateLimiter(3, 60 * 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    const ip = clientIpKey(request);

    if (!registerRateLimiter.allow(ip)) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 }
      );
    }

    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
    const data = registerSchema.parse(body);

    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
      },
    });

    await logAudit({
      actorId: user.id,
      action: "user.registered",
      entityType: "User",
      entityId: user.id,
      metadata: { email: data.email },
    });

    return NextResponse.json(
      { message: "User created" },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Register]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
