import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { presignedUrlSchema } from "@/lib/validations";
import { getPresignedUploadUrl, buildR2Key, isValidUploadType } from "@/lib/r2";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth("gallery.upload");
    if (auth.error) return auth.error;

    const body = await request.json();
    const data = presignedUrlSchema.parse(body);

    // Validate content type against allowed types
    if (!isValidUploadType(data.contentType)) {
      return NextResponse.json(
        { error: `Invalid content type. Allowed: image/jpeg, image/png, image/gif, image/webp, video/mp4, video/webm` },
        { status: 400 }
      );
    }

    const key = buildR2Key(
      data.folder || "gallery",
      data.fileName,
      data.departmentId
    );

    const { uploadUrl, publicUrl } = await getPresignedUploadUrl(
      key,
      data.contentType
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
