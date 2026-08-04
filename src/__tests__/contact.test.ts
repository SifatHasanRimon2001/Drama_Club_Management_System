import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "@/app/api/contact/route";
import {
  mockRequest,
  cleanupTestData,
  seedPermissions,
  uniqueSuffix,
} from "./helpers";
import prisma from "@/lib/prisma";

describe("Contact Form API", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  describe("POST /api/contact", () => {
    it("submits a contact form", async () => {
      const res = await POST(
        mockRequest("/api/contact", {
          method: "POST",
          body: { name: "John", email: "john@test.com", message: "Hello, this is a test message" },
          headers: { "x-forwarded-for": `10.0.0.${uniqueSuffix().slice(-3)}` },
        })
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.message).toBe("Message received");

      const submission = await prisma.contactSubmission.findFirst({ where: { email: "john@test.com" } });
      expect(submission).not.toBeNull();
      expect(submission!.name).toBe("John");
    });

    it("rejects invalid email", async () => {
      const res = await POST(
        mockRequest("/api/contact", {
          method: "POST",
          body: { name: "Bad", email: "not-email", message: "Test message here" },
          headers: { "x-forwarded-for": `10.0.1.${uniqueSuffix().slice(-3)}` },
        })
      );
      expect(res.status).toBe(400);
    });

    it("rejects message too short", async () => {
      const res = await POST(
        mockRequest("/api/contact", {
          method: "POST",
          body: { name: "Short", email: "s@test.com", message: "Hi" },
          headers: { "x-forwarded-for": `10.0.2.${uniqueSuffix().slice(-3)}` },
        })
      );
      expect(res.status).toBe(400);
    });

    it("rejects message too long", async () => {
      const res = await POST(
        mockRequest("/api/contact", {
          method: "POST",
          body: { name: "Long", email: "l@test.com", message: "x".repeat(5001) },
          headers: { "x-forwarded-for": `10.0.3.${uniqueSuffix().slice(-3)}` },
        })
      );
      expect(res.status).toBe(400);
    });

    it("rejects missing name", async () => {
      const res = await POST(
        mockRequest("/api/contact", {
          method: "POST",
          body: { email: "no@test.com", message: "Valid message here" },
          headers: { "x-forwarded-for": `10.0.4.${uniqueSuffix().slice(-3)}` },
        })
      );
      expect(res.status).toBe(400);
    });

    it("rejects empty name", async () => {
      const res = await POST(
        mockRequest("/api/contact", {
          method: "POST",
          body: { name: "", email: "empty@test.com", message: "Valid message here" },
          headers: { "x-forwarded-for": `10.0.5.${uniqueSuffix().slice(-3)}` },
        })
      );
      expect(res.status).toBe(400);
    });

    it("rejects name too long", async () => {
      const res = await POST(
        mockRequest("/api/contact", {
          method: "POST",
          body: { name: "x".repeat(101), email: "long@test.com", message: "Valid message here" },
          headers: { "x-forwarded-for": `10.0.6.${uniqueSuffix().slice(-3)}` },
        })
      );
      expect(res.status).toBe(400);
    });

    it("accepts message at exact minimum length (10 chars)", async () => {
      const res = await POST(
        mockRequest("/api/contact", {
          method: "POST",
          body: { name: "Min", email: "min@test.com", message: "1234567890" },
          headers: { "x-forwarded-for": `10.0.7.${uniqueSuffix().slice(-3)}` },
        })
      );
      expect(res.status).toBe(201);
    });

    it("accepts message at exact maximum length (5000 chars)", async () => {
      const res = await POST(
        mockRequest("/api/contact", {
          method: "POST",
          body: { name: "Max", email: "max@test.com", message: "x".repeat(5000) },
          headers: { "x-forwarded-for": `10.0.8.${uniqueSuffix().slice(-3)}` },
        })
      );
      expect(res.status).toBe(201);
    });

    it("strips HTML tags from name", async () => {
      const res = await POST(
        mockRequest("/api/contact", {
          method: "POST",
          body: { name: "<script>alert('xss')</script>John", email: "strip@test.com", message: "Valid message here" },
          headers: { "x-forwarded-for": `10.0.9.${uniqueSuffix().slice(-3)}` },
        })
      );
      expect(res.status).toBe(201);

      const submission = await prisma.contactSubmission.findFirst({ where: { email: "strip@test.com" } });
      expect(submission!.name).not.toContain("<script>");
      expect(submission!.name).toContain("John");
    });

    it("strips HTML tags from message", async () => {
      const res = await POST(
        mockRequest("/api/contact", {
          method: "POST",
          body: { name: "HTML", email: "html@test.com", message: "<p>Hello</p> <b>World</b>" },
          headers: { "x-forwarded-for": `10.0.10.${uniqueSuffix().slice(-3)}` },
        })
      );
      expect(res.status).toBe(201);

      const submission = await prisma.contactSubmission.findFirst({ where: { email: "html@test.com" } });
      expect(submission!.message).not.toContain("<p>");
      expect(submission!.message).toContain("Hello");
    });

    it("rate limits after 5 submissions from same IP", async () => {
      const ip = `10.0.99.${uniqueSuffix().slice(-3)}`;
      for (let i = 0; i < 5; i++) {
        await POST(
          mockRequest("/api/contact", {
            method: "POST",
            body: { name: `User${i}`, email: `user${i}@test.com`, message: `Message ${i} is long enough` },
            headers: { "x-forwarded-for": ip },
          })
        );
      }

      const res = await POST(
        mockRequest("/api/contact", {
          method: "POST",
          body: { name: "Blocked", email: "block@test.com", message: "This should be rate limited" },
          headers: { "x-forwarded-for": ip },
        })
      );
      expect(res.status).toBe(429);
    });

    it("allows requests from different IPs after rate limit", async () => {
      const ip1 = `10.0.98.${uniqueSuffix().slice(-3)}`;
      const ip2 = `10.0.97.${uniqueSuffix().slice(-3)}`;
      for (let i = 0; i < 5; i++) {
        await POST(
          mockRequest("/api/contact", {
            method: "POST",
            body: { name: `User${i}`, email: `user${i}@test.com`, message: `Message ${i} is long enough` },
            headers: { "x-forwarded-for": ip1 },
          })
        );
      }

      const res = await POST(
        mockRequest("/api/contact", {
          method: "POST",
          body: { name: "Other", email: "other@test.com", message: "Different IP message" },
          headers: { "x-forwarded-for": ip2 },
        })
      );
      expect(res.status).toBe(201);
    });

    it("returns 400 for empty body", async () => {
      const res = await POST(
        mockRequest("/api/contact", {
          method: "POST",
          body: {},
          headers: { "x-forwarded-for": `10.0.11.${uniqueSuffix().slice(-3)}` },
        })
      );
      expect(res.status).toBe(400);
    });
  });
});
