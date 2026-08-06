import { NextRequest } from "next/server";
import { createHash } from "crypto";

/**
 * Derive a stable rate-limit key for a request.
 *
 * Prefers the leftmost `x-forwarded-for` value (set by trusted proxies), then
 * `x-real-ip`. When neither is present (e.g. local development without a proxy),
 * falls back to a hash of the User-Agent so anonymous clients do NOT share a
 * single global bucket (which would let any 3 requests block ALL anonymous
 * traffic for the window).
 */
export function clientIpKey(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const ua = request.headers.get("user-agent")?.trim() || "";
  const hash = createHash("sha256").update(ua).digest("hex").slice(0, 16);
  return `anon-${hash}`;
}

export interface RateLimitRecord {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory sliding fixed-window rate limiter.
 * In production this should sit behind a distributed store (Redis/Upstash),
 * but for a single-instance MVP deployment an in-memory map is acceptable.
 */
export class RateLimiter {
  private map = new Map<string, RateLimitRecord>();
  private lastCleanup = Date.now();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly cleanupIntervalMs = 5 * 60 * 1000
  ) {}

  allow(key: string): boolean {
    const now = Date.now();

    // Periodically purge expired entries so the map does not grow unboundedly.
    if (now - this.lastCleanup > this.cleanupIntervalMs) {
      this.lastCleanup = now;
      for (const [k, record] of this.map.entries()) {
        if (now > record.resetAt) this.map.delete(k);
      }
    }

    const record = this.map.get(key);
    if (!record || now > record.resetAt) {
      this.map.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (record.count >= this.limit) return false;
    record.count++;
    return true;
  }

  /** Test-only: drop all tracked keys. */
  reset(): void {
    this.map.clear();
    this.lastCleanup = Date.now();
  }
}
