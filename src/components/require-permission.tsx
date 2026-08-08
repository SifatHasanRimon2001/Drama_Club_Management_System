"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/client/session";
import { buildLoginUrl } from "@/lib/callback-url";
import { PageLoader } from "@/components/ui/feedback";

/**
 * Client-side route gate for permission-protected dashboard pages.
 *
 * Security note: this is a UX layer only — it redirects users who should not
 * see a page. The real authorization is always enforced server-side by the
 * protected API routes (`requireAuth(permissionKey)`), so tampering with the
 * client can never grant access to data.
 *
 * While the session is still loading, nothing renders (prevents a flash of
 * protected UI). If the session resolves to a logged-out user we send them to
 * /login (preserving the attempted URL); if it resolves to a user without the
 * required permission we send them back to a safe page.
 */
export function RequirePermission({
  permission,
  anyOf,
  extraAllowed = false,
  redirectTo = "/dashboard",
  children,
}: {
  /** The single permission required to view this page. */
  permission?: string;
  /** Any one of these permissions grants access (alternative to `permission`). */
  anyOf?: string[];
  /** Extra condition (e.g. "this is my own profile") that also grants access. */
  extraAllowed?: boolean;
  redirectTo?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useSession();

  const allowed =
    extraAllowed ||
    (permission
      ? (user?.permissions?.includes(permission) ?? false)
      : (anyOf?.some((p) => user?.permissions?.includes(p)) ?? false));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const current =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "";
      // The layout considered the session valid moments ago, so a logged-out
      // user here means the session was invalidated/expired — flag it.
      router.replace(buildLoginUrl(current, { expired: true }));
      return;
    }
    if (!allowed) {
      router.replace(redirectTo);
    }
  }, [loading, user, allowed, router, redirectTo]);

  if (loading) return <PageLoader label="Checking access…" />;
  if (!user || !allowed) return null;
  return <>{children}</>;
}
