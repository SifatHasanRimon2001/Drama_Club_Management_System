import {
  test,
  expect,
  request,
  type APIRequestContext,
} from "@playwright/test";

/**
 * DCMS E2E — API-level smoke through a live server.
 *
 * Performs a REAL NextAuth credentials login against the running server and
 * exercises the PRD smoke-checklist workflows end-to-end. This is the layer
 * that covers src/lib/auth.ts (NextAuth) which unit tests must mock.
 *
 * Requires a seeded database (admin@dcms.local / admin123).
 */

const BASE = "http://127.0.0.1:3310";
const ADMIN_EMAIL = "admin@dcms.local";
const ADMIN_PASSWORD = "admin123";

function uniq() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Login on a FRESH context so cookies never leak between tests. */
async function login(
  ctx: APIRequestContext,
  email: string,
  password: string,
): Promise<void> {
  const csrfRes = await ctx.get(`${BASE}/api/auth/csrf`);
  expect(csrfRes.ok()).toBeTruthy();
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const loginRes = await ctx.post(`${BASE}/api/auth/callback/credentials`, {
    form: { csrfToken, email, password, redirect: "false" },
  });
  expect([200, 302]).toContain(loginRes.status());
}

/** Returns a brand-new request context that is already authenticated as admin. */
async function authedAsAdmin(): Promise<APIRequestContext> {
  const c = await request.newContext({ baseURL: BASE });
  await login(c, ADMIN_EMAIL, ADMIN_PASSWORD);
  return c;
}

test("Server is up", async () => {
  const res = await request.newContext().then(async (c) => {
    const r = await c.get(`${BASE}/`);
    await c.dispose();
    return r;
  });
  expect(res.status()).toBe(200);
});

test.describe("Public routes (no auth)", () => {
  const routes = [
    "/api/public/home",
    "/api/public/about",
    "/api/public/committee",
    "/api/public/departments",
    "/api/public/events",
    "/api/public/productions",
    "/api/public/updates",
    "/api/public/gallery",
    "/api/public/recruitment",
  ];
  for (const route of routes) {
    test(`GET ${route} -> 200`, async () => {
      const ctx = await request.newContext({ baseURL: BASE });
      const res = await ctx.get(`${BASE}${route}`);
      expect(res.status()).toBe(200);
      await ctx.dispose();
    });
  }

  test("Public recruitment lists live windows", async () => {
    const ctx = await request.newContext({ baseURL: BASE });
    const res = await ctx.get(`${BASE}/api/public/recruitment`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    // Shape is a top-level array of windows
    expect(Array.isArray(body)).toBe(true);
    await ctx.dispose();
  });

  test("Public events never return drafts", async () => {
    const ctx = await request.newContext({ baseURL: BASE });
    const res = await ctx.get(`${BASE}/api/public/events`);
    const body = await res.json();
    for (const ev of body.events ?? []) {
      expect(ev.status).not.toBe("DRAFT");
    }
    await ctx.dispose();
  });
});

test.describe("Authenticated via real NextAuth login", () => {
  test("Login succeeds and session reflects admin permissions", async () => {
    const ctx = await authedAsAdmin();
    const sess = await ctx.get(`${BASE}/api/session`);
    expect(sess.status()).toBe(200);
    const body = await sess.json();
    expect(body.user).toBeDefined();
    expect(Array.isArray(body.user?.permissions)).toBe(true);
    expect(body.user.permissions).toContain("permissions.manage");
    await ctx.dispose();
  });

  test("Members list requires member.view and returns data", async () => {
    const ctx = await authedAsAdmin();
    const res = await ctx.get(`${BASE}/api/members`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.members)).toBe(true);
    await ctx.dispose();
  });

  test("Unauthenticated protected endpoint → 401", async () => {
    const fresh = await request.newContext({ baseURL: BASE });
    const res = await fresh.get(`${BASE}/api/members`);
    expect(res.status()).toBe(401);
    await fresh.dispose();
  });

  test("Invalid enum filter → 400 (not a crash)", async () => {
    const ctx = await authedAsAdmin();
    const res = await ctx.get(`${BASE}/api/members?status=BOGUS`);
    expect(res.status()).toBe(400);
    await ctx.dispose();
  });

  test("Wrong password is rejected by NextAuth", async () => {
    // Don't auto-follow redirects: a failed credentials attempt 302-redirects to
    // /login (which 404s in this API-only app), so following would yield 404.
    const ctx = await request.newContext({ baseURL: BASE });
    const csrfRes = await ctx.get(`${BASE}/api/auth/csrf`);
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
    const res = await ctx.post(`${BASE}/api/auth/callback/credentials`, {
      form: {
        csrfToken,
        email: ADMIN_EMAIL,
        password: "definitely-wrong",
        redirect: "false",
      },
    });
    // A failed credentials attempt must not create a session regardless of
    // whether NextAuth responds 200, 302, or follows to a 404.
    const sess = await ctx.get(`${BASE}/api/session`);
    expect((await sess.json()).user).toBeNull();
    await ctx.dispose();
  });
});

