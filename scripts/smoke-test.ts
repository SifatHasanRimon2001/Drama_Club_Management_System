/**
 * DCMS End-to-End API Smoke Test
 *
 * Requires:
 *  - The Next.js dev server (or build+start) running on the BASE_URL below.
 *  - A seeded database (npm run db:seed).
 *
 * Run: npx tsx scripts/smoke-test.ts
 *
 * Exit code 0 = all checks passed, 1 = one or more failures.
 */
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_EMAIL = "admin@dcms.local";
const ADMIN_PASSWORD = "admin123";
const DEMO_EMAIL = "demo@dcms.local";
const DEMO_PASSWORD = "demo123";

let cookie = "";
let adminUserId = "";
let convertedMemberId = "";
let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    failures.push(name + (detail ? ` — ${detail}` : ""));
    console.log(`  ❌ ${name} ${detail ? `— ${detail}` : ""}`);
  }
}

async function req(
  path: string,
  opts: { method?: string; body?: unknown; form?: boolean; cookie?: string } = {}
) {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers["cookie"] = opts.cookie;
  let body: string | undefined;
  if (opts.body !== undefined) {
    if (opts.form) {
      headers["content-type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(opts.body as Record<string, string>).toString();
    } else {
      headers["content-type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method || "GET",
    headers,
    body,
    redirect: "manual",
  });
  let json: unknown = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, text, headers: res.headers };
}

function extractSetCookie(headers: Headers): string {
  const setCookies = headers.getSetCookie ? headers.getSetCookie() : [];
  const combined = setCookies
    .map((c) => c.split(";")[0])
    .filter((c) => c.startsWith("authjs"))
    .join("; ");
  return combined;
}

async function login(email: string, password: string): Promise<string> {
  // Fetch CSRF token AND persist the authjs csrf/callback cookies in a jar
  // so the subsequent credentials POST passes NextAuth's CSRF validation.
  const csrfRes = await req("/api/auth/csrf");
  const csrfToken = (csrfRes.json as { csrfToken?: string })?.csrfToken || "";
  const csrfCookies = extractSetCookie(csrfRes.headers);

  const loginRes = await req("/api/auth/callback/credentials", {
    method: "POST",
    form: true,
    cookie: csrfCookies,
    body: { csrfToken, email, password, redirect: "false" },
  });
  return extractSetCookie(loginRes.headers);
}

function uuid() {
  return Math.random().toString(36).slice(2, 10);
}

async function main() {
  console.log(`\n🧪 DCMS API smoke test against ${BASE_URL}\n`);

  // --- Health check ---
  const root = await req("/");
  check("Server is up (GET /)", root.status === 200);

  // --- Public endpoints (no auth) ---
  const publicRoutes = [
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
  for (const route of publicRoutes) {
    const r = await req(route);
    check(`Public GET ${route} → ${r.status}`, r.status === 200);
  }

  // Public apply endpoint requires a window id — check a LIVE window via recruitment
  const recruitment = await req("/api/public/recruitment");
  const windows = (recruitment.json as { id?: string }[]) || [];
  const liveWindow = windows.find((w) => w.id) || null;

  // --- Anonymous must be rejected on protected routes ---
  const anonMembers = await req("/api/members");
  check("Anonymous /api/members → 401", anonMembers.status === 401);

  // --- Admin login ---
  cookie = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  check("Admin login succeeds", cookie.length > 0);

  const session = await req("/api/session", { cookie });
  const sessionUser = (session.json as { user?: { id?: string; permissions?: string[] } })?.user;
  adminUserId = sessionUser?.id || "";
  check("Admin session has id", !!adminUserId);
  check(
    "Admin session has all 16 permissions",
    !!sessionUser?.permissions && sessionUser.permissions.length >= 16,
    `got ${sessionUser?.permissions?.length}`
  );

  // --- Members ---
  const membersRes = await req("/api/members?limit=50", { cookie });
  const members = (membersRes.json as { members?: { id: string; userId: string; status: string }[] })?.members || [];
  check("Admin GET /api/members → 200", membersRes.status === 200, `got ${membersRes.status}`);
  check("Seeded members exist (admin + demo)", members.length >= 2, `got ${members.length}`);

  const demoMember = members.find((m) => m.status === "ACTIVE");
  check("Member records have userId", demoMember?.userId ? true : members.every((m) => m.userId));

  // --- Permissions ---
  const permsRes = await req("/api/permissions", { cookie });
  const perms = (permsRes.json as { key?: string }[]) || [];
  check("GET /api/permissions returns 16 keys", perms.length >= 16, `got ${perms.length}`);
  check(
    "Permission keys match PRD §3a",
    ["member.view", "promotion.approve", "settings.manage", "updates.publish"].every((k) =>
      perms.some((p) => p.key === k)
    )
  );

  // --- Roles CRUD + audit ---
  const roleName = `Test Role ${uuid()}`;
  const rolePermIds = perms.slice(0, 3).map((p) => (p as { id: string }).id);
  const roleRes = await req("/api/roles", {
    cookie,
    method: "POST",
    body: { name: roleName, description: "Smoke test role", permissionIds: rolePermIds },
  });
  const role = (roleRes.json as { id?: string; name?: string }) || {};
  check("POST /api/roles creates role", roleRes.status === 201 && !!role.id, `got ${roleRes.status}`);
  check("Role has permissions attached", (role as { permissions?: unknown[] }).permissions?.length === rolePermIds.length);

  const roleId = role.id || "";
  if (roleId) {
    const roleGet = await req(`/api/roles/${roleId}`, { cookie });
    check("GET /api/roles/:id", roleGet.status === 200);
    const rolePatch = await req(`/api/roles/${roleId}`, {
      cookie,
      method: "PATCH",
      body: { description: "Updated description", permissionIds: [] },
    });
    check("PATCH /api/roles/:id (replace permissions)", rolePatch.status === 200);
  }

  // --- Audit log written on role creation ---
  const adminDashboard = await req("/api/dashboard/admin", { cookie });
  check("Admin dashboard → 200", adminDashboard.status === 200);
  const dash = adminDashboard.json as {
    members?: { total?: number; byStatus?: Record<string, number> };
    pendingPromotions?: { count?: number };
    upcomingEvents?: unknown[];
  };
  check("Dashboard member stats are real", typeof dash.members?.total === "number" && (dash.members.total as number) >= 2);
  check("Dashboard has byStatus breakdown", typeof dash.members?.byStatus === "object" && dash.members.byStatus !== null);

  // --- Departments + tasks ---
  const deptsRes = await req("/api/departments", { cookie });
  const depts = (deptsRes.json as { id: string; name: string }[]) || [];
  check("GET /api/departments → 200 with data", deptsRes.status === 200 && depts.length >= 3, `got ${depts.length}`);

  const deptId = depts[0]?.id;
  if (deptId) {
    const deptRes = await req(`/api/departments/${deptId}`, { cookie });
    check("GET /api/departments/:id", deptRes.status === 200);
    const taskRes = await req(`/api/departments/${deptId}/tasks`, { cookie });
    check("GET department tasks", taskRes.status === 200);
    const taskCreate = await req(`/api/departments/${deptId}/tasks`, {
      cookie,
      method: "POST",
      body: { title: `Smoke task ${uuid()}`, description: "created by smoke test" },
    });
    const task = taskCreate.json as { id?: string };
    check("POST department task", taskCreate.status === 201 && !!task.id);
    if (task.id) {
      const taskPatch = await req(`/api/departments/${deptId}/tasks/${task.id}`, {
        cookie,
        method: "PATCH",
        body: { status: "IN_PROGRESS" },
      });
      check("PATCH department task", taskPatch.status === 200);
      const taskDel = await req(`/api/departments/${deptId}/tasks/${task.id}`, {
        cookie,
        method: "DELETE",
      });
      check("DELETE department task", taskDel.status === 200);
    }
  }

  // --- Committees ---
  const committeesRes = await req("/api/committees?all=true", { cookie });
  const committees = (committeesRes.json as { id?: string; isCurrent?: boolean }[]) || [];
  check("GET /api/committees?all=true → 200", committeesRes.status === 200);
  check("Current committee exists", committees.some((c) => c.isCurrent));

  // --- Registration full loop (apply → accept → convert) ---
  if (liveWindow) {
    const windowId = liveWindow.id!;
    const email = `applicant-${uuid()}@smoke.test`;
    const applyRes = await req(`/api/registration-windows/${windowId}/apply`, {
      method: "POST",
      body: {
        name: "Smoke Applicant",
        email,
        phone: "+1000000000",
        studentId: `S-${uuid().toUpperCase()}`,
        departmentPrefs: [deptId].filter(Boolean),
        skills: ["acting"],
        actingExperience: "2 years",
        customResponses: { whyJoin: "To learn", experience: "School plays" },
      },
    });
    check("Public apply to LIVE window → 201", applyRes.status === 201, `got ${applyRes.status} ${applyRes.text.slice(0, 120)}`);

    const applicantId = (applyRes.json as { id?: string })?.id;
    if (applicantId) {
      // duplicate application blocked (same valid body as the first request)
      const dupRes = await req(`/api/registration-windows/${windowId}/apply`, {
        method: "POST",
        body: {
          name: "Smoke Applicant",
          email,
          phone: "+1000000000",
          studentId: `S-${uuid().toUpperCase()}`,
          departmentPrefs: [deptId].filter(Boolean),
          skills: [],
          customResponses: { whyJoin: "To learn", experience: "School plays" },
        },
      });
      check("Duplicate application → 409", dupRes.status === 409);

      const applicantsRes = await req(`/api/registration-windows/${windowId}/applicants`, { cookie });
      check("Admin list window applicants", applicantsRes.status === 200);

      const acceptRes = await req(`/api/registration-windows/${windowId}/applicants/${applicantId}`, {
        cookie,
        method: "PATCH",
        body: { status: "ACCEPTED" },
      });
      check("Admin accepts applicant", acceptRes.status === 200, `got ${acceptRes.status}`);

      const convertRes = await req(`/api/applicants/${applicantId}/convert`, {
        cookie,
        method: "POST",
        body: { password: "TempPass123!" },
      });
      check("Convert applicant → member", convertRes.status === 200, `got ${convertRes.status} ${convertRes.text.slice(0, 120)}`);
      convertedMemberId = (convertRes.json as { member?: { id?: string } })?.member?.id || "";

      // Double conversion must fail
      const reconvertRes = await req(`/api/applicants/${applicantId}/convert`, {
        cookie,
        method: "POST",
        body: { password: "TempPass123!" },
      });
      check("Re-convert blocked → 409", reconvertRes.status === 409);
    }
  } else {
    check("LIVE registration window exists (seeded)", false, "no LIVE window found in public recruitment");
  }

  // --- Promotion workflow ---
  const rolesRes = await req("/api/roles", { cookie });
  const allRoles = (rolesRes.json as { id: string; name: string }[]) || [];
  const memberRole = allRoles.find((r) => r.name === "Member");
  const adminRole = allRoles.find((r) => r.name === "Admin");
  const currentCommittee = committees.find((c) => c.isCurrent) || null;

  // Use the freshly-converted applicant as a DISPOSABLE promotion target so
  // the demo user's permissions are never mutated (keeps the test re-runnable
  // and the later "demo blocked" assertion valid).
  const promoTarget = convertedMemberId || members.find((m) => m.id !== undefined)?.id || "";

  if (memberRole && adminRole && promoTarget && currentCommittee) {
    // Give the target the Member role on the current committee so the
    // promotion has a real currentRole to replace.
    const assignRes = await req(`/api/committees/${currentCommittee.id}/roles`, {
      cookie,
      method: "POST",
      body: { memberId: promoTarget, roleId: memberRole.id },
    });
    check("Assign Member role to promotion target", assignRes.status === 201, `got ${assignRes.status}`);

    const promoCreate = await req("/api/promotions", {
      cookie,
      method: "POST",
      body: {
        memberId: promoTarget,
        currentRoleId: memberRole.id,
        proposedRoleId: adminRole.id,
        reason: "Smoke test promotion",
        achievements: "Led a workshop",
      },
    });
    const promo = promoCreate.json as { id?: string; status?: string };
    check("POST /api/promotions creates DRAFT", promoCreate.status === 201 && promo?.status === "DRAFT");

    if (promo.id) {
      const submitRes = await req(`/api/promotions/${promo.id}/submit`, { cookie, method: "POST" });
      check("Submit promotion → SUBMITTED", submitRes.status === 200 && (submitRes.json as { status?: string })?.status === "SUBMITTED");

      const decisionRes = await req(`/api/promotions/${promo.id}/decision`, {
        cookie,
        method: "POST",
        body: { status: "APPROVED" },
      });
      const decisionBody = decisionRes.json as { status?: string };
      check("Approve promotion", decisionRes.status === 200 && decisionBody?.status === "APPROVED", `got ${decisionRes.status} ${decisionRes.text.slice(0, 100)}`);

      // Approved promotion should have created a CommitteeMemberRole — verify via member GET
      if (decisionBody?.status === "APPROVED") {
        const memberDetail = await req(`/api/members/${promoTarget}`, { cookie });
        const memberDetailBody = memberDetail.json as {
          committeeRoles?: { roleId: string; endedAt: string | null }[];
        };
        const rolesForMember = memberDetailBody?.committeeRoles || [];
        const hasProposed = rolesForMember.some(
          (cr) => cr.roleId === adminRole.id && cr.endedAt === null
        );
        const oldRoleExists = rolesForMember.some(
          (cr) => cr.roleId === memberRole.id
        );
        check("Approved promotion created new role", hasProposed);
        check("Old role preserved as history", oldRoleExists && rolesForMember.length >= 2);
      }

      // Re-approving must fail
      const reDecision = await req(`/api/promotions/${promo.id}/decision`, {
        cookie,
        method: "POST",
        body: { status: "REJECTED" },
      });
      check("Decision on non-reviewable state → 400", reDecision.status === 400);
    }
  } else {
    check("Promotion workflow prerequisites", false, `memberRole=${!!memberRole} adminRole=${!!adminRole} target=${!!promoTarget} committee=${!!currentCommittee}`);
  }

  // --- Events & Updates (admin write, public read) ---
  const evtRes = await req("/api/events", {
    cookie,
    method: "POST",
    body: {
      title: `Smoke Event ${uuid()}`,
      type: "WORKSHOP",
      startAt: new Date(Date.now() + 7 * 864e5).toISOString(),
      endAt: new Date(Date.now() + 7 * 864e5 + 3600e3).toISOString(),
      location: "Smoke Room",
      description: "created by smoke test",
    },
  });
  const evt = evtRes.json as { id?: string; status?: string };
  check("POST /api/events (events.manage)", evtRes.status === 201 && evt?.status === "UPCOMING", `got ${evtRes.status}`);

  const updRes = await req("/api/updates", {
    cookie,
    method: "POST",
    body: {
      title: `Smoke Update ${uuid()}`,
      bodyRichText: "<p>Published by smoke test.</p>",
      category: "ANNOUNCEMENT",
    },
  });
  const upd = updRes.json as { id?: string; publishedAt?: string | null };
  check("POST /api/updates (updates.publish)", updRes.status === 201 && !!upd?.publishedAt, `got ${updRes.status}`);

  if (evt?.id) {
    const publicEvent = await req(`/api/events/${evt.id}`);
    check("Public sees created event", publicEvent.status === 200);
  }
  if (upd?.id) {
    const publicUpdate = await req(`/api/updates/${upd.id}`);
    check("Public sees published update", publicUpdate.status === 200);
  }

  // Draft update must be hidden from public
  const draftRes = await req("/api/updates", {
    cookie,
    method: "POST",
    body: {
      title: `Draft Update ${uuid()}`,
      bodyRichText: "<p>Should not be public.</p>",
      category: "NOTICE",
      publishedAt: null as unknown as string,
    },
  });
  const draft = draftRes.json as { id?: string };
  if (draft?.id) {
    const publicDraft = await req(`/api/updates/${draft.id}`);
    check("Draft update hidden from public → 404", publicDraft.status === 404);
  }

  // --- Gallery (upload-url requires R2; expect graceful error if not configured) ---
  const uploadUrlRes = await req("/api/gallery/upload-url", {
    cookie,
    method: "POST",
    body: { fileName: "test.jpg", contentType: "image/jpeg" },
  });
  if (uploadUrlRes.status === 200) {
    check("R2 presigned upload URL works", true);
  } else {
    console.log("  ⚠️  R2 upload-url skipped (R2 not configured — expected in local dev)");
  }
  const galleryRes = await req("/api/gallery", { cookie });
  check("GET /api/gallery (auth)", galleryRes.status === 200);

  // --- Notifications ---
  const notifsRes = await req("/api/notifications", { cookie });
  const notifs = notifsRes.json as { notifications?: { id: string; readAt: string | null }[]; unreadCount?: number };
  check("GET /api/notifications → 200", notifsRes.status === 200);
  check("Notification unreadCount is a number", typeof notifs?.unreadCount === "number");

  const unreadNotif = (notifs?.notifications || []).find((n) => !n.readAt);
  if (unreadNotif) {
    const readRes = await req(`/api/notifications/${unreadNotif.id}/read`, { cookie, method: "POST" });
    check("Mark notification read", readRes.status === 200 && (readRes.json as { readAt?: string | null })?.readAt !== null);
  }

  // --- Settings ---
  const settingsRes = await req("/api/settings", { cookie });
  check("GET /api/settings (settings.manage)", settingsRes.status === 200);
  const settingsPatch = await req("/api/settings", {
    cookie,
    method: "PATCH",
    body: { clubName: "Smoke Test Club" },
  });
  check("PATCH /api/settings", settingsPatch.status === 200);
  const invalidSettings = await req("/api/settings", {
    cookie,
    method: "PATCH",
    body: { hackerKey: "nope" },
  });
  check("Invalid setting key rejected → 400", invalidSettings.status === 400);

  // --- Contact (public, rate-limited) ---
  const contactRes = await req("/api/contact", {
    method: "POST",
    body: { name: "Smoke Tester", email: `contact-${uuid()}@smoke.test`, message: "This is a smoke test message body." },
  });
  check("POST /api/contact → 201", contactRes.status === 201, `got ${contactRes.status}`);

  // --- Department-scoped access: demo user cannot manage permissions ---
  const demoCookie = await login(DEMO_EMAIL, DEMO_PASSWORD);
  check("Demo login succeeds", demoCookie.length > 0);
  const demoPerms = await req("/api/permissions", { cookie: demoCookie });
  check("Demo blocked from permissions.manage → 403", demoPerms.status === 403, `got ${demoPerms.status}`);

  const demoMembers = await req("/api/members", { cookie: demoCookie });
  check("Demo CAN view members (member.view)", demoMembers.status === 200);

  const demoDashboard = await req("/api/dashboard/member", { cookie: demoCookie });
  check("Demo member dashboard → 200", demoDashboard.status === 200);

  // --- Role cleanup ---
  if (roleId) {
    // No DELETE role endpoint; PATCH role to empty is enough. Keep role (harmless).
  }

  // --- Summary ---
  console.log(`\n📊 RESULT: ${passed} passed, ${failed} failed\n`);
  if (failures.length > 0) {
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f}`);
    console.log("\n💡 Note: some failures may be environmental (e.g. R2 not configured).");
    process.exit(1);
  }
  console.log("🎉 All smoke tests passed!");
  process.exit(0);
}

main().catch((e) => {
  console.error("Smoke test crashed:", e);
  process.exit(1);
});
