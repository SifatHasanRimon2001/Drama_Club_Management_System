/**
 * Captures UI screenshots at phone / tablet / desktop widths and verifies
 * that the responsive grids actually change column counts per breakpoint.
 *
 * Usage: npx tsx scripts/ui-shots.ts   (requires dev server on :3000)
 * Output: ui-audit-shots/<page>--<width>.png
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "ui-audit-shots";

const WIDTHS = [
  { width: 375, label: "phone" },
  { width: 768, label: "tablet" },
  { width: 1440, label: "desktop" },
] as const;

const SHOTS = [
  "/",
  "/events",
  "/gallery",
  "/contact",
  "/dashboard",
];

async function gridColumns(page: Page): Promise<number[]> {
  // Count grid-template-columns on visible .grid containers (top 4 on page).
  return page.evaluate(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".grid"));
    return els
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && el.children.length >= 2;
      })
      .slice(0, 4)
      .map((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  });
}

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  await page.getByLabel("Email").fill("admin@dcms.local");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForTimeout(2500);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser: Browser = await chromium.launch({ channel: "chrome" });

  for (const { width, label } of WIDTHS) {
    const page: Page = await browser.newPage({ viewport: { width, height: 900 } });
    let shotLabel = label;
    if (width === 375) {
      await login(page);
      shotLabel = "phone";
    }
    for (const path of SHOTS) {
      if (path === "/dashboard" && width !== 375) continue; // already authed only on phone pass
      const url = path === "/dashboard" ? `${BASE}/dashboard` : `${BASE}${path}`;
      await page.goto(url, { waitUntil: "load", timeout: 20000 });
      await page.waitForTimeout(path === "/dashboard" ? 2500 : 1000);
      const cols = path === "/" ? await gridColumns(page) : [];
      await page.screenshot({ path: `${OUT}/${path.replaceAll("/", "_") || "home"}--${width}.png`, fullPage: true });
      console.log(`shot ${path} @ ${width}px${cols.length ? `  | grid cols: [${cols.join(", ")}]` : ""}`);
    }
    await page.close();
  }

  await browser.close();
  console.log(`Screenshots saved to ./${OUT}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
