import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";

const REQUIRED_R2_VARS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
] as const;

export async function GET() {
  try {
    const auth = await requireAuth("settings.manage");
    if (auth.error) return auth.error;

    const missing = REQUIRED_R2_VARS.filter((key) => !process.env[key]);
    const bucket = process.env.R2_BUCKET_NAME || null;
    const publicUrl = process.env.R2_PUBLIC_URL || "";

    return NextResponse.json({
      configured: missing.length === 0,
      bucket,
      publicUrl,
      missing,
    });
  } catch (error) {
    console.error("[Storage status GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
