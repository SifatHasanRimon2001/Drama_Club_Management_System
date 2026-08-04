import { defineConfig } from "@playwright/test";

/**
 * DCMS E2E tests.
 *
 * Because the app is API-first (all routes are /api/* handlers plus a static
 * landing page), the E2E suites exercise the live server through Playwright's
 * HTTP `request` fixture — including a REAL NextAuth credentials login, which
 * covers the NextAuth config in src/lib/auth.ts (the one file unit tests must
 * mock).
 *
 * Run:  npm run test:e2e
 *
 * The `webServer` below starts the production server from the existing build
 * (also runs `next build` first if you use `test:e2e:ci`).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3310",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start:e2e",
    url: "http://127.0.0.1:3310",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
  },
  projects: [
    {
      name: "api",
      testMatch: /.*\.spec\.ts/,
    },
  ],
});
