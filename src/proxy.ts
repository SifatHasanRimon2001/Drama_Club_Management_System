import { NextResponse, type NextRequest } from "next/server";
import { buildLoginUrl } from "@/lib/callback-url";

/**
 * Route classification guard.
 *
 * Public:        everything outside /dashboard
 * Authenticated: /dashboard/* — requires a valid session
 *
 * This proxy is deliberately lightweight: it only checks for the *presence*
 * of the session cookie so it can redirect anonymous users to /login with the
 * intended destination (`callbackUrl`). The authoritative verification of the
 * session (signature, expiry, revocation) happens server-side in
 * `src/app/(dashboard)/layout.tsx` via `auth()` and in every protected API
 * route via `requireAuth()`. No database access runs on the Edge runtime here.
 */

const SESSION_COOKIE_HINT = "session-token";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/dashboard")) return NextResponse.next();

  const hasSessionCookie = req.cookies
    .getAll()
    .some((cookie) => cookie.name.includes(SESSION_COOKIE_HINT));

  if (hasSessionCookie) return NextResponse.next();

  // Preserve the attempted destination so the login page can return the user
  // to exactly where they were trying to go (including query params).
  const destination = pathname + req.nextUrl.search;
  return NextResponse.redirect(new URL(buildLoginUrl(destination), req.url));
}

export default proxy;

export const config = {
  // Matches /dashboard and every nested route. API routes and public pages
  // are intentionally excluded (the session API handles its own null state).
  matcher: ["/dashboard/:path*"],
};
