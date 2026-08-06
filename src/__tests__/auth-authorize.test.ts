import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("next/server", async () => {
  const actual = await import("next/server.js");
  return { ...actual };
});

vi.mock("@/lib/permissions", () => ({
  getUserPermissions: vi.fn(),
}));

import {
  cleanupTestData,
  seedPermissions,
  createTestUser,
  createTestMember,
  uniqueSuffix,
} from "./helpers";
import prisma from "@/lib/prisma";
import { getUserPermissions } from "@/lib/permissions";

type AuthorizeFn = (credentials: { email?: string; password?: string }) => Promise<unknown>;

async function getRealAuthorize(): Promise<AuthorizeFn> {
  const real = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  const provider = real.authProviders[0] as {
    options?: { authorize?: AuthorizeFn };
  };
  const authorize = provider.options?.authorize;
  if (!authorize) throw new Error("authorize not exposed on provider options");
  return authorize.bind(provider);
}

describe("NextAuth credentials authorize (real logic)", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  it("returns the user for valid credentials", async () => {
    const { user, password } = await createTestUser({});
    await createTestMember({ userId: user.id, status: "ACTIVE" });
    const authorize = await getRealAuthorize();

    const result = await authorize({ email: user.email, password });
    expect(result).toMatchObject({ id: user.id, email: user.email, name: user.name });
  });

  it("allows login for a user without a member profile", async () => {
    const { user, password } = await createTestUser({});
    const authorize = await getRealAuthorize();

    const result = await authorize({ email: user.email, password });
    expect(result).toMatchObject({ id: user.id });
  });

  it("returns null for a wrong password", async () => {
    const { user } = await createTestUser({});
    await createTestMember({ userId: user.id, status: "ACTIVE" });
    const authorize = await getRealAuthorize();

    const result = await authorize({ email: user.email, password: "wrong-password" });
    expect(result).toBeNull();
  });

  it("returns null for an unknown email", async () => {
    const authorize = await getRealAuthorize();
    const result = await authorize({
      email: `nobody-${uniqueSuffix()}@test.com`,
      password: "password123",
    });
    expect(result).toBeNull();
  });

  it("returns null when email or password is missing", async () => {
    const authorize = await getRealAuthorize();
    expect(await authorize({ email: undefined, password: "password123" })).toBeNull();
    expect(await authorize({ email: "a@b.com", password: undefined })).toBeNull();
    expect(await authorize({})).toBeNull();
  });

  it("returns null for a user without a password hash", async () => {
    const user = await prisma.user.create({
      data: { name: "OAuth Only", email: `oauth-${uniqueSuffix()}@test.com` },
    });
    const authorize = await getRealAuthorize();
    const result = await authorize({ email: user.email, password: "whatever" });
    expect(result).toBeNull();
  });

  it("returns null for SUSPENDED members", async () => {
    const { user, password } = await createTestUser({});
    await createTestMember({ userId: user.id, status: "SUSPENDED" });
    const authorize = await getRealAuthorize();
    const result = await authorize({ email: user.email, password });
    expect(result).toBeNull();
  });

  it("returns null for INACTIVE members", async () => {
    const { user, password } = await createTestUser({});
    await createTestMember({ userId: user.id, status: "INACTIVE" });
    const authorize = await getRealAuthorize();
    const result = await authorize({ email: user.email, password });
    expect(result).toBeNull();
  });

  it("allows login for PENDING members", async () => {
    const { user, password } = await createTestUser({});
    await createTestMember({ userId: user.id, status: "PENDING" });
    const authorize = await getRealAuthorize();
    const result = await authorize({ email: user.email, password });
    expect(result).not.toBeNull();
  });

  it("returns null when the database lookup fails", async () => {
    const authorize = await getRealAuthorize();
    const spy = vi.spyOn(prisma.user, "findUnique").mockRejectedValueOnce(new Error("db down"));
    const result = await authorize({ email: "x@y.com", password: "password123" });
    expect(result).toBeNull();
    spy.mockRestore();
  });
});

