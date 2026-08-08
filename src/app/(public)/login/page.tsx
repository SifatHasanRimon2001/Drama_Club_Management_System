"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { apiGet } from "@/lib/client/api";
import { sanitizeCallbackUrl } from "@/lib/callback-url";
import type { SessionUser } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Icon } from "@/components/icons";
import { ClubLogo } from "@/components/club-logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // The destination the user was heading to before login (safe relative path).
  // Read from the URL *after* mount — `window` is undefined during SSR, so
  // lazy initializers would desync the client from the server-rendered HTML on
  // /login?expired=1 (hydration mismatch). The loader stays up until then.
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  // True when this visit was caused by an expired/invalidated session.
  const [sessionExpired, setSessionExpired] = useState(false);
  // Set once the mount-time session check has completed (avoids showing the
  // form to an already-authenticated user before we can redirect them).
  const [sessionChecked, setSessionChecked] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  // On mount: read the URL params, then check the session. If the user is
  // already authenticated (fresh page load, stale login tab, or a browser-back
  // return to /login), send them straight to the dashboard. Exception: right
  // after a failed sign-out request the session cookie may still exist — the
  // app-shell flags that with sessionStorage so we show the login form instead
  // of bouncing the user back to the dashboard.
  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      if (cancelled) return;

      const params = new URLSearchParams(window.location.search);
      const safeCallback = sanitizeCallbackUrl(params.get("callbackUrl"));
      setCallbackUrl(safeCallback);
      setSessionExpired(params.get("expired") === "1");

      let signedOutButCookieLeft = false;
      try {
        signedOutButCookieLeft =
          window.sessionStorage.getItem("dcms:signed-out") === "1";
        if (signedOutButCookieLeft) {
          window.sessionStorage.removeItem("dcms:signed-out");
        }
      } catch {
        /* storage unavailable — ignore */
      }

      apiGet<{ user: SessionUser | null }>("/api/session")
        .then((data) => {
          if (cancelled) return;
          setSessionChecked(true);
          if (data.user && !signedOutButCookieLeft) {
            // Hard navigation: a client-side `router.replace` can serve a stale
            // prefetched /dashboard payload (cached while logged out), bouncing
            // the user back to login. A full load re-sends the fresh session
            // cookie to the server and lets the dashboard hydrate cleanly.
            window.location.assign(safeCallback || "/dashboard");
          }
        })
        .catch(() => {
          if (!cancelled) setSessionChecked(true);
        });
    }, 0);

    // Safety net: never leave the user staring at a loader if the session
    // endpoint hangs.
    const safety = setTimeout(() => {
      if (!cancelled) setSessionChecked(true);
    }, 4000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(safety);
    };
  }, []);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        setError("Invalid email or password. Please try again.");
        setLoading(false);
        return;
      }
      // Send the user to the page they originally tried to open, or the
      // dashboard for plain sign-ins. Hard navigation (not router.push) so the
      // request carries the fresh session cookie and never reuses a stale
      // prefetched redirect. A failed login never reaches this line, so no
      // partial session state can be created here.
      window.location.assign(callbackUrl || "/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  if (!sessionChecked) {
    return (
      <div className="flex min-h-[80dvh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <ClubLogo size={44} />
          <p className="text-[13.5px] font-medium text-sub">Checking your session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[80dvh] items-center justify-center overflow-hidden px-4 py-12">
      {/* Quiet industrial backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 460px at 50% -12%, rgba(37,99,235,0.1), transparent 62%), radial-gradient(700px 420px at 90% 110%, rgba(15,23,42,0.06), transparent 55%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <div className="relative w-full max-w-[420px]">
        <div className="rounded-[20px] border border-line bg-white/90 p-7 shadow-pop backdrop-blur-xl sm:p-8 dark:bg-[#0f172a]/90 dark:border-white/10">
          <div className="mb-6 flex items-center gap-3">
            <ClubLogo size={40} />
            <div className="min-w-0">
              <p className="font-display text-[17px] font-bold tracking-tight text-ink dark:text-slate-100">
                BRAC University Drama Club
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                Member Portal
              </p>
            </div>
          </div>

          <h1 className="text-[22px] font-bold tracking-tight text-ink dark:text-slate-100">
            Sign in to your account
          </h1>
          <p className="mt-1 text-[14px] text-sub dark:text-slate-400">
            Welcome back — access the management console.
          </p>

          {sessionExpired && !noticeDismissed && (
            <div
              role="status"
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-blue/20 bg-blue/10 px-3.5 py-3 text-[13px] text-blue-800 dark:text-blue-300"
            >
              <Icon name="warn" size={16} className="mt-0.5 shrink-0" />
              <span className="flex-1">
                Your session expired. Please sign in again to continue.
              </span>
              <button
                onClick={() => setNoticeDismissed(true)}
                aria-label="Dismiss"
                className="shrink-0 rounded-full p-1 text-blue-700 transition hover:bg-blue/15 dark:text-blue-200"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Email">
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@bracu.ac.bd"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            {error && (
              <p
                role="alert"
                className="flex items-center gap-2 rounded-xl bg-red/10 px-3.5 py-2.5 text-[13px] font-medium text-red"
              >
                <Icon name="warn" size={14} className="shrink-0" />
                {error}
              </p>
            )}

            <Button type="submit" full size="lg" loading={loading}>
              Sign In
            </Button>
          </form>

          <p className="mt-5 text-center text-[13.5px] text-sub dark:text-slate-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-accent hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-line bg-white/70 p-4 backdrop-blur dark:bg-white/5 dark:border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
            Demo accounts
          </p>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => {
                setEmail("admin@dcms.local");
                setPassword("admin123");
              }}
              className="rounded-xl border border-line bg-card px-3 py-2.5 text-left transition hover:border-accent/40 hover:bg-accent-soft/40 dark:border-white/10 dark:hover:bg-accent/10"
            >
              <span className="text-[12.5px] font-semibold text-ink dark:text-slate-200">
                Admin
              </span>
              <br />
              <span className="text-[11.5px] text-sub dark:text-slate-400">
                admin@dcms.local / admin123
              </span>
            </button>
            <button
              onClick={() => {
                setEmail("demo@dcms.local");
                setPassword("demo123");
              }}
              className="rounded-xl border border-line bg-card px-3 py-2.5 text-left transition hover:border-accent/40 hover:bg-accent-soft/40 dark:border-white/10 dark:hover:bg-accent/10"
            >
              <span className="text-[12.5px] font-semibold text-ink dark:text-slate-200">
                Member
              </span>
              <br />
              <span className="text-[11.5px] text-sub dark:text-slate-400">
                demo@dcms.local / demo123
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
