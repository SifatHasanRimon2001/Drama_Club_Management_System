/**
 * DCMS — long-lived E2E server (reset + seed + next start on port 3310).
 *
 * Used by Playwright's `webServer` (see playwright.config.ts `start:e2e`) and
 * available as `npm run start:e2e`. Unlike scripts/e2e.ts this process stays
 * up and serves a server for the duration of the test run.
 *
 * Sets the Auth.js env vars that production mode requires for host-trust.
 */
import { spawn, spawnSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const PORT = 3310;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function log(msg: string) {
  console.log(`\u001b[96m[e2e-server]\u001b[0m ${msg}`);
}

if (!existsSync(path.join(ROOT, "node_modules", "next", "dist", "bin", "next"))) {
  log("Building Next.js (no production build found)...");
  const rc = spawnSync("npx", ["next", "build"], { cwd: ROOT, stdio: "inherit", shell: true });
  if (rc.status !== 0) process.exit(1);
}

// 1) Clean + seed (idempotent) so every E2E run starts from a known state.
log("Resetting and seeding the database...");
const reset = spawnSync("npx", ["tsx", "scripts/reset-db.ts"], {
  cwd: ROOT,
  stdio: "inherit",
  shell: true,
});
if (reset.status !== 0) {
  console.error("\u001b[31m[error]\u001b[0m Database reset/seed failed.");
  process.exit(1);
}

// 2) Start the production server with the Auth.js host-trust env vars.
log(`Starting Next.js production server on port ${PORT}...`);
const child = spawn(
  "node",
  [path.join(ROOT, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(PORT)],
  {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    env: {
      ...process.env,
      NEXTAUTH_URL: BASE_URL,
      AUTH_URL: BASE_URL,
      AUTH_TRUST_HOST: "true",
    },
  }
);
child.stdout.on("data", (d) => process.stdout.write(`  ${String(d)}`));
child.stderr.on("data", (d) => process.stderr.write(`  ${String(d)}`));
child.on("close", (code) => process.exit(code ?? 0));
