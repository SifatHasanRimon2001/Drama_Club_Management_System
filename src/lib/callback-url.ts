/**
 * Safe redirect helpers for the authentication flow.
 *
 * A callback URL is only ever a *relative* path on this origin. Absolute URLs,
 * protocol-relative URLs ("//host/path") and auth-page URLs are rejected so a
 * crafted query parameter can never be turned into an open redirect or an
 * infinite redirect loop.
 */

export const LOGIN_PATH = "/login";

/** Returns a safe same-origin path, or null when the value must be ignored. */
export function sanitizeCallbackUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return null;
  // Protocol-relative (//host) and backslash variants bypass the "/" check.
  if (trimmed.startsWith("//")) return null;
  if (trimmed.startsWith("\\\\")) return null;
  // Never bounce the user back onto auth pages after signing in.
  if (trimmed.startsWith("/login") || trimmed.startsWith("/register")) return null;
  return trimmed;
}

/**
 * Builds a /login URL that returns the user to `currentPath` after a successful
 * sign-in. Falls back to the bare login page when the path is unsafe.
 *
 * Set `expired: true` when the user is being sent here because their session
 * was invalidated/expired, so the login page can surface a notice.
 */
export function buildLoginUrl(
  currentPath?: string | null,
  opts?: { expired?: boolean }
): string {
  const callback = sanitizeCallbackUrl(currentPath);
  const base = callback
    ? `${LOGIN_PATH}?callbackUrl=${encodeURIComponent(callback)}`
    : LOGIN_PATH;
  return opts?.expired
    ? `${base}${base.includes("?") ? "&" : "?"}expired=1`
    : base;
}
