/**
 * Realtime smoke test.
 *
 * Verifies the full Socket.IO loop against a RUNNING server (npm run dev):
 *   1. a socket.io-client connects to the custom server's /socket.io channel
 *   2. a real mutation happens through a public API route (which uses the
 *      Prisma client extended in src/lib/prisma.ts -> emitChange)
 *   3. the client receives the broadcast "change" event within a few seconds
 *
 * Usage: npx tsx scripts/realtime-smoke.ts
 */
import { io } from "socket.io-client";

const BASE = process.env.SMOKE_BASE || "http://localhost:3000";

async function main() {
  console.log(`Connecting socket client to ${BASE}/socket.io …`);
  const socket = io(BASE, {
    transports: ["websocket", "polling"],
    reconnection: false,
    timeout: 5000,
  });

  const seen: { entity: string; action: string }[] = [];
  socket.on("change", (ev: { entity?: string; action?: string }) => {
    if (!ev?.entity) return;
    seen.push({ entity: ev.entity, action: ev.action ?? "?" });
    console.log(`  [socket] change → ${ev.entity} (${ev.action})`);
  });

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("socket connect timeout")), 6000);
    socket.once("connect", () => {
      clearTimeout(t);
      resolve();
    });
    socket.once("connect_error", (err) => {
      clearTimeout(t);
      reject(new Error(`socket connect_error: ${err.message}`));
    });
  });
  console.log("  [socket] connected ✓");

  // Trigger a real write through a public route that uses the shared prisma
  // client (the extended one that broadcasts changes).
  const res = await fetch(`${BASE}/api/contact`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Realtime Smoke",
      email: `smoke.${Date.now()}@test.local`,
      message: "Realtime smoke test — please ignore.",
    }),
  });
  console.log(`  [api] POST /api/contact → ${res.status}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`mutation failed (${res.status}): ${body.slice(0, 200)}`);
  }

  // Wait up to 8s for the ContactSubmission change event to arrive.
  const deadline = Date.now() + 8000;
  let ok = false;
  while (Date.now() < deadline) {
    if (seen.some((c) => c.entity === "ContactSubmission")) {
      ok = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  socket.disconnect();

  if (!ok) {
    throw new Error(
      `FAIL — no ContactSubmission change event received. Events seen: ${JSON.stringify(seen)}`
    );
  }
  console.log("PASS — realtime change event received after live mutation ✓");
}

main()
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error(`FAIL — ${err.message}`);
    process.exit(1);
  });
