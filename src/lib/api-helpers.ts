import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";

export async function getSession() {
  return auth();
}

export async function requireAuth(permissionKey?: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const userId = (session.user as { id: string }).id;

  if (permissionKey) {
    const allowed = await can(userId, permissionKey);
    if (!allowed) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
  }

  return { userId, session };
}

export function getPaginationParams(request: NextRequest) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20") || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
