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
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);

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
            window.location.assign(safeCallback || "/dashboard");
          }
        })
        .catch(() => {
          if (!cancelled) setSessionChecked(true);
        });
    }, 0);

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
          <ClubLogo size={40} />
          <p className="text-[13.5px] font-medium text-sub">Checking your session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[80dvh] items-center justify-center overflow-hidden px-4 py-12">
      {/* Subtle background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(800px 400px at 50% -10%, rgba(37,99,235,0.05), transparent 60%)",
        }}
      />

      <div className="relative w-full max-w-[400px]">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-7 shadow-card sm:p-8 dark:bg-card dark:border-line">
          <div className="mb-6 flex items-center gap-3">
            <ClubLogo size={36} />
            <div className="min-w-0">
              <p className="font-display text-[16px] font-bold tracking-tight text-ink dark:text-slate-100">
                BRAC University Drama Club
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink ">
                Member Portal
              </p>
            </div>
          </div>

          <h1 className="text-[20px] font-bold tracking-tight text-ink dark:text-slate-100">
            Sign in to your account
          </h1>
          <p className="mt-1 text-[13.5px] text-sub dark:text-slate-400">
            Welcome back — access the management console.
          </p>

          {sessionExpired && !noticeDismissed && (
            <div
              role="status"
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-accent-soft-strong bg-accent-soft px-3.5 py-3 text-[13px] text-accent-ink dark:border-accent-soft-strong "
            >
              <Icon name="warn" size={15} className="mt-0.5 shrink-0" />
              <span className="flex-1">
                Your session expired. Please sign in again to continue.
              </span>
              <button
                onClick={() => setNoticeDismissed(true)}
                aria-label="Dismiss"
                className="shrink-0 rounded-lg p-1 text-accent transition hover:bg-accent-soft-strong  dark:hover:bg-accent/20"
              >
                <Icon name="close" size={13} />
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
                className="flex items-center gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400"
              >
                <Icon name="warn" size={13} className="shrink-0" />
                {error}
              </p>
            )}

            <Button type="submit" full size="lg" loading={loading}>
              Sign In
            </Button>
          </form>

          <p className="mt-5 text-center text-[13px] text-sub dark:text-slate-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-accent-ink hover:underline "
            >
              Create one
            </Link>
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200/80 bg-white/80 p-4 backdrop-blur dark:bg-white/5 dark:border-line">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
            Demo accounts
          </p>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => {
                setEmail("admin@dcms.local");
                setPassword("admin123");
              }}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left transition hover:border-accent hover:bg-accent-soft/50 dark:border-line dark:hover:bg-accent/10"
            >
              <span className="text-[12px] font-semibold text-ink dark:text-slate-200">
                Admin
              </span>
              <br />
              <span className="text-[11px] text-sub dark:text-slate-400">
                admin@dcms.local / admin123
              </span>
            </button>
            <button
              onClick={() => {
                setEmail("demo@dcms.local");
                setPassword("demo123");
              }}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left transition hover:border-accent hover:bg-accent-soft/50 dark:border-line dark:hover:bg-accent/10"
            >
              <span className="text-[12px] font-semibold text-ink dark:text-slate-200">
                Member
              </span>
              <br />
              <span className="text-[11px] text-sub dark:text-slate-400">
                demo@dcms.local / demo123
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
