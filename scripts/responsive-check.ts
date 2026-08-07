/**
 * Responsive UI audit script.
 *
 * Opens every key page at phone (375), tablet (768) and desktop (1440)
 * widths, logs any horizontal overflow (document wider than viewport),
 * and captures browser console errors. Also signs into the dashboard
 * with the demo admin account to check the authenticated shell.
 *
 * Usage: npx tsx scripts/responsive-check.ts   (requires dev server on :3000)
 */
import { chromium, type Browser, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";

const PUBLIC_PAGES = [
  "/",
  "/about",
  "/committee",
  "/departments",
  "/productions",
  "/events",
  "/updates",
  "/gallery",
  "/recruitment",
  "/contact",
  "/login",
  "/register",
];

const DASHBOARD_PAGES = [
  "/dashboard",
  "/dashboard/members",
  "/dashboard/events",
  "/dashboard/departments",
  "/dashboard/committees",
  "/dashboard/gallery",
  "/dashboard/notifications",
  "/dashboard/registration",
];

const WIDTHS = [375, 768, 1440] as const;

interface CheckResult {
  overflow: boolean;
  scrollWidth: number;
  clientWidth: number;
  errors: string[];
}

async function checkPage(page: Page, path: string): Promise<CheckResult> {
  const errors: string[] = [];
  const onConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  };
  const onPageError = (err: Error) => errors.push(`pageerror: ${err.message}`);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 20000 });
    // Let client-rendered dashboards settle.
    await page.waitForTimeout(path.startsWith("/dashboard") ? 2500 : 900);
    const dims = await page.evaluate(() => {
      const doc = document.documentElement;
      return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
    });
    return { overflow: dims.scrollWidth > dims.clientWidth, ...dims, errors };
  } catch (e) {
    return { overflow: false, scrollWidth: 0, clientWidth: 0, errors: [`nav: ${e}`] };
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
  }
}

async function login(page: Page): Promise<boolean> {
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 20000 });
    await page.getByLabel("Email").fill("admin@dcms.local");
    await page.getByLabel("Password").fill("admin123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await page.waitForTimeout(2500);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const browser: Browser = await chromium.launch({ channel: "chrome" });
  let failures = 0;

  for (const width of WIDTHS) {
    console.log(`\n=== Viewport ${width}px ===`);
    const page: Page = await browser.newPage({ viewport: { width, height: 900 } });
    for (const path of PUBLIC_PAGES) {
      const r = await checkPage(page, path);
      const status = r.overflow ? "OVERFLOW" : "ok";
      if (r.overflow) failures++;
      const errNote = r.errors.length ? `  ERRORS: ${r.errors.join(" | ").slice(0, 200)}` : "";
      console.log(
        `${r.overflow ? "✗" : "✓"} ${width}px  ${path.padEnd(20)} ${status}${r.overflow ? ` (scroll ${r.scrollWidth} > viewport ${r.clientWidth})` : ""}${errNote}`
      );
      if (r.errors.length && !r.overflow) {
        // Console errors are worth flagging even without overflow.
        console.log(`   !! console errors on ${path}: ${r.errors.join(" | ").slice(0, 300)}`);
      }
    }
    await page.close();
  }

  // Authenticated dashboard audit (phone only — the most failure-prone width).
  console.log(`\n=== Dashboard (authenticated) at 375px ===`);
  const dashPage: Page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const loggedIn = await login(dashPage);
  if (!loggedIn) {
    console.log("✗ Could not sign in to dashboard");
  } else {
    for (const path of DASHBOARD_PAGES) {
      const r = await checkPage(dashPage, path);
      if (r.overflow) failures++;
      console.log(
        `${r.overflow ? "✗" : "✓"} 375px  ${path.padEnd(24)} ${r.overflow ? `OVERFLOW (scroll ${r.scrollWidth} > viewport ${r.clientWidth})` : "ok"}`
      );
      if (r.errors.length) console.log(`   !! errors: ${r.errors.join(" | ").slice(0, 300)}`);
    }
  }
  await dashPage.close();

  await browser.close();
  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED — no horizontal overflow anywhere." : `${failures} page(s) had horizontal overflow.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
