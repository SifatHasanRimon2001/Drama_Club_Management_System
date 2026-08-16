/**
 * Safe redirect helpers for the authentication flow.
 *
 * A callback URL is only ever a *relative* path on this origin. Absolute URLs,
 * protocol-relative URLs ("//host/path") and auth-page URLs are rejected so a
 * crafted query parameter can never be turned into an open redirect or an
 * infinite redirect loop.
 */

export const LOGIN_PATH = "/login";

// Control characters (NUL, CR, LF, tab, DEL) can truncate or split the value
// on its way through a header or a URL parser, changing how the remainder is
// interpreted. No legitimate route contains one.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** Returns a safe same-origin path, or null when the value must be ignored. */
export function sanitizeCallbackUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return null;

  if (CONTROL_CHARS.test(trimmed)) return null;

  // In the URL spec a backslash is equivalent to a forward slash for special
  // schemes, so "/\evil.com" resolves to https://evil.com/ exactly the way
  // "//evil.com" does. Normalize every separator spelling to "/" before
  // testing — checking only the literal "//" form leaves the backslash
  // variants as a working open redirect.
  const normalized = trimmed.replace(/\\/g, "/");
  if (normalized.startsWith("//")) return null;

  // Never bounce the user back onto auth pages after signing in.
  if (normalized.startsWith("/login") || normalized.startsWith("/register")) {
    return null;
  }

  // Return the normalized form: it is what the browser would resolve anyway,
  // and it guarantees the value handed to location.assign() is the same string
  // this function actually validated.
  return normalized;
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
