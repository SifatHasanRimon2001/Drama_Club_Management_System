import { NextRequest, NextResponse } from "next/server";
import { requireAuth, parseJsonBody } from "@/lib/api-helpers";
import { presignedUrlSchema } from "@/lib/validations";
import {
  getPresignedUploadUrl,
  buildR2Key,
  isValidUploadType,
  isValidUploadSize,
  getMaxUploadBytes,
} from "@/lib/r2";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth("gallery.upload");
    if (auth.error) return auth.error;

    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body;
    const data = presignedUrlSchema.parse(body);

    // Validate content type against allowed types
    if (!isValidUploadType(data.contentType)) {
      return NextResponse.json(
        { error: `Invalid content type. Allowed: image/jpeg, image/png, image/gif, image/webp, video/mp4, video/webm` },
        { status: 400 }
      );
    }

    // Validate file size against per-type limits
    if (!isValidUploadSize(data.contentType, data.fileSize)) {
      return NextResponse.json(
        { error: `File too large. Maximum allowed size: ${Math.floor(getMaxUploadBytes(data.contentType) / (1024 * 1024))} MB for this content type.` },
        { status: 400 }
      );
    }

    const key = buildR2Key(
      data.folder || "gallery",
      data.fileName,
      data.departmentId
    );

    // The declared size is signed into the URL, so the limit checked above is
    // enforced by storage rather than trusted from the client.
    const { uploadUrl, publicUrl } = await getPresignedUploadUrl(
      key,
      data.contentType,
      data.fileSize
    );

    return NextResponse.json({ uploadUrl, key, publicUrl });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Gallery Upload URL POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
