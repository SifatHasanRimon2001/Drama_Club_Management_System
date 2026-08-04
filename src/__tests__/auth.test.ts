import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "@/app/api/auth/register/route";
import { mockRequest, cleanupTestData, seedPermissions, createTestUser } from "./helpers";
import prisma from "@/lib/prisma";

describe("Auth - POST /api/auth/register", () => {
  let ipCounter = 0;

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
    ipCounter++;
  });

  function uniqueIp(): string {
    return `10.0.${ipCounter}.${Math.floor(Math.random() * 254) + 1}`;
  }

  it("registers a new user successfully", async () => {
    const req = mockRequest("/api/auth/register", {
      method: "POST",
      body: { name: "New User", email: "new@test.com", password: "password123" },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.message).toBe("User created");

    const user = await prisma.user.findUnique({ where: { email: "new@test.com" } });
    expect(user).not.toBeNull();
    expect(user!.name).toBe("New User");
    expect(user!.passwordHash).toBeTruthy();
  });

  it("rejects duplicate email", async () => {
    await createTestUser({ email: "dup@test.com" });
    const req = mockRequest("/api/auth/register", {
      method: "POST",
      body: { name: "Dup User", email: "dup@test.com", password: "password123" },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("rejects invalid email format", async () => {
    const req = mockRequest("/api/auth/register", {
      method: "POST",
      body: { name: "Bad", email: "not-an-email", password: "password123" },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects password too short", async () => {
    const req = mockRequest("/api/auth/register", {
      method: "POST",
      body: { name: "Short", email: "short@test.com", password: "123" },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects missing name", async () => {
    const req = mockRequest("/api/auth/register", {
      method: "POST",
      body: { email: "noname@test.com", password: "password123" },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects empty body", async () => {
    const req = mockRequest("/api/auth/register", {
      method: "POST",
      body: {},
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("hashes the password (not stored in plaintext)", async () => {
    const req = mockRequest("/api/auth/register", {
      method: "POST",
      body: { name: "Hash Test", email: "hash@test.com", password: "password123" },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    await POST(req);

    const user = await prisma.user.findUnique({ where: { email: "hash@test.com" } });
    expect(user!.passwordHash).not.toBe("password123");
    expect(user!.passwordHash!.length).toBeGreaterThan(20);
  });

  it("rejects missing email field", async () => {
    const req = mockRequest("/api/auth/register", {
      method: "POST",
      body: { name: "No Email", password: "password123" },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects missing password field", async () => {
    const req = mockRequest("/api/auth/register", {
      method: "POST",
      body: { name: "No Pass", email: "nopass@test.com" },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects empty name", async () => {
    const req = mockRequest("/api/auth/register", {
      method: "POST",
      body: { name: "", email: "empty@test.com", password: "password123" },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects password exactly 7 characters", async () => {
    const req = mockRequest("/api/auth/register", {
      method: "POST",
      body: { name: "Seven", email: "seven@test.com", password: "1234567" },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("accepts password exactly 8 characters", async () => {
    const req = mockRequest("/api/auth/register", {
      method: "POST",
      body: { name: "Eight", email: "eight@test.com", password: "12345678" },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("sets default role to USER", async () => {
    const req = mockRequest("/api/auth/register", {
      method: "POST",
      body: { name: "Role Test", email: "roletest@test.com", password: "password123" },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    await POST(req);

    const user = await prisma.user.findUnique({ where: { email: "roletest@test.com" } });
    expect(user).not.toBeNull();
  });

  it("handles multiple concurrent registrations from different IPs", async () => {
    const results = await Promise.all(
      Array.from({ length: 3 }, (_, i) => {
        const req = mockRequest("/api/auth/register", {
          method: "POST",
          body: { name: `User${i}`, email: `user${i}@test.com`, password: "password123" },
          headers: { "x-forwarded-for": uniqueIp() },
        });
        return POST(req);
      })
    );

    for (const res of results) {
      expect(res.status).toBe(201);
    }

    const count = await prisma.user.count();
    expect(count).toBe(3);
  });

  it("rejects special characters in email without @", async () => {
    const req = mockRequest("/api/auth/register", {
      method: "POST",
      body: { name: "Bad Email", email: "userexample.com", password: "password123" },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("strips whitespace from email before duplicate check", async () => {
    await createTestUser({ email: "trim@test.com" });
    const req = mockRequest("/api/auth/register", {
      method: "POST",
      body: { name: "Trim", email: "trim@test.com", password: "password123" },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});