test.describe("Registration -> applicant -> accept -> member lifecycle", () => {
  test("Runs the whole conversion flow against the live DB", async () => {
    const ctx = await authedAsAdmin();

    // Create a LIVE registration window
    const start = new Date(Date.now() - 86400000).toISOString();
    const end = new Date(Date.now() + 86400000 * 7).toISOString();
    const rwRes = await ctx.post(`${BASE}/api/registration-windows`, {
      data: {
        title: `E2E Window ${uniq()}`,
        description: "E2E",
        startDate: start,
        endDate: end,
        status: "LIVE",
      },
    });
    expect(rwRes.status()).toBe(201);
    const rw = await rwRes.json();

    // A real department id is required by applicantSchema (min 1 preference)
    const deptsRes = await ctx.get(`${BASE}/api/departments`);
    const departments = (await deptsRes.json()) as { id: string }[];
    const deptId = departments[0].id;

    // Public submit as applicant (no auth needed)
    const email = `e2e-${uniq()}@test.com`;
    const applyRes = await ctx.post(
      `${BASE}/api/registration-windows/${rw.id}/apply`,
      {
        data: {
          name: "E2E Applicant",
          email,
          phone: "1234567890",
          studentId: `S-${uniq()}`,
          departmentPrefs: [deptId],
          skills: ["Acting"],
        },
      },
    );
    expect(applyRes.status()).toBe(201);
    const app = (await applyRes.json()) as { id: string };

    // Find the applicant (admin)
    const list = await ctx.get(`${BASE}/api/applicants?windowId=${rw.id}`);
    const { applicants } = (await list.json()) as {
      applicants: { id: string }[];
    };
    const record = applicants.find((a) => a.id === app.id);
    expect(record).toBeDefined();

    // Accept
    const acceptRes = await ctx.patch(`${BASE}/api/applicants/${app.id}`, {
      data: { status: "ACCEPTED" },
    });
    expect(acceptRes.status()).toBe(200);

    // Convert to member
    const convertRes = await ctx.post(
      `${BASE}/api/applicants/${app.id}/convert`,
      { data: {} },
    );
    expect([200, 201]).toContain(convertRes.status());
    await ctx.dispose();
  });

  test("Duplicate application rejected with 409", async () => {
    const ctx = await authedAsAdmin();
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 86400000 * 7).toISOString();
    const rwRes = await ctx.post(`${BASE}/api/registration-windows`, {
      data: {
        title: `E2E Dup Window ${uniq()}`,
        description: "E2E",
        startDate: start,
        endDate: end,
        status: "LIVE",
      },
    });
    const rw = await rwRes.json();
    const deptsRes = await ctx.get(`${BASE}/api/departments`);
    const departments = (await deptsRes.json()) as { id: string }[];
    const deptId = departments[0].id;
    const email = `dup-${uniq()}@test.com`;
    const payload = {
      name: "Dup Applicant",
      email,
      phone: "1",
      studentId: `S-${uniq()}`,
      departmentPrefs: [deptId],
      skills: [],
    };
    const first = await ctx.post(
      `${BASE}/api/registration-windows/${rw.id}/apply`,
      { data: payload },
    );
    expect(first.status()).toBe(201);
    const second = await ctx.post(
      `${BASE}/api/registration-windows/${rw.id}/apply`,
      { data: payload },
    );
    expect(second.status()).toBe(409);
    await ctx.dispose();
  });
});

test.describe("Contact form (public, rate-limited)", () => {
  test("Valid submission -> 201", async () => {
    const ctx = await request.newContext({ baseURL: BASE });
    const res = await ctx.post(`${BASE}/api/contact`, {
      data: {
        name: "E2E",
        email: `c-${uniq()}@test.com`,
        message: "This is an e2e contact message body.",
      },
    });
    expect(res.status()).toBe(201);
    await ctx.dispose();
  });

  test("Invalid submission -> 400", async () => {
    const ctx = await request.newContext({ baseURL: BASE });
    const res = await ctx.post(`${BASE}/api/contact`, {
      data: { name: "E2E", email: "not-an-email", message: "short" },
    });
    expect(res.status()).toBe(400);
    await ctx.dispose();
  });
});
