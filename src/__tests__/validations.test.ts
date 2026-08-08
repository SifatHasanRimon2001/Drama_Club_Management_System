import { describe, it, expect } from "vitest";
import {
  loginSchema,
  registerSchema,
  memberSchema,
  roleSchema,
  committeeSchema,
  departmentSchema,
  taskSchema,
  eventSchema,
  promotionRequestSchema,
  registrationWindowSchema,
  applicantSchema,
  galleryAlbumSchema,
  galleryItemSchema,
  contactSchema,
  settingsSchema,
  clubUpdateSchema,
} from "@/lib/validations";

describe("Validation Schemas", () => {
  describe("loginSchema", () => {
    it("accepts valid login", () => {
      expect(loginSchema.safeParse({ email: "test@test.com", password: "pass123" }).success).toBe(true);
    });

    it("rejects invalid email", () => {
      expect(loginSchema.safeParse({ email: "bad", password: "pass123" }).success).toBe(false);
    });

    it("rejects short password", () => {
      expect(loginSchema.safeParse({ email: "test@test.com", password: "12" }).success).toBe(false);
    });
  });

  describe("registerSchema", () => {
    it("accepts valid registration", () => {
      expect(registerSchema.safeParse({ name: "User", email: "u@test.com", password: "12345678" }).success).toBe(true);
    });

    it("rejects short password (< 8 chars)", () => {
      expect(registerSchema.safeParse({ name: "User", email: "u@test.com", password: "1234" }).success).toBe(false);
    });

    it("rejects missing name", () => {
      expect(registerSchema.safeParse({ email: "u@test.com", password: "12345678" }).success).toBe(false);
    });
  });

  describe("memberSchema", () => {
    it("accepts valid member", () => {
      expect(memberSchema.safeParse({ userId: "clx1234567890abcdefg", memberCode: "M001" }).success).toBe(true);
    });

    it("rejects invalid userId", () => {
      expect(memberSchema.safeParse({ userId: "not-cuid", memberCode: "M001" }).success).toBe(false);
    });

    it("rejects empty memberCode", () => {
      expect(memberSchema.safeParse({ userId: "clxyz123", memberCode: "" }).success).toBe(false);
    });
  });

  describe("roleSchema", () => {
    it("accepts valid role", () => {
      expect(roleSchema.safeParse({ name: "Admin" }).success).toBe(true);
    });

    it("rejects empty name", () => {
      expect(roleSchema.safeParse({ name: "" }).success).toBe(false);
    });
  });

  describe("committeeSchema", () => {
    it("accepts valid committee", () => {
      expect(committeeSchema.safeParse({ year: "2025", startDate: "2025-01-01T00:00:00.000Z" }).success).toBe(true);
    });

    it("rejects missing year", () => {
      expect(committeeSchema.safeParse({ startDate: "2025-01-01T00:00:00.000Z" }).success).toBe(false);
    });

    it("rejects invalid startDate", () => {
      expect(committeeSchema.safeParse({ year: "2025", startDate: "not-a-date" }).success).toBe(false);
    });
  });

  describe("departmentSchema", () => {
    it("accepts valid department", () => {
      expect(departmentSchema.safeParse({ name: "Acting", committeeId: "clx1234567890abcdefg" }).success).toBe(true);
    });

    it("rejects empty name", () => {
      expect(departmentSchema.safeParse({ name: "", committeeId: "clx1234567890abcdefg" }).success).toBe(false);
    });
  });

  describe("taskSchema", () => {
    it("accepts valid task", () => {
      expect(taskSchema.safeParse({ title: "Build set" }).success).toBe(true);
    });

    it("rejects empty title", () => {
      expect(taskSchema.safeParse({ title: "" }).success).toBe(false);
    });

    it("accepts valid status enum", () => {
      expect(taskSchema.safeParse({ title: "Task", status: "IN_PROGRESS" }).success).toBe(true);
    });

    it("rejects invalid status", () => {
      expect(taskSchema.safeParse({ title: "Task", status: "BLOCKED" }).success).toBe(false);
    });
  });

  describe("eventSchema", () => {
    it("accepts valid event", () => {
      expect(eventSchema.safeParse({
        title: "Workshop",
        type: "WORKSHOP",
        startAt: "2025-06-01T10:00:00.000Z",
      }).success).toBe(true);
    });

    it("rejects missing type", () => {
      expect(eventSchema.safeParse({
        title: "Workshop",
        startAt: "2025-06-01T10:00:00.000Z",
      }).success).toBe(false);
    });

    it("rejects invalid type", () => {
      expect(eventSchema.safeParse({
        title: "Workshop",
        type: "INVALID",
        startAt: "2025-06-01T10:00:00.000Z",
      }).success).toBe(false);
    });

    it("accepts all valid event types", () => {
      const types = ["WORKSHOP", "REHEARSAL", "PERFORMANCE", "AUDITION", "FESTIVAL", "TRAINING"];
      for (const type of types) {
        expect(eventSchema.safeParse({
          title: "Event",
          type,
          startAt: "2025-06-01T10:00:00.000Z",
        }).success).toBe(true);
      }
    });
  });

  describe("promotionRequestSchema", () => {
    it("accepts valid promotion", () => {
      expect(promotionRequestSchema.safeParse({
        memberId: "clx1234567890abcdefg",
        currentRoleId: "clx1234567890abcdefg",
        proposedRoleId: "clx1234567890abcdefg",
        reason: "Great work",
      }).success).toBe(true);
    });

    it("rejects empty reason", () => {
      expect(promotionRequestSchema.safeParse({
        memberId: "clx1234567890abcdefg",
        currentRoleId: "clx1234567890abcdefg",
        proposedRoleId: "clx1234567890abcdefg",
        reason: "",
      }).success).toBe(false);
    });
  });

  describe("registrationWindowSchema", () => {
    it("accepts valid window", () => {
      expect(registrationWindowSchema.safeParse({
        title: "Spring",
        description: "Spring registration",
        startDate: "2025-01-01T00:00:00.000Z",
        endDate: "2025-02-01T00:00:00.000Z",
      }).success).toBe(true);
    });

    it("rejects missing description", () => {
      expect(registrationWindowSchema.safeParse({
        title: "Spring",
        startDate: "2025-01-01T00:00:00.000Z",
        endDate: "2025-02-01T00:00:00.000Z",
      }).success).toBe(false);
    });
  });

  describe("applicantSchema", () => {
    it("accepts valid applicant", () => {
      expect(applicantSchema.safeParse({
        name: "Student",
        email: "s@test.com",
        phone: "1234567890",
        studentId: "STU001",
        departmentPrefs: ["dept1"],
      }).success).toBe(true);
    });

    it("rejects empty departmentPrefs", () => {
      expect(applicantSchema.safeParse({
        name: "Student",
        email: "s@test.com",
        phone: "1234567890",
        studentId: "STU001",
        departmentPrefs: [],
      }).success).toBe(false);
    });
  });

  describe("galleryAlbumSchema", () => {
    it("accepts valid album", () => {
      expect(galleryAlbumSchema.safeParse({
        name: "Show Photos",
        category: "PRODUCTIONS",
      }).success).toBe(true);
    });

    it("rejects invalid category", () => {
      expect(galleryAlbumSchema.safeParse({
        name: "Show Photos",
        category: "INVALID",
      }).success).toBe(false);
    });
  });

  describe("galleryItemSchema", () => {
    it("accepts valid item", () => {
      expect(galleryItemSchema.safeParse({
        albumId: "clx1234567890abcdefg",
        r2Key: "gallery/photo.jpg",
        fileName: "photo.jpg",
        type: "IMAGE",
      }).success).toBe(true);
    });

    it("rejects empty r2Key", () => {
      expect(galleryItemSchema.safeParse({
        albumId: "clx1234567890abcdefg",
        r2Key: "",
        fileName: "photo.jpg",
        type: "IMAGE",
      }).success).toBe(false);
    });
  });

  describe("contactSchema", () => {
    it("accepts valid contact", () => {
      expect(contactSchema.safeParse({
        name: "John",
        email: "j@test.com",
        message: "Hello, this is a message with enough chars",
      }).success).toBe(true);
    });

    it("rejects short message", () => {
      expect(contactSchema.safeParse({
        name: "John",
        email: "j@test.com",
        message: "Hi",
      }).success).toBe(false);
    });
  });

  describe("settingsSchema", () => {
    it("accepts valid settings", () => {
      expect(settingsSchema.safeParse({ clubName: "BRAC University Drama Club" }).success).toBe(true);
    });

    it("rejects invalid keys", () => {
      expect(settingsSchema.safeParse({ invalidKey: "value" }).success).toBe(false);
    });
  });

  describe("clubUpdateSchema", () => {
    it("accepts valid update", () => {
      expect(clubUpdateSchema.safeParse({
        title: "New Show",
        bodyRichText: "<p>We are performing!</p>",
        category: "ANNOUNCEMENT",
      }).success).toBe(true);
    });

    it("rejects missing bodyRichText", () => {
      expect(clubUpdateSchema.safeParse({
        title: "New Show",
        category: "ANNOUNCEMENT",
      }).success).toBe(false);
    });

    it("rejects invalid category", () => {
      expect(clubUpdateSchema.safeParse({
        title: "New Show",
        bodyRichText: "<p>Content</p>",
        category: "INVALID",
      }).success).toBe(false);
    });
  });
});
