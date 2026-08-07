import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { getUserPermissions } from "@/lib/permissions";

// Per-account login throttling (in-memory). Successful logins reset the
// counter; 10 failed attempts within 15 minutes block further attempts.
const LOGIN_MAX_FAILURES = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginFailures = new Map<string, { count: number; resetAt: number }>();

function loginKey(email: string): string {
  return email.trim().toLowerCase();
}

function isLoginThrottled(email: string): boolean {
  const record = loginFailures.get(loginKey(email));
  if (!record) return false;
  if (Date.now() > record.resetAt) {
    loginFailures.delete(loginKey(email));
    return false;
  }
  return record.count >= LOGIN_MAX_FAILURES;
}

function recordLoginFailure(email: string): void {
  const key = loginKey(email);
  const record = loginFailures.get(key);
  const now = Date.now();
  if (!record || now > record.resetAt) {
    loginFailures.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  record.count++;
}

function clearLoginFailures(email: string): void {
  loginFailures.delete(loginKey(email));
}

/** Test-only: reset the in-memory throttle state. */
export function _resetLoginThrottleForTesting(): void {
  loginFailures.clear();
}

export const authProviders = [
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      // Normalize email case so login is case-insensitive and matches the
      // lowercase emails written by register/apply/convert.
      const email = (credentials.email as string).trim().toLowerCase();

      // Brute-force protection: reject early once the account is throttled.
      // Same null response as a bad password, so attackers cannot distinguish.
      if (isLoginThrottled(email)) {
        return null;
      }

      try {
        const user = await prisma.user.findUnique({
          where: { email },
          include: { memberProfile: { select: { status: true } } },
        });

        if (!user || !user.passwordHash) {
          recordLoginFailure(email);
          return null;
        }

        // Block suspended/inactive members from logging in
        if (user.memberProfile?.status === "SUSPENDED" || user.memberProfile?.status === "INACTIVE") {
          console.warn("[Auth] Blocked login for suspended/inactive user:", user.email);
          recordLoginFailure(email);
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) {
          recordLoginFailure(email);
          return null;
        }

        clearLoginFailures(email);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      } catch (error) {
        console.error("[Auth] Authorize error:", error);
        return null;
      }
    },
  }),
];

export const authCallbacks: NextAuthConfig["callbacks"] = {
  async jwt({ token, user }) {
    const now = Math.floor(Date.now() / 1000);

    // On sign-in, populate token with user data + permissions
    if (user && user.id) {
      token.id = user.id;
      try {
        const permissions = await getUserPermissions(user.id);
        token.permissions = permissions;
        token.lastRefresh = now;
      } catch (error) {
        console.error("[Auth] Failed to load permissions:", error);
        token.permissions = [];
        token.lastRefresh = now;
      }
      return token;
    }

    // Refresh permissions periodically (every 5 minutes)
    const lastRefresh = (token.lastRefresh as number) || 0;
    if (token.id && now - lastRefresh > 5 * 60) {
      try {
        const permissions = await getUserPermissions(token.id as string);
        token.permissions = permissions;
        token.lastRefresh = now;
      } catch (error) {
        console.error("[Auth] Failed to refresh permissions:", error);
      }
    }

    return token;
  },
  async session({ session, token }) {
    if (session.user) {
      (session.user as { id: string }).id = token.id as string;
      (session.user as { permissions: string[] }).permissions =
        (token.permissions as string[]) || [];
    }
    return session;
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/login",
  },
  providers: authProviders,
  callbacks: authCallbacks,
});
