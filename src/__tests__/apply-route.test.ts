import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST as APPLY } from "@/app/api/registration-windows/[id]/apply/route";
import {
  mockRequest,
  cleanupTestData,
  seedPermissions,
  createTestDepartment,
  createTestCommittee,
  uniqueSuffix,
} from "./helpers";
import prisma from "@/lib/prisma";

/**
 * Deep coverage of POST /api/registration-windows/[id]/apply:
 * rate limiting, date-window enforcement, dynamic form schema validation,
 * duplicate detection, audit failure tolerance, and error paths.
 */
describe("Registration Apply POST — deep coverage", () => {
  let departmentId: string;

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
    const committee = await createTestCommittee({ isCurrent: true });
    const dept = await createTestDepartment({ committeeId: committee.id });
    departmentId = dept.id;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function createLiveWindow(overrides?: {
    startDate?: Date;
    endDate?: Date;
    formSchema?: Record<string, unknown>;
  }) {
    return prisma.registrationWindow.create({
      data: {
        title: `Window ${uniqueSuffix()}`,
        description: "desc",
        startDate: overrides?.startDate ?? new Date("2020-01-01"),
        endDate: overrides?.endDate ?? new Date("2030-01-01"),
        status: "LIVE",
        formSchema: (overrides?.formSchema ?? {}) as object,
      },
    });
  }

  function baseBody(email?: string, prefs: string[] = [departmentId]) {
    return {
      name: "Test Applicant",
      email: email ?? `apply-${uniqueSuffix()}@test.com`,
      phone: "1234567890",
      studentId: `STU${uniqueSuffix()}`,
      departmentPrefs: prefs,
    };
  }

  describe("Rate limiting", () => {
    it("returns 429 on the 4th application from the same IP", async () => {
      const rw = await createLiveWindow();
      const ip = `10.0.${Math.floor(Math.random() * 200) + 1}.1`;
      const emailBase = `ratelimit-${uniqueSuffix()}`;

      for (let i = 1; i <= 3; i++) {
        const res = await APPLY(
          mockRequest(`/api/registration-windows/${rw.id}/apply`, {
            method: "POST",
            body: baseBody(`${emailBase}-${i}@test.com`),
            headers: { "x-forwarded-for": ip },
          }),
          { params: Promise.resolve({ id: rw.id }) }
        );
        expect(res.status).toBe(201);
      }

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: baseBody(`${emailBase}-4@test.com`),
          headers: { "x-forwarded-for": ip },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(429);
    });

    it("resets the counter after the rate window expires (cleanup branch)", async () => {
      const rw = await createLiveWindow();
      const ip = `10.1.${Math.floor(Math.random() * 200) + 1}.1`;
      const emailBase = `cleanup-${uniqueSuffix()}`;

      vi.useFakeTimers({ toFake: ["Date"] });
      const t0 = Date.now();

      const res1 = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: baseBody(`${emailBase}-1@test.com`),
          headers: { "x-forwarded-for": ip },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res1.status).toBe(201);

      // Advance past the 5-minute cleanup interval (but keep the record
      // inside the 1-hour window) — exercises the cleanup loop.
      vi.setSystemTime(new Date(t0 + 6 * 60 * 1000));

      const res2 = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: baseBody(`${emailBase}-2@test.com`),
          headers: { "x-forwarded-for": ip },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res2.status).toBe(201);

      // Advance past the full 1-hour window: record expires and is deleted.
      vi.setSystemTime(new Date(t0 + 67 * 60 * 1000));

      const res3 = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: baseBody(`${emailBase}-3@test.com`),
          headers: { "x-forwarded-for": ip },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res3.status).toBe(201);

      // Rate limit again: 2 more allowed, 4th after reset is blocked
      for (let i = 4; i <= 5; i++) {
        vi.setSystemTime(new Date(t0 + 67 * 60 * 1000 + (i - 3) * 1000));
        const res = await APPLY(
          mockRequest(`/api/registration-windows/${rw.id}/apply`, {
            method: "POST",
            body: baseBody(`${emailBase}-${i}@test.com`),
            headers: { "x-forwarded-for": ip },
          }),
          { params: Promise.resolve({ id: rw.id }) }
        );
        expect(res.status).toBe(201);
      }

      vi.setSystemTime(new Date(t0 + 67 * 60 * 1000 + 4000));
      const blocked = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: baseBody(`${emailBase}-6@test.com`),
          headers: { "x-forwarded-for": ip },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(blocked.status).toBe(429);
    });
  });

  describe("Date window enforcement", () => {
    it("rejects applications before the window start date", async () => {
      const rw = await createLiveWindow({
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
      });

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: baseBody(),
          headers: { "x-forwarded-for": `10.2.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("allowed period");
    });

    it("rejects applications after the window end date", async () => {
      const rw = await createLiveWindow({
        startDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: baseBody(),
          headers: { "x-forwarded-for": `10.3.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(400);
    });
  });

  describe("Dynamic form schema validation (PRD §5)", () => {
    it("accepts custom responses matching required text field", async () => {
      const rw = await createLiveWindow({
        formSchema: {
          fields: [{ name: "experience", type: "text", required: true, label: "Experience" }],
        },
      });

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: {
            ...baseBody(),
            customResponses: { experience: "3 years" },
          },
          headers: { "x-forwarded-for": `10.4.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(201);
    });

    it("rejects empty value for required text field", async () => {
      const rw = await createLiveWindow({
        formSchema: {
          fields: [{ name: "experience", type: "text", required: true, label: "Experience" }],
        },
      });

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: {
            ...baseBody(),
            customResponses: { experience: "" },
          },
          headers: { "x-forwarded-for": `10.5.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Experience is required");
    });

    it("rejects missing required custom field", async () => {
      const rw = await createLiveWindow({
        formSchema: {
          fields: [{ name: "experience", type: "textarea", required: true, label: "Experience" }],
        },
      });

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: {
            ...baseBody(),
            customResponses: { other: "x" },
          },
          headers: { "x-forwarded-for": `10.6.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("accepts optional custom field that is missing", async () => {
      const rw = await createLiveWindow({
        formSchema: {
          fields: [{ name: "hobby", type: "text", required: false, label: "Hobby" }],
        },
      });

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: {
            ...baseBody(),
            customResponses: { unrelated: "y" },
          },
          headers: { "x-forwarded-for": `10.7.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(201);
    });

    it("validates select field against allowed options", async () => {
      const rw = await createLiveWindow({
        formSchema: {
          fields: [
            { name: "level", type: "select", required: true, options: ["beginner", "advanced"] },
          ],
        },
      });

      const bad = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: {
            ...baseBody(),
            customResponses: { level: "expert" },
          },
          headers: { "x-forwarded-for": `10.8.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(bad.status).toBe(400);

      const good = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: {
            ...baseBody(),
            customResponses: { level: "advanced" },
          },
          headers: { "x-forwarded-for": `10.9.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(good.status).toBe(201);
    });

    it("accepts any string for select without options", async () => {
      const rw = await createLiveWindow({
        formSchema: {
          fields: [{ name: "city", type: "select", required: false }],
        },
      });

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: {
            ...baseBody(),
            customResponses: { city: "Dhaka" },
          },
          headers: { "x-forwarded-for": `10.10.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(201);
    });

    it("accepts boolean for checkbox field", async () => {
      const rw = await createLiveWindow({
        formSchema: {
          fields: [{ name: "agree", type: "checkbox", required: true, label: "Agree" }],
        },
      });

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: {
            ...baseBody(),
            customResponses: { agree: true },
          },
          headers: { "x-forwarded-for": `10.11.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(201);
    });

    it("rejects non-boolean for checkbox field", async () => {
      const rw = await createLiveWindow({
        formSchema: {
          fields: [{ name: "agree", type: "checkbox", required: true }],
        },
      });

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: {
            ...baseBody(),
            customResponses: { agree: "yes" },
          },
          headers: { "x-forwarded-for": `10.12.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("rejects a missing required checkbox field", async () => {
      const rw = await createLiveWindow({
        formSchema: {
          fields: [{ name: "agree", type: "checkbox", required: true }],
        },
      });

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: {
            ...baseBody(),
            customResponses: {},
          },
          headers: { "x-forwarded-for": `10.18.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("rejects explicit false for a required checkbox field", async () => {
      const rw = await createLiveWindow({
        formSchema: {
          fields: [{ name: "agree", type: "checkbox", required: true }],
        },
      });

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: {
            ...baseBody(),
            customResponses: { agree: false },
          },
          headers: { "x-forwarded-for": `10.19.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      // A required checkbox must be checked: JSON cannot distinguish a missing
      // boolean from false, so the server requires the literal value true.
      expect(res.status).toBe(400);
    });

    it("accepts an absent optional checkbox field", async () => {
      const rw = await createLiveWindow({
        formSchema: {
          fields: [{ name: "optIn", type: "checkbox" }],
        },
      });

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: {
            ...baseBody(),
            customResponses: {},
          },
          headers: { "x-forwarded-for": `10.20.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(201);
    });

    it("coerces numeric strings for number field", async () => {
      const rw = await createLiveWindow({
        formSchema: {
          fields: [{ name: "age", type: "number", required: true }],
        },
      });

      const good = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: {
            ...baseBody(),
            customResponses: { age: "25" },
          },
          headers: { "x-forwarded-for": `10.13.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(good.status).toBe(201);

      const bad = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: {
            ...baseBody(),
            customResponses: { age: "not-a-number" },
          },
          headers: { "x-forwarded-for": `10.14.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(bad.status).toBe(400);
    });

    it("falls back to string schema for unknown field types", async () => {
      const rw = await createLiveWindow({
        formSchema: {
          fields: [{ name: "custom", type: "date" }],
        },
      });

      const bad = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: {
            ...baseBody(),
            customResponses: { custom: 12345 },
          },
          headers: { "x-forwarded-for": `10.15.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(bad.status).toBe(400);

      const good = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: {
            ...baseBody(),
            customResponses: { custom: "2026-01-01" },
          },
          headers: { "x-forwarded-for": `10.16.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(good.status).toBe(201);
    });

    it("ignores custom responses when formSchema has no fields", async () => {
      const rw = await createLiveWindow({ formSchema: {} });

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: {
            ...baseBody(),
            customResponses: { anything: "goes" },
          },
          headers: { "x-forwarded-for": `10.17.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(201);
    });

    it("submits without custom responses at all", async () => {
      const rw = await createLiveWindow({
        formSchema: {
          fields: [{ name: "extra", type: "text", required: false }],
        },
      });

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: baseBody(),
          headers: { "x-forwarded-for": `10.18.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(201);
    });

    it("stores custom responses on the applicant", async () => {
      const rw = await createLiveWindow({
        formSchema: {
          fields: [{ name: "experience", type: "text", required: true }],
        },
      });
      const email = `stored-${uniqueSuffix()}@test.com`;

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: {
            ...baseBody(email),
            actingExperience: "2 years",
            portfolioUrl: "https://example.com/portfolio",
            skills: ["acting", "singing"],
            customResponses: { experience: "5 years" },
          },
          headers: { "x-forwarded-for": `10.19.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(201);

      const applicant = await prisma.applicant.findFirst({ where: { email } });
      expect(applicant).not.toBeNull();
      expect(applicant!.customResponses).toEqual({ experience: "5 years" });
      expect(applicant!.actingExperience).toBe("2 years");
      expect(applicant!.skills).toEqual(["acting", "singing"]);
      expect(applicant!.portfolioUrl).toBe("https://example.com/portfolio");
    });
  });

  describe("Audit tolerance", () => {
    it("still returns 201 when audit logging fails", async () => {
      const rw = await createLiveWindow();
      const auditModule = await import("@/lib/audit");
      const auditSpy = vi.spyOn(auditModule, "logAudit").mockRejectedValueOnce(new Error("audit down"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: baseBody(),
          headers: { "x-forwarded-for": `10.20.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(201);
      expect(consoleSpy).toHaveBeenCalled();

      auditSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe("Error paths", () => {
    it("returns 500 when the database lookup fails", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const spy = vi
        .spyOn(prisma.registrationWindow, "findUnique")
        .mockRejectedValueOnce(new Error("db down"));

      const res = await APPLY(
        mockRequest("/api/registration-windows/x/apply", {
          method: "POST",
          body: baseBody(),
          headers: { "x-forwarded-for": `10.21.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: "x" }) }
      );
      expect(res.status).toBe(500);

      spy.mockRestore();
      consoleSpy.mockRestore();
    });

    it("returns 400 for malformed JSON body", async () => {
      const rw = await createLiveWindow();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const req = mockRequest(`/api/registration-windows/${rw.id}/apply`, {
        method: "POST",
        body: undefined,
        headers: { "x-forwarded-for": `10.22.${Math.floor(Math.random() * 200) + 1}.1` },
      });
      const res = await APPLY(req, { params: Promise.resolve({ id: rw.id }) });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid JSON body" });

      consoleSpy.mockRestore();
    });

    it("rejects invalid department preferences", async () => {
      const rw = await createLiveWindow();

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: {
            ...baseBody(undefined, ["cl00000000000000000000000"]),
          },
          headers: { "x-forwarded-for": `10.23.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid department preferences");
    });

    it("accepts valid department preferences", async () => {
      const committee = await createTestCommittee({ isCurrent: true });
      const dept = await createTestDepartment({ committeeId: committee.id });
      const rw = await createLiveWindow();

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: {
            ...baseBody(undefined, [dept.id]),
          },
          headers: { "x-forwarded-for": `10.24.${Math.floor(Math.random() * 200) + 1}.1` },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(201);

      const applicant = await prisma.applicant.findFirst({
        where: { registrationWindowId: rw.id },
        orderBy: { createdAt: "desc" },
      });
      expect(applicant!.departmentPrefs).toEqual([dept.id]);
    });
  });
});
