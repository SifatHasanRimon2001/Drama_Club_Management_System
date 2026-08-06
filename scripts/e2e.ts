/**
 * DCMS — standalone HTTP E2E orchestrator (no Playwright/browser required).
 *
 * Bootstraps a clean environment, starts a real Next.js production server,
 * waits for it to be ready, then runs scripts/smoke-test.ts (which performs a
 * REAL NextAuth credentials login + the full PRD workflow checklist), and
 * finally tears the server down.
 *
 * The whole flow runs inside one process so it works in CI sandboxes and in
 * this local environment where background processes are not shared across
 * shell invocations.
 *
 * Usage: npm run test:e2e:http
 *   (or: npx tsx scripts/e2e.ts)
 *
 * Exit code mirrors the smoke test (0 = all passed, 1 = failures).
 */
import { spawn, spawnSync, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const ROOT = path.resolve(__dirname, "..");
const PORT = 3310;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const READINESS_TIMEOUT_MS = 110_000;
const POLL_INTERVAL_MS = 500;

function log(msg: string) {
  console.log(`\u001b[96m[e2e]\u001b[0m ${msg}`);
}

function fail(code: number): never {
  process.exit(code);
}

/** Spawn a command in the project root, inheriting stdio. */
function run(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
    });
    child.on("close", (code) => resolve(code ?? 0));
    child.on("error", () => resolve(1));
    process.on("SIGINT", () => child.kill("SIGINT"));
    process.on("SIGTERM", () => child.kill("SIGTERM"));
  });
}

/** Spawn the Next.js production server (single killable process). */
function startServer(): ChildProcess {
  const nextBin = path.join(
    ROOT,
    "node_modules",
    "next",
    "dist",
    "bin",
    "next",
  );
  if (!existsSync(nextBin)) {
    log("Building Next.js (no production build found)...");
    const rc = spawnSync("npx", ["next", "build"], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
    });
    if (rc.status !== 0) fail(1);
  }
  log(`Starting Next.js production server on port ${PORT}...`);
  // Override NextAuth trust config so the credentials callback on 127.0.0.1:3310
  // is accepted (the dev .env defaults NEXTAUTH_URL to localhost:3000).
  const child = spawn("node", [nextBin, "start", "-p", String(PORT)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    detached: true,
    env: {
      ...process.env,
      NEXTAUTH_URL: BASE_URL,
      AUTH_URL: BASE_URL,
      AUTH_TRUST_HOST: "true",
      AUTH_TRUSTED_HOSTS: `${BASE_URL.replace(/^https?:\/\//, "")},localhost:3000`,
    },
  });
  child.stdout.on("data", (d) => process.stdout.write(`  ${String(d)}`));
  child.stderr.on("data", (d) => process.stderr.write(`  ${String(d)}`));
  return child;
}

/** Poll the health endpoint until the server answers or the timeout expires. */
function waitForReady(): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      fetch(`${BASE_URL}/`)
        .then((res) => {
          if (res.ok) resolve();
          else if (Date.now() - start > READINESS_TIMEOUT_MS)
            reject(new Error("Server never became ready"));
          else setTimeout(tick, POLL_INTERVAL_MS);
        })
        .catch(() => {
          if (Date.now() - start > READINESS_TIMEOUT_MS)
            reject(new Error("Server never became ready"));
          else setTimeout(tick, POLL_INTERVAL_MS);
        });
    };
    tick();
  });
}

function killTree(proc: ChildProcess) {
  try {
    // Kill the whole process group so Next's worker children die too.
    if (proc.pid && !proc.killed) {
      try {
        process.kill(-proc.pid, "SIGKILL");
      } catch {
        proc.kill("SIGKILL");
      }
    }
  } catch {
    // ignore
  }
}

async function main() {
  // Guard rails
  if (!process.env.DATABASE_URL) {
    console.error(
      "\u001b[31m[error]\u001b[0m DATABASE_URL must be set to run the E2E harness (needs a Postgres DB).\n" +
        "   Start one with:  docker run --rm -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=dcms -p 5432:5432 postgres:16\n" +
        "   Then re-run:    npm run test:e2e:http",
    );
    fail(1);
  }

  // 1) Clean + seed
  log("Resetting and seeding the database...");
  const resetRc = await run("npx", ["tsx", "scripts/reset-db.ts"]);
  if (resetRc !== 0) {
    console.error("\u001b[31m[error]\u001b[0m Database reset/seed failed.");
    fail(1);
  }

  // 2) Start server in the background
  const server = startServer();
  let serverStarted = false;

  const cleanup = () => {
    log("Stopping server...");
    killTree(server);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  try {
    log(`Waiting for server readiness at ${BASE_URL} ...`);
    await waitForReady();
    serverStarted = true;
    log("Server is ready. Running smoke tests...");

    // 3) Run the smoke suite against the live server
    const smokePath = path.join(ROOT, "scripts", "smoke-test.ts");
    const child = spawn("npx", ["tsx", smokePath], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, BASE_URL },
    });
    const code: number = await new Promise((resolve) => {
      child.on("close", (c) => resolve(c ?? 0));
      child.on("error", () => resolve(1));
    });

    cleanup();
    if (code === 0) {
      log("\u001b[32mE2E PASS ✅ — all smoke checks passed.\u001b[0m");
      fail(0);
    } else {
      console.error(
        `\u001b[31mE2E FAIL ❌ — smoke tests exited with code ${code}.\u001b[0m`,
      );
      fail(code);
    }
  } catch (e) {
    console.error("\u001b[31m[error]\u001b[0m", (e as Error).message);
    cleanup();
    fail(1);
  } finally {
    if (!serverStarted) killTree(server);
  }
}

main();
