import { test, expect } from "@playwright/test";

/**
 * DCMS E2E — browser-level authentication lifecycle.
 *
 * Exercises the real UI: anonymous redirects with callbackUrl, sign-in landing
 * on the originally-requested page, sign-out as a complete reset, and browser
 * back navigation after logout (which must not resurrect the dashboard).
 *
 * Requires a seeded database (admin@dcms.local / admin123), which the
 * `start:e2e` webServer provisions automatically.
 */

const BASE = "http://127.0.0.1:3310";

test.describe("Auth UI lifecycle", () => {
  test("anonymous /dashboard redirects to login with callbackUrl", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard$/);
    // The login form is shown (session check resolves to logged-out).
    await expect(page.getByRole("heading", { name: /sign in to your account/i })).toBeVisible();
  });

  test("anonymous /dashboard/events redirect preserves the destination and sign-in lands there", async ({
    page,
  }) => {
    await page.goto(`${BASE}/dashboard/events`);
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard%2Fevents$/);

    await page.getByRole("button", { name: /admin@dcms\.local/i }).click();
    await page.getByRole("button", { name: /^Sign In$/ }).click();

    // Land on the page the user originally tried to open, not /dashboard.
    await expect(page).toHaveURL(`${BASE}/dashboard/events`, { timeout: 20_000 });
  });

  test("sign-out resets auth and back navigation cannot reopen the dashboard", async ({
    page,
  }) => {
    // Sign in from scratch.
    await page.goto(`${BASE}/login`);
    await page.getByRole("button", { name: /admin@dcms\.local/i }).click();
    await page.getByRole("button", { name: /^Sign In$/ }).click();
    await expect(page).toHaveURL(`${BASE}/dashboard`, { timeout: 20_000 });

    // The public nav shows the signed-in user (profile in the navbar).
    await page.goto(`${BASE}/`);
    const accountMenu = page.getByRole("button", { name: "Account menu" });
    await expect(accountMenu).toBeVisible({ timeout: 10_000 });

    // Sign out from the dashboard shell.
    await page.goto(`${BASE}/dashboard`);
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login$/, { timeout: 20_000 });

    // A protected API call must now fail with 401.
    const sess = await page.request.get(`${BASE}/api/session`);
    expect((await sess.json()).user).toBeNull();

    // Browser back must not restore the dashboard — the server re-checks auth.
    await page.goBack();
    await expect(page).toHaveURL(/\/login/);
  });

  test("logged-out user visiting /login is not redirected into the dashboard", async ({
    page,
  }) => {
    await page.goto(`${BASE}/login`);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: /sign in to your account/i })).toBeVisible();
  });
});
