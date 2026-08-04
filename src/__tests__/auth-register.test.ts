import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "@/app/api/auth/register/route";
import { mockRequest, cleanupTestData, seedPermissions, uniqueSuffix } from "./helpers";
import prisma from "@/lib/prisma";

describe("Auth Register API", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  describe("POST /api/auth/register", () => {
    it("registers a new user", async () => {
      const res = await POST(
        mockRequest("/api/auth/register", {
          method: "POST",
          body: { name: "New User", email: `reg-${uniqueSuffix()}@test.com`, password: "password123" },
          headers: { "x-forwarded-for": `11.0.0.${uniqueSuffix().slice(-3)}` },
        })
      );
      const data = await res.json();
      expect(res.status).toBe(201);
      expect(data.message).toBe("User created");
    });

    it("hashes the password", async () => {
      const email = `hash-${uniqueSuffix()}@test.com`;
      await POST(
        mockRequest("/api/auth/register", {
          method: "POST",
          body: { name: "Hash User", email, password: "mypassword" },
          headers: { "x-forwarded-for": `11.0.1.${uniqueSuffix().slice(-3)}` },
        })
      );
      const user = await prisma.user.findUnique({ where: { email } });
      expect(user).not.toBeNull();
      expect(user!.passwordHash).not.toBe("mypassword");
      expect(user!.passwordHash!.length).toBeGreaterThan(20);
    });

    it("rejects duplicate email", async () => {
      const email = `dup-${uniqueSuffix()}@test.com`;
      await POST(
        mockRequest("/api/auth/register", {
          method: "POST",
          body: { name: "First", email, password: "password123" },
          headers: { "x-forwarded-for": `11.0.2.${uniqueSuffix().slice(-3)}` },
        })
      );
      const res = await POST(
        mockRequest("/api/auth/register", {
          method: "POST",
          body: { name: "Second", email, password: "password123" },
          headers: { "x-forwarded-for": `11.0.3.${uniqueSuffix().slice(-3)}` },
        })
      );
      expect(res.status).toBe(409);
    });

    it("rejects invalid email", async () => {
      const res = await POST(
        mockRequest("/api/auth/register", {
          method: "POST",
          body: { name: "Bad", email: "not-email", password: "password123" },
          headers: { "x-forwarded-for": `11.0.4.${uniqueSuffix().slice(-3)}` },
        })
      );
      expect(res.status).toBe(400);
    });

    it("rejects short password", async () => {
      const res = await POST(
        mockRequest("/api/auth/register", {
          method: "POST",
          body: { name: "Short", email: `short-${uniqueSuffix()}@test.com`, password: "123" },
          headers: { "x-forwarded-for": `11.0.5.${uniqueSuffix().slice(-3)}` },
        })
      );
      expect(res.status).toBe(400);
    });

    it("rejects missing name", async () => {
      const res = await POST(
        mockRequest("/api/auth/register", {
          method: "POST",
          body: { email: `noname-${uniqueSuffix()}@test.com`, password: "password123" },
          headers: { "x-forwarded-for": `11.0.6.${uniqueSuffix().slice(-3)}` },
        })
      );
      expect(res.status).toBe(400);
    });

    it("rejects empty body", async () => {
      const res = await POST(
        mockRequest("/api/auth/register", {
          method: "POST",
          body: {},
          headers: { "x-forwarded-for": `11.0.7.${uniqueSuffix().slice(-3)}` },
        })
      );
      expect(res.status).toBe(400);
    });

    it("rate limits after 3 registrations from same IP", async () => {
      const ip = `11.0.99.${uniqueSuffix().slice(-3)}`;
      for (let i = 0; i < 3; i++) {
        await POST(
          mockRequest("/api/auth/register", {
            method: "POST",
            body: { name: `User${i}`, email: `rate${i}-${uniqueSuffix()}@test.com`, password: "password123" },
            headers: { "x-forwarded-for": ip },
          })
        );
      }
      const res = await POST(
        mockRequest("/api/auth/register", {
          method: "POST",
          body: { name: "Blocked", email: `blocked-${uniqueSuffix()}@test.com`, password: "password123" },
          headers: { "x-forwarded-for": ip },
        })
      );
      expect(res.status).toBe(429);
    });

    it("allows registration from different IP after rate limit", async () => {
      const ip1 = `11.0.97.${uniqueSuffix().slice(-3)}`;
      const ip2 = `11.0.96.${uniqueSuffix().slice(-3)}`;
      for (let i = 0; i < 3; i++) {
        await POST(
          mockRequest("/api/auth/register", {
            method: "POST",
            body: { name: `User${i}`, email: `diff${i}-${uniqueSuffix()}@test.com`, password: "password123" },
            headers: { "x-forwarded-for": ip1 },
          })
        );
      }
      const res = await POST(
        mockRequest("/api/auth/register", {
          method: "POST",
          body: { name: "Other", email: `other-${uniqueSuffix()}@test.com`, password: "password123" },
          headers: { "x-forwarded-for": ip2 },
        })
      );
      expect(res.status).toBe(201);
    });

    it("accepts 8-char password (exact minimum)", async () => {
      const res = await POST(
        mockRequest("/api/auth/register", {
          method: "POST",
          body: { name: "Min Pass", email: `minpass-${uniqueSuffix()}@test.com`, password: "12345678" },
          headers: { "x-forwarded-for": `11.0.8.${uniqueSuffix().slice(-3)}` },
        })
      );
      expect(res.status).toBe(201);
    });
  });
});
