"use client";

import Link from "next/link";
import { useState } from "react";
import { apiPost } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Grid } from "@/components/ui/layout";
import { Icon } from "@/components/icons";
import { ClubLogo } from "@/components/club-logo";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = "Enter a valid email";
    if (form.password.length < 8) errs.password = "Password must be at least 8 characters";
    if (form.confirm !== form.password) errs.confirm = "Passwords don't match";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      await apiPost("/api/auth/register", { name: form.name, email: form.email, password: form.password });
      setSuccess(true);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Registration failed" });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center px-4 py-12">
        <div className="bg-card w-full max-w-[420px] rounded-[26px] border border-line /80 p-6 text-center shadow-pop backdrop-blur-2xl sm:p-8 /90 dark:border-white/10">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-green/12 text-[#248a3d] dark:text-green-400">
            <Icon name="check" size={26} />
          </span>
          <h1 className="mt-5 text-[22px] font-bold tracking-tight text-ink">
            Account created
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-sub">
            You can now sign in. A club administrator will link a member profile to your
            account.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-gradient-to-br from-gold-light via-gold to-[#1e40af] text-[15px] font-bold text-white dark:bg-accent dark:bg-none dark:text-on-accent shadow-gold transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-[80dvh] flex-col items-center justify-center overflow-hidden px-4 py-12"
      style={{
        background:
          "radial-gradient(900px 460px at 50% -12%, rgba(37,99,235,0.1), transparent 62%), radial-gradient(700px 420px at 90% 110%, rgba(15,23,42,0.06), transparent 55%)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="w-full max-w-[420px] rounded-[26px] border border-line bg-card/90 p-6 shadow-pop backdrop-blur-2xl sm:p-8 dark:bg-card/90 dark:border-white/10">
        <div aria-hidden="true" className="mb-5 flex items-center gap-2.5">
          <ClubLogo size={38} />
          <span className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-accent">
            Member Portal
          </span>
        </div>
        <h1 className="font-display text-[26px] font-bold tracking-tight text-ink">
          Create your account
        </h1>
        <p className="mt-1.5 text-[14px] text-sub">
          Members-only access requires a linked profile.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <Field label="Full name" error={errors.name}>
            <Input placeholder="Rafiqul Islam" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input type="email" placeholder="you@bracu.ac.bd" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Grid preset="fields">
            <Field label="Password" error={errors.password}>
              <Input type="password" placeholder="••••••••" value={form.password} onChange={(e) => set("password", e.target.value)} />
            </Field>
            <Field label="Confirm" error={errors.confirm}>
              <Input type="password" placeholder="••••••••" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} />
            </Field>
          </Grid>

          {errors.form && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-xl bg-red/10 px-3.5 py-2.5 text-[13px] font-medium text-red"
            >
              <Icon name="warn" size={14} className="shrink-0" />
              {errors.form}
            </p>
          )}

          <Button type="submit" full size="lg" loading={loading}>
            Create Account
          </Button>
        </form>

        <p className="mt-6 text-center text-[13.5px] text-sub">
          Already a member?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
