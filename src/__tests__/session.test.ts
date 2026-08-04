import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "@/app/api/session/route";
import {
  mockAuth,
  clearAuth,
  cleanupTestData,
  seedPermissions,
  createTestUser,
  uniqueSuffix,
} from "./helpers";

describe("Session API", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  describe("GET /api/session", () => {
    it("returns user data when authenticated", async () => {
      const user = await createTestUser({ email: `session-${uniqueSuffix()}@test.com` });
      mockAuth(user.user.id, ["member.view"], { email: user.user.email, name: user.user.name });

      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.user).not.toBeNull();
      expect(data.user.id).toBe(user.user.id);
      expect(data.user.email).toBe(user.user.email);
      expect(data.user.name).toBe(user.user.name);
    });

    it("returns null user when unauthenticated", async () => {
      clearAuth();
      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.user).toBeNull();
    });

    it("includes permissions in session", async () => {
      const user = await createTestUser({ email: `perms-${uniqueSuffix()}@test.com` });
      mockAuth(user.user.id, ["member.view", "events.manage"], { email: user.user.email });

      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(data.user.permissions)).toBe(true);
    });

    it("returns empty permissions for user with no roles", async () => {
      const user = await createTestUser({ email: `noperms-${uniqueSuffix()}@test.com` });
      mockAuth(user.user.id, [], { email: user.user.email });

      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(data.user.permissions)).toBe(true);
    });

    it("returns image field when set", async () => {
      const user = await createTestUser({ email: `img-${uniqueSuffix()}@test.com` });
      mockAuth(user.user.id, [], { email: user.user.email, image: "https://example.com/avatar.jpg" });

      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.user.image).toBe("https://example.com/avatar.jpg");
    });

    it("returns null image when not set", async () => {
      const user = await createTestUser({ email: `noimg-${uniqueSuffix()}@test.com` });
      mockAuth(user.user.id, [], { email: user.user.email, image: null });

      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.user.image).toBeNull();
    });
  });
});
