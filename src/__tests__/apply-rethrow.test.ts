import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/registration-form", () => ({
  buildDynamicSchema: () => {
    throw "boom-not-an-error";
  },
}));

import { POST as APPLY } from "@/app/api/registration-windows/[id]/apply/route";
import { mockRequest, cleanupTestData, seedPermissions, createTestCommittee, createTestDepartment, uniqueSuffix } from "./helpers";
import prisma from "@/lib/prisma";

/**
 * Defensive path: if buildDynamicSchema ever throws a NON-Error value,
 * the route rethrows it into the outer handler which must return 500
 * (never crash the process or leak the raw value).
 */
describe("Apply route: non-Error schema builder failure -> 500", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 500 when the dynamic schema builder throws a non-Error", async () => {
    const committee = await createTestCommittee({ isCurrent: true });
    const dept = await createTestDepartment({ committeeId: committee.id });
    const rw = await prisma.registrationWindow.create({
      data: {
        title: `Rethrow ${uniqueSuffix()}`,
        description: "d",
        startDate: new Date("2020-01-01"),
        endDate: new Date("2030-01-01"),
        status: "LIVE",
        formSchema: { fields: [{ name: "why", type: "text" }] },
      },
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await APPLY(
      mockRequest(`/api/registration-windows/${rw.id}/apply`, {
        method: "POST",
        body: {
          name: "Rethrow Applicant",
          email: `rethrow-${uniqueSuffix()}@test.com`,
          phone: "1234567890",
          studentId: `RT${uniqueSuffix()}`,
          departmentPrefs: [dept.id],
        },
        headers: { "x-forwarded-for": `10.250.${Math.floor(Math.random() * 50) + 1}.1` },
      }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    consoleSpy.mockRestore();

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });
});
