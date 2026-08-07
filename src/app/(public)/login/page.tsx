"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/ui/toast";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      toast.success("Welcome back!");
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-[80dvh] flex-col items-center justify-center px-4 py-12"
      style={{
        background:
          "radial-gradient(900px 450px at 20% -10%, rgba(0,113,227,0.12), transparent 60%), radial-gradient(700px 400px at 90% 110%, rgba(175,82,222,0.1), transparent 55%)",
      }}
    >
      <div className="w-full max-w-[420px] rounded-[26px] border border-line bg-white/80 p-8 shadow-pop backdrop-blur-2xl dark:bg-[#1c1c1e]/90 dark:border-white/10">
        <h1 className="text-[24px] font-bold tracking-tight text-ink dark:text-gray-100">
          Sign in to your account
        </h1>
        <p className="mt-1.5 text-[14px] text-sub dark:text-gray-400">
          Welcome back, performer.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <Field label="Email">
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@university.edu"
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

        <p className="mt-6 text-center text-[13.5px] text-sub dark:text-gray-400">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-accent hover:underline">
            Create one
          </Link>
        </p>
      </div>

      <div className="mt-6 w-full max-w-[420px] rounded-2xl border border-dashed border-line-strong/50 bg-white/50 p-4 backdrop-blur dark:bg-white/5">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-faint">
          Demo accounts
        </p>
        <div className="mt-2 grid gap-2 text-[13px] text-sub sm:grid-cols-2 dark:text-gray-400">
          <button
            onClick={() => {
              setEmail("admin@dcms.local");
              setPassword("admin123");
            }}
            className="rounded-xl bg-black/[0.04] px-3 py-2 text-left transition hover:bg-black/[0.08] dark:bg-white/10 dark:hover:bg-white/15"
          >
            <span className="font-semibold text-ink dark:text-gray-200">Admin</span>
            <br />
            admin@dcms.local / admin123
          </button>
          <button
            onClick={() => {
              setEmail("demo@dcms.local");
              setPassword("demo123");
            }}
            className="rounded-xl bg-black/[0.04] px-3 py-2 text-left transition hover:bg-black/[0.08] dark:bg-white/10 dark:hover:bg-white/15"
          >
            <span className="font-semibold text-ink dark:text-gray-200">Member</span>
            <br />
            demo@dcms.local / demo123
          </button>
        </div>
      </div>
    </div>
  );
}
