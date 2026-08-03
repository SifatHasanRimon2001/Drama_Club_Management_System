import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { getUserPermissions } from "@/lib/permissions";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/login",
  },
  providers: [
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

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
            include: { memberProfile: { select: { status: true } } },
          });

          if (!user || !user.passwordHash) {
            return null;
          }

          // Block suspended/inactive members from logging in
          if (user.memberProfile?.status === "SUSPENDED" || user.memberProfile?.status === "INACTIVE") {
            console.warn("[Auth] Blocked login for suspended/inactive user:", user.email);
            return null;
          }

          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
          );

          if (!isValid) {
            return null;
          }

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
  ],
  callbacks: {
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
  },
});