describe("Login throttling (brute-force protection)", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
    const real = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
    real._resetLoginThrottleForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("blocks the 11th failed attempt without hitting the database", async () => {
    const user = await prisma.user.create({
      data: { name: "Throttle", email: `thr-${uniqueSuffix()}@test.com` },
    });
    const authorize = await getRealAuthorize();
    const spy = vi.spyOn(prisma.user, "findUnique");

    for (let i = 0; i < 10; i++) {
      expect(await authorize({ email: user.email, password: "bad-password" })).toBeNull();
    }
    expect(spy).toHaveBeenCalledTimes(10);

    expect(await authorize({ email: user.email, password: "bad-password" })).toBeNull();
    expect(spy).toHaveBeenCalledTimes(10); // 11th attempt never reached the DB
  });

  it("counts unknown emails toward the throttle (same null response as bad password)", async () => {
    const email = `ghost-${uniqueSuffix()}@test.com`;
    const authorize = await getRealAuthorize();

    for (let i = 0; i < 10; i++) {
      expect(await authorize({ email, password: "x" })).toBeNull();
    }
    expect(await authorize({ email, password: "x" })).toBeNull();
  });

  it("lets a successful login reset the failure counter", async () => {
    const { user, password } = await createTestUser({});
    await createTestMember({ userId: user.id, status: "ACTIVE" });
    const authorize = await getRealAuthorize();

    for (let i = 0; i < 9; i++) {
      expect(await authorize({ email: user.email, password: "wrong" })).toBeNull();
    }
    expect(await authorize({ email: user.email, password })).toMatchObject({ id: user.id });

    const spy = vi.spyOn(prisma.user, "findUnique");
    for (let i = 0; i < 10; i++) {
      expect(await authorize({ email: user.email, password: "wrong" })).toBeNull();
    }
    expect(spy).toHaveBeenCalledTimes(10);
    expect(await authorize({ email: user.email, password: "wrong" })).toBeNull();
    expect(spy).toHaveBeenCalledTimes(10); // blocked again: counter was reset by the success
  });

  it("expires the throttle window after 15 minutes", async () => {
    const user = await prisma.user.create({
      data: { name: "Expiry", email: `exp-${uniqueSuffix()}@test.com` },
    });
    vi.useFakeTimers();
    const authorize = await getRealAuthorize();

    for (let i = 0; i < 10; i++) {
      expect(await authorize({ email: user.email, password: "bad" })).toBeNull();
    }
    expect(await authorize({ email: user.email, password: "bad" })).toBeNull();

    const spy = vi.spyOn(prisma.user, "findUnique");
    await vi.advanceTimersByTimeAsync(16 * 60 * 1000);
    expect(await authorize({ email: user.email, password: "bad" })).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1); // window expired: the DB lookup ran again
  });

  it("_resetLoginThrottleForTesting clears the throttle state", async () => {
    const user = await prisma.user.create({
      data: { name: "Reset", email: `rst-${uniqueSuffix()}@test.com` },
    });
    const authorize = await getRealAuthorize();
    for (let i = 0; i < 10; i++) {
      await authorize({ email: user.email, password: "bad" });
    }

    const real = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
    real._resetLoginThrottleForTesting();

    const spy = vi.spyOn(prisma.user, "findUnique");
    expect(await authorize({ email: user.email, password: "bad" })).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1); // unthrottled again
  });
});

describe("NextAuth callbacks (real jwt/session logic)", () => {
  let callbacks: {
    jwt: (params: { token: Record<string, unknown>; user?: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    session: (params: { session: { user?: Record<string, unknown> }; token: Record<string, unknown> }) => Promise<{ user?: Record<string, unknown> }>;
  };

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
    const real = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
    callbacks = real.authCallbacks as never;
  });

  const now = () => Math.floor(Date.now() / 1000);

  it("populates token id and permissions on sign-in", async () => {
    vi.mocked(getUserPermissions).mockResolvedValue(["member.view"]);
    const token = await callbacks.jwt({
      token: {},
      user: { id: "user-1", name: "Test" },
    });
    expect(token.id).toBe("user-1");
    expect(token.permissions).toEqual(["member.view"]);
    expect(token.lastRefresh).toBeGreaterThan(now() - 5);
  });

  it("falls back to empty permissions when permission lookup fails on sign-in", async () => {
    vi.mocked(getUserPermissions).mockRejectedValue(new Error("boom"));
    const token = await callbacks.jwt({
      token: {},
      user: { id: "user-2" },
    });
    expect(token.permissions).toEqual([]);
    expect(token.lastRefresh).toBeGreaterThan(0);
  });

  it("refreshes permissions when the token is stale (> 5 minutes)", async () => {
    vi.mocked(getUserPermissions).mockResolvedValue(["events.manage"]);
    const token = await callbacks.jwt({
      token: { id: "user-3", lastRefresh: now() - 400 },
    });
    expect(token.permissions).toEqual(["events.manage"]);
    expect(getUserPermissions).toHaveBeenCalledWith("user-3");
  });

  it("refreshes permissions when lastRefresh is missing entirely", async () => {
    vi.mocked(getUserPermissions).mockResolvedValue(["events.manage"]);
    const token = await callbacks.jwt({
      token: { id: "user-4b" },
    });
    expect(token.permissions).toEqual(["events.manage"]);
    expect(getUserPermissions).toHaveBeenCalledWith("user-4b");
  });

  it("does not refresh permissions when the token is fresh", async () => {
    vi.mocked(getUserPermissions).mockResolvedValue(["events.manage"]);
    const token = await callbacks.jwt({
      token: { id: "user-4", lastRefresh: now() - 10 },
    });
    expect(token.permissions).toBeUndefined();
    expect(getUserPermissions).not.toHaveBeenCalled();
  });

  it("keeps stale permissions when refresh fails", async () => {
    vi.mocked(getUserPermissions).mockRejectedValue(new Error("boom"));
    const token = await callbacks.jwt({
      token: { id: "user-5", lastRefresh: now() - 400, permissions: ["old.perm"] },
    });
    expect(token.permissions).toEqual(["old.perm"]);
  });

  it("session callback attaches id and permissions from the token", async () => {
    const session = await callbacks.session({
      session: { user: {} },
      token: { id: "user-6", permissions: ["member.view", "events.manage"] },
    });
    expect((session.user as Record<string, unknown>).id).toBe("user-6");
    expect((session.user as Record<string, unknown>).permissions).toEqual(["member.view", "events.manage"]);
  });

  it("session callback defaults permissions to an empty list when absent", async () => {
    const session = await callbacks.session({
      session: { user: {} },
      token: { id: "user-6b" },
    });
    expect((session.user as Record<string, unknown>).id).toBe("user-6b");
    expect((session.user as Record<string, unknown>).permissions).toEqual([]);
  });

  it("session callback handles a session without a user", async () => {
    const session = await callbacks.session({
      session: {},
      token: { id: "user-7" },
    });
    expect(session).toEqual({});
  });
});
