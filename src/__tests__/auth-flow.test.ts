import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { sanitizeCallbackUrl, buildLoginUrl } from "@/lib/callback-url";
import { proxy as middleware, config } from "@/proxy";

describe("sanitizeCallbackUrl", () => {
  it("accepts a plain relative dashboard path", () => {
    expect(sanitizeCallbackUrl("/dashboard/events")).toBe("/dashboard/events");
  });

  it("accepts a relative path with a query string", () => {
    expect(sanitizeCallbackUrl("/dashboard/events?status=DRAFT")).toBe(
      "/dashboard/events?status=DRAFT"
    );
  });

  it("rejects null / undefined / empty", () => {
    expect(sanitizeCallbackUrl(null)).toBeNull();
    expect(sanitizeCallbackUrl(undefined)).toBeNull();
    expect(sanitizeCallbackUrl("")).toBeNull();
    expect(sanitizeCallbackUrl("   ")).toBeNull();
  });

  it("rejects absolute URLs (open redirect)", () => {
    expect(sanitizeCallbackUrl("https://evil.example.com/dashboard")).toBeNull();
    expect(sanitizeCallbackUrl("http://evil.example.com")).toBeNull();
  });

  it("rejects protocol-relative URLs", () => {
    expect(sanitizeCallbackUrl("//evil.example.com/dashboard")).toBeNull();
    expect(sanitizeCallbackUrl("\\evil.example.com/dashboard")).toBeNull();
  });

  it("rejects non-path values", () => {
    expect(sanitizeCallbackUrl("dashboard")).toBeNull();
    expect(sanitizeCallbackUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects auth pages to avoid redirect loops", () => {
    expect(sanitizeCallbackUrl("/login")).toBeNull();
    expect(sanitizeCallbackUrl("/login?callbackUrl=/dashboard")).toBeNull();
    expect(sanitizeCallbackUrl("/register")).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeCallbackUrl("  /dashboard  ")).toBe("/dashboard");
  });
});

describe("buildLoginUrl", () => {
  it("returns the bare login page when no safe destination exists", () => {
    expect(buildLoginUrl()).toBe("/login");
    expect(buildLoginUrl("https://evil.example.com")).toBe("/login");
    expect(buildLoginUrl(null)).toBe("/login");
  });

  it("embeds the callbackUrl for a safe destination", () => {
    expect(buildLoginUrl("/dashboard")).toBe(
      "/login?callbackUrl=%2Fdashboard"
    );
    expect(buildLoginUrl("/dashboard/events?status=DRAFT")).toBe(
      "/login?callbackUrl=%2Fdashboard%2Fevents%3Fstatus%3DDRAFT"
    );
  });

  it("flags an expired-session redirect without losing the callbackUrl", () => {
    expect(buildLoginUrl("/dashboard", { expired: true })).toBe(
      "/login?callbackUrl=%2Fdashboard&expired=1"
    );
  });

  it("flags an expired-session redirect when there is no destination", () => {
    expect(buildLoginUrl(null, { expired: true })).toBe("/login?expired=1");
    expect(buildLoginUrl(undefined, { expired: true })).toBe("/login?expired=1");
  });

  it("keeps the plain login URL without the expired flag", () => {
    expect(buildLoginUrl("/dashboard", {})).toBe("/login?callbackUrl=%2Fdashboard");
  });
});

describe("route middleware (src/proxy.ts)", () => {
  const base = "http://localhost:3000";

  it("redirects an anonymous /dashboard request to /login with callbackUrl", () => {
    const req = new NextRequest(`${base}/dashboard/events?status=DRAFT`);
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      `${base}/login?callbackUrl=%2Fdashboard%2Fevents%3Fstatus%3DDRAFT`
    );
  });

  it("redirects an anonymous request for the bare /dashboard path", () => {
    const req = new NextRequest(`${base}/dashboard`);
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      `${base}/login?callbackUrl=%2Fdashboard`
    );
  });

  it("lets a request through when a session cookie is present", () => {
    const req = new NextRequest(`${base}/dashboard`, {
      headers: { cookie: "authjs.session-token=abc.def.ghi" },
    });
    const res = middleware(req);
    expect(res.status).toBe(200);
  });

  it("recognizes the secure (__Secure-) session cookie variant", () => {
    const req = new NextRequest(`${base}/dashboard/members`, {
      headers: { cookie: "__Secure-authjs.session-token=abc.def.ghi" },
    });
    const res = middleware(req);
    expect(res.status).toBe(200);
  });

  it("does not touch public routes", () => {
    const req = new NextRequest(`${base}/about`);
    const res = middleware(req);
    expect(res.status).toBe(200);
  });

  it("does not touch API routes", () => {
    const req = new NextRequest(`${base}/api/session`);
    const res = middleware(req);
    expect(res.status).toBe(200);
  });

  it("only matches /dashboard routes in the matcher config", () => {
    expect(config.matcher).toEqual(["/dashboard/:path*"]);
  });
});
