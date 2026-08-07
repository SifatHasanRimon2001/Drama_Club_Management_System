"use client";

import Link from "next/link";
import { useState } from "react";
import { apiPost } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Grid } from "@/components/ui/layout";
import { Icon } from "@/components/icons";

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
        <div className="w-full max-w-[420px] rounded-[26px] border border-line bg-white/80 p-8 text-center shadow-pop backdrop-blur-2xl dark:bg-[#1c1c1e]/90 dark:border-white/10">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-green/12 text-[#248a3d] dark:text-green-400">
            <Icon name="check" size={26} />
          </span>
          <h1 className="mt-5 text-[22px] font-bold tracking-tight text-ink dark:text-gray-100">
            Account created
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-sub dark:text-gray-400">
            You can now sign in. A club administrator will link a member profile to your
            account.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-accent text-[15px] font-medium text-white transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[80dvh] flex-col items-center justify-center px-4 py-12"
      style={{
        background:
          "radial-gradient(900px 450px at 80% -10%, rgba(175,82,222,0.12), transparent 60%), radial-gradient(700px 400px at 10% 110%, rgba(0,113,227,0.1), transparent 55%)",
      }}
    >
      <div className="w-full max-w-[420px] rounded-[26px] border border-line bg-white/80 p-8 shadow-pop backdrop-blur-2xl dark:bg-[#1c1c1e]/90 dark:border-white/10">
        <h1 className="text-[24px] font-bold tracking-tight text-ink dark:text-gray-100">
          Create your account
        </h1>
        <p className="mt-1.5 text-[14px] text-sub dark:text-gray-400">
          Members-only access requires a linked profile.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <Field label="Full name" error={errors.name}>
            <Input placeholder="Jane Doe" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input type="email" placeholder="you@university.edu" value={form.email} onChange={(e) => set("email", e.target.value)} />
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

        <p className="mt-6 text-center text-[13.5px] text-sub dark:text-gray-400">
          Already a member?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
