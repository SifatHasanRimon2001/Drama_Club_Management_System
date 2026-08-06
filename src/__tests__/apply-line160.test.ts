import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("zod", async (importOriginal) => {
  const actual = await importOriginal<typeof import("zod")>();
  const wrappedParse = (target: { parse: (v: unknown) => unknown }) => {
    return (value: unknown) => {
      if (value && typeof value === "object" && "q1" in value) {
        throw new TypeError("boom");
      }
      return target.parse(value);
    };
  };
  const fakeZ = Object.assign({}, actual.z, {
    object: (shape: unknown, params?: unknown) => {
      const realSchema = actual.z.object(shape as never, params as never);
      return new Proxy(realSchema as object, {
        get(target: Record<string, unknown>, prop: string) {
          if (prop === "parse") {
            return wrappedParse(target as never);
          }
          return Reflect.get(target, prop, target);
        },
      });
    },
  });
  return { ...actual, z: fakeZ };
});

import { POST as APPLY_POST } from "@/app/api/registration-windows/[id]/apply/route";
import prisma from "@/lib/prisma";
import {
  mockRequest,
  cleanupTestData,
  seedPermissions,
  createTestDepartment,
  uniqueSuffix,
} from "./helpers";

describe("Apply route defensive rethrow", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rethrows non-Zod dynamic schema errors as 500", async () => {
    const dept = await createTestDepartment({});
    const rw = await prisma.registrationWindow.create({
      data: {
        title: "W",
        description: "d",
        startDate: new Date("2020-01-01"),
        endDate: new Date("2030-01-01"),
        status: "LIVE",
        formSchema: { fields: [{ name: "q1", type: "text" }] },
      },
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await APPLY_POST(
      mockRequest(`/api/registration-windows/${rw.id}/apply`, {
        method: "POST",
        body: {
          name: "A",
          email: `l160-${uniqueSuffix()}@test.com`,
          phone: "1",
          studentId: "S",
          departmentPrefs: [dept.id],
          customResponses: { q1: "x" },
        },
        headers: { "x-forwarded-for": `80.8.${Math.floor(Math.random() * 200) + 1}.1` },
      }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(res.status).toBe(500);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("handles windows without formSchema fields", async () => {
    const dept = await createTestDepartment({});
    const rw = await prisma.registrationWindow.create({
      data: {
        title: "W",
        description: "d",
        startDate: new Date("2020-01-01"),
        endDate: new Date("2030-01-01"),
        status: "LIVE",
        formSchema: { fields: null },
      },
    });
    const res = await APPLY_POST(
      mockRequest(`/api/registration-windows/${rw.id}/apply`, {
        method: "POST",
        body: {
          name: "A",
          email: `nf-${uniqueSuffix()}@test.com`,
          phone: "1",
          studentId: "S",
          departmentPrefs: [dept.id],
          customResponses: {},
        },
        headers: { "x-forwarded-for": `81.9.${Math.floor(Math.random() * 200) + 1}.1` },
      }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(res.status).toBe(201);
  });

  it("applies min-length validation to required text fields", async () => {
    const dept = await createTestDepartment({});
    const rw = await prisma.registrationWindow.create({
      data: {
        title: "W",
        description: "d",
        startDate: new Date("2020-01-01"),
        endDate: new Date("2030-01-01"),
        status: "LIVE",
        formSchema: {
          fields: [
            { name: "t1", type: "text", required: true, label: "First Name" },
            { name: "t2", type: "text", required: true },
          ],
        },
      },
    });
    const res = await APPLY_POST(
      mockRequest(`/api/registration-windows/${rw.id}/apply`, {
        method: "POST",
        body: {
          name: "A",
          email: `rt-${uniqueSuffix()}@test.com`,
          phone: "1",
          studentId: "S",
          departmentPrefs: [dept.id],
          customResponses: { t1: "Ada", t2: "Lovelace" },
        },
        headers: { "x-forwarded-for": `83.11.${Math.floor(Math.random() * 200) + 1}.1` },
      }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(res.status).toBe(201);
  });

  it("rejects empty required text fields", async () => {
    const dept = await createTestDepartment({});
    const rw = await prisma.registrationWindow.create({
      data: {
        title: "W",
        description: "d",
        startDate: new Date("2020-01-01"),
        endDate: new Date("2030-01-01"),
        status: "LIVE",
        formSchema: { fields: [{ name: "t1", type: "text", required: true }] },
      },
    });
    const res = await APPLY_POST(
      mockRequest(`/api/registration-windows/${rw.id}/apply`, {
        method: "POST",
        body: {
          name: "A",
          email: `emp-${uniqueSuffix()}@test.com`,
          phone: "1",
          studentId: "S",
          departmentPrefs: [dept.id],
          customResponses: { t1: "" },
        },
        headers: { "x-forwarded-for": `84.12.${Math.floor(Math.random() * 200) + 1}.1` },
      }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(res.status).toBe(400);
  });

  it("handles required checkbox fields", async () => {
    const dept = await createTestDepartment({});
    const rw = await prisma.registrationWindow.create({
      data: {
        title: "W",
        description: "d",
        startDate: new Date("2020-01-01"),
        endDate: new Date("2030-01-01"),
        status: "LIVE",
        formSchema: { fields: [{ name: "cb", type: "checkbox", required: true }] },
      },
    });
    const res = await APPLY_POST(
      mockRequest(`/api/registration-windows/${rw.id}/apply`, {
        method: "POST",
        body: {
          name: "A",
          email: `cb-${uniqueSuffix()}@test.com`,
          phone: "1",
          studentId: "S",
          departmentPrefs: [dept.id],
          customResponses: { cb: true },
        },
        headers: { "x-forwarded-for": `82.10.${Math.floor(Math.random() * 200) + 1}.1` },
      }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(res.status).toBe(201);
  });
});
