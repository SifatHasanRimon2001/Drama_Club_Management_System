"use client";

import { signOut } from "next-auth/react";

/**
 * Shared sign-out helper. Both the dashboard shell and the public nav use this
 * so the logout lifecycle is identical everywhere:
 *
 *  1. Clear the client-side session state (caller passes clear()).
 *  2. Invalidate the NextAuth session cookie server-side.
 *  3. Hard-navigate to /login (discards all in-memory state).
 *
 * If the server-side invalidation fails (network, already-expired session) we
 * flag the page load so the login page doesn't bounce the user back into the
 * dashboard.
 */
export async function performSignOut(
  clearClientState: () => void
): Promise<void> {
  clearClientState();
  try {
    await signOut({ redirect: false, callbackUrl: "/login" });
  } catch {
    // Cookie could not be cleared server-side — flag the page load so the
    // login page doesn't bounce the user straight back into the dashboard.
    try {
      window.sessionStorage.setItem("dcms:signed-out", "1");
    } catch {
      /* storage unavailable — ignore */
    }
  }
  window.location.assign("/login");
}
