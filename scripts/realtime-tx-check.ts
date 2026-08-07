/**
 * Realtime transaction-path verification.
 *
 * Proves that writes performed inside `prisma.$transaction(async (tx) => …)`
 * still broadcast change events (the $extends query extension applies to the
 * tx client). Uses authenticated API routes that write inside transactions:
 *   - POST /api/roles        (role + rolePermission create inside $transaction)
 *   - PATCH /api/settings    (systemSetting upsert inside $transaction)
 * and cleans up after itself (DELETE /api/roles/[id] + settings revert).
 *
 * Usage: npx tsx scripts/realtime-tx-check.ts
 */
import { io } from "socket.io-client";

const BASE = process.env.SMOKE_BASE || "http://127.0.0.1:3000";
const EMAIL = "admin@dcms.local";
const PASSWORD = "admin123";

function uniq() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function login() {
  // Minimal cookie jar: NextAuth validates the posted csrfToken against the
  // cookie set by /api/auth/csrf, so that cookie must travel with the POST.
  const jar: string[] = [];
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { redirect: "manual" });
  const csrfCookie = csrfRes.headers.get("set-cookie");
  if (csrfCookie) jar.push(csrfCookie.split(";")[0]);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: jar.join("; "),
    },
    body: new URLSearchParams({ csrfToken, email: EMAIL, password: PASSWORD, redirect: "false" }),
    redirect: "manual",
  });
  if (![200, 302].includes(loginRes.status)) {
    throw new Error(`login failed (${loginRes.status})`);
  }
  // The callback sets the session cookie (authjs.session-token …) on the
  // response; pick it out of any additional cookies (e.g. csrf refresh).
  const setCookie = loginRes.headers.get("set-cookie") ?? "";
  const sessionCookie =
    setCookie
      .split(", ")
      .map((c) => c.split(";")[0])
      .find((c) => /session-token=/i.test(c)) ?? setCookie.split(";")[0];
  if (!sessionCookie) throw new Error("no session cookie returned");
  return sessionCookie;
}

function waitFor(
  seen: { entity: string; action: string }[],
  entity: string,
  ms: number
): Promise<boolean> {
  return new Promise((resolve) => {
    const deadline = Date.now() + ms;
    const tick = () => {
      if (seen.some((c) => c.entity === entity)) return resolve(true);
      if (Date.now() > deadline) return resolve(false);
      setTimeout(tick, 100);
    };
    tick();
  });
}

async function main() {
  console.log(`Connecting socket to ${BASE}/socket.io …`);
  const socket = io(BASE, { transports: ["websocket", "polling"], reconnection: false, timeout: 5000 });
  const seen: { entity: string; action: string }[] = [];
  socket.on("change", (ev: { entity?: string; action?: string }) => {
    if (!ev?.entity) return;
    seen.push({ entity: ev.entity, action: ev.action ?? "?" });
    console.log(`  [socket] change → ${ev.entity} (${ev.action})`);
  });
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("socket connect timeout")), 6000);
    socket.once("connect", () => { clearTimeout(t); resolve(); });
    socket.once("connect_error", (err) => { clearTimeout(t); reject(err); });
  });
  console.log("  [socket] connected ✓");

  const cookie = await login();
  console.log("  [auth] logged in as admin ✓");

  const headers = { cookie, "content-type": "application/json" };

  // 1) Role create inside $transaction (roles/route.ts POST).
  const roleName = `RT Smoke ${uniq()}`;
  const roleRes = await fetch(`${BASE}/api/roles`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: roleName, description: "realtime tx check", permissionIds: [] }),
  });
  const role = await roleRes.json().catch(() => ({}));
  console.log(`  [api] POST /api/roles → ${roleRes.status}${roleRes.ok ? ` (id ${(role as { id?: string }).id})` : ""}`);
  if (!roleRes.ok) throw new Error(`role create failed: ${JSON.stringify(role).slice(0, 200)}`);

  // 2) Setting upsert inside $transaction (settings/route.ts PATCH).
  const clubName = `RT Smoke ${uniq()}`;
  const settingsRes = await fetch(`${BASE}/api/settings`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ clubName }),
  });
  console.log(`  [api] PATCH /api/settings → ${settingsRes.status}`);
  if (!settingsRes.ok) throw new Error(`settings patch failed (${settingsRes.status})`);

  // Wait for both entities to arrive.
  const roleOk = await waitFor(seen, "Role", 7000);
  const settingOk = await waitFor(seen, "SystemSetting", 7000);
  console.log(`  [check] Role change event received: ${roleOk ? "YES ✓" : "NO ✗"}`);
  console.log(`  [check] SystemSetting change event received: ${settingOk ? "YES ✓" : "NO ✗"}`);

  // Cleanup — role delete also goes through a $transaction (roles/[id] DELETE).
  const roleId = (role as { id?: string }).id;
  if (roleId) {
    const del = await fetch(`${BASE}/api/roles/${roleId}`, { method: "DELETE", headers });
    console.log(`  [cleanup] DELETE /api/roles/${roleId} → ${del.status}`);
  }
  const revert = await fetch(`${BASE}/api/settings`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ clubName: "Drama Club" }),
  });
  console.log(`  [cleanup] settings revert → ${revert.status}`);

  socket.disconnect();

  if (!roleOk || !settingOk) {
    throw new Error(`FAIL — transaction writes did not broadcast. Seen: ${JSON.stringify(seen)}`);
  }
  console.log("PASS — transaction-scoped writes broadcast change events ✓");
}

main()
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error(`FAIL — ${err.message}`);
    process.exit(1);
  });
