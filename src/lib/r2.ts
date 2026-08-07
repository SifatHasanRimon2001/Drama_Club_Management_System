import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "Missing R2 configuration. Required env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME"
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl: publicUrl || "" };
}

let _r2: S3Client | null = null;
let _config: ReturnType<typeof getR2Config> | null = null;

function getR2() {
  if (!_r2) {
    _config = getR2Config();
    _r2 = new S3Client({
      region: "auto",
      endpoint: `https://${_config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: _config.accessKeyId,
        secretAccessKey: _config.secretAccessKey,
      },
    });
  }
  return { r2: _r2, config: _config! };
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const { r2, config } = getR2();
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2, command, { expiresIn });
  const publicUrl = `${config.publicUrl}/${key}`;

  return { uploadUrl, publicUrl };
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const { r2, config } = getR2();
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  });

  return getSignedUrl(r2, command, { expiresIn });
}

/**
 * Delete an object from the bucket. Throws when R2 is not configured or the
 * delete fails — callers should treat this as best-effort cleanup so a media
 * DB row can still be removed if storage is unavailable.
 */
export async function deleteR2Object(key: string): Promise<void> {
  const { r2, config } = getR2();
  const command = new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: key,
  });
  await r2.send(command);
}

export function buildR2Key(
  folder: string,
  fileName: string,
  departmentId?: string
): string {
  const timestamp = Date.now();
  // Sanitize: only allow alphanumeric, dots, hyphens, underscores
  // Remove path separators to prevent directory traversal
  const sanitized = fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.\./g, "_");
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeDeptId = departmentId
    ? departmentId.replace(/[^a-zA-Z0-9_-]/g, "_")
    : null;
  const prefix = safeDeptId ? `${safeFolder}/${safeDeptId}` : safeFolder;
  return `${prefix}/${timestamp}_${sanitized}`;
}

export const ALLOWED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
];

export const MAX_UPLOAD_BYTES = {
  image: 10 * 1024 * 1024, // 10 MB
  video: 50 * 1024 * 1024, // 50 MB
} as const;

export function isValidUploadType(contentType: string): boolean {
  return ALLOWED_UPLOAD_TYPES.includes(contentType);
}

export function getMaxUploadBytes(contentType: string): number {
  if (contentType.startsWith("video/")) return MAX_UPLOAD_BYTES.video;
  return MAX_UPLOAD_BYTES.image;
}

export function isValidUploadSize(contentType: string, bytes: number): boolean {
  return bytes <= getMaxUploadBytes(contentType);
}

export function getPublicUrl(key: string): string {
  const { config } = getR2();
  return `${config.publicUrl}/${key}`;
}
