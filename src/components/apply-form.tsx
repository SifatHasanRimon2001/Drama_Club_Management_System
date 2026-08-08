"use client";

import { useMemo, useState } from "react";
import { apiPost } from "@/lib/client/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, Select } from "@/components/ui/input";
import { Grid } from "@/components/ui/layout";
import { Toggle } from "@/components/ui/toggle";
import { Icon } from "@/components/icons";
import type { FormFieldSpec } from "@/lib/types";

interface ApplyFormProps {
  windowId: string;
  formSchema: Record<string, unknown>;
  departments: { id: string; name: string }[];
}

const SKILL_SUGGESTIONS = ["Acting", "Singing", "Dancing", "Scriptwriting", "Directing", "Stage Design", "Lighting", "Sound", "Costume", "Makeup", "Public Speaking", "Improv"];

export function ApplyForm({ windowId, formSchema, departments }: ApplyFormProps) {
  const toast = useToast();
  const fields = useMemo<FormFieldSpec[]>(
    () => (formSchema?.fields as FormFieldSpec[]) || [],
    [formSchema]
  );

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [prefs, setPrefs] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const togglePref = (id: string) =>
    setPrefs((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) setSkills((k) => [...k, s]);
    setSkillInput("");
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name || !String(form.name).trim()) e.name = "Name is required";
    if (!form.email || !/^\S+@\S+\.\S+$/.test(String(form.email))) e.email = "Enter a valid email";
    if (!form.phone || !String(form.phone).trim()) e.phone = "Phone is required";
    if (!form.studentId || !String(form.studentId).trim()) e.studentId = "Student ID is required";
    if (prefs.length === 0) e.prefs = "Select at least one department";
    if (form.actingExperience && String(form.actingExperience).length > 2000)
      e.actingExperience = "Acting experience must be under 2000 characters";
    if (form.portfolioUrl) {
      try {
        const url = new URL(String(form.portfolioUrl));
        if (!/^https?:$/.test(url.protocol)) throw new Error("bad");
      } catch {
        e.portfolioUrl = "Enter a valid URL starting with http(s)://";
      }
    }
    for (const f of fields) {
      const v = form[f.name];
      if (f.required) {
        if (v === undefined || v === null || v === "" || v === false) {
          e[f.name] = `${f.label || f.name} is required`;
        }
      }
      if (f.type === "select" && v && !f.options?.includes(String(v))) {
        e[f.name] = "Invalid option";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await apiPost(`/api/registration-windows/${windowId}/apply`, {
        name: form.name,
        email: form.email,
        phone: form.phone,
        studentId: form.studentId,
        departmentPrefs: prefs,
        skills,
        actingExperience: form.actingExperience || undefined,
        portfolioUrl: form.portfolioUrl || undefined,
        customResponses:
          fields.length > 0
            ? Object.fromEntries(
                fields.map((f) => {
                  const v = form[f.name];
                  // Omit untouched optional fields entirely: the server-side
                  // dynamic schema rejects "" for select/number fields even
                  // when optional (z.enum/z.coerce.number).
                  const empty =
                    v === undefined ||
                    v === null ||
                    v === "" ||
                    (f.type === "number" && v === "");
                  return [f.name, empty ? undefined : v];
                })
              )
            : undefined,
      });
      setDone(true);
    } catch (err) {
      toast.error("Could not submit application", err instanceof Error ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center rounded-apple border border-line bg-card px-6 py-14 text-center shadow-card dark:bg-[#0f172a] dark:border-white/10">
        <span className="flex size-14 items-center justify-center rounded-full bg-green/12 text-[#248a3d] dark:text-green-400">
          <Icon name="check" size={26} />
        </span>
        <h3 className="mt-5 text-[19px] font-bold tracking-tight text-ink dark:text-slate-100">
          Application submitted!
        </h3>
        <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-sub dark:text-slate-400">
          Thanks for applying. Our team will review your application and get back to you by
          email. Break a leg!
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="rounded-apple border border-line bg-card p-6 shadow-card sm:p-8 dark:bg-[#0f172a] dark:border-white/10"
    >
      <Grid preset="split">
        <Field label="Full name" error={errors.name}>
          <Input
            placeholder="Rafiqul Islam"
            value={String(form.name ?? "")}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input
            type="email"
            placeholder="you@bracu.ac.bd"
            value={String(form.email ?? "")}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <Input
            placeholder="+880 1XXX-XXXXXX"
            value={String(form.phone ?? "")}
            onChange={(e) => set("phone", e.target.value)}
          />
        </Field>
        <Field label="Student ID" error={errors.studentId}>
          <Input
            placeholder="DU-2024-0001"
            value={String(form.studentId ?? "")}
            onChange={(e) => set("studentId", e.target.value)}
          />
        </Field>
      </Grid>

      <div className="mt-5">
        <p className="text-[13px] font-medium text-sub dark:text-slate-400">
          Department preferences <span className="text-red">*</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {departments.map((d) => {
            const active = prefs.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => togglePref(d.id)}
                aria-pressed={active}
                className={`rounded-full border px-3.5 py-1.5 text-[13.5px] font-medium transition ${
                  active
                    ? "border-gold bg-gradient-to-br from-gold-light via-gold to-[#1e40af] font-bold text-white shadow-gold"
                    : "border-line bg-white text-sub hover:border-gold/60 dark:bg-white/10 dark:text-slate-300"
                }`}
              >
                {d.name}
              </button>
            );
          })}
        </div>
        {errors.prefs && (
          <p role="alert" className="mt-1.5 text-[13px] text-red">
            {errors.prefs}
          </p>
        )}
      </div>

      <div className="mt-5">
        <p className="text-[13px] font-medium text-sub dark:text-slate-400">Skills</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {skills.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[13px] font-medium text-accent"
            >
              {s}
              <button type="button" onClick={() => setSkills((k) => k.filter((x) => x !== s))} aria-label={`Remove ${s}`}>
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input
            aria-label="Add a skill"
            className="w-full max-w-[220px]"
            placeholder="Type a skill…"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSkill();
              }
            }}
          />
          <Button size="sm" variant="subtle" onClick={addSkill} type="button">
            Add
          </Button>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {SKILL_SUGGESTIONS.filter((s) => !skills.includes(s))
            .slice(0, 10)
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSkills((k) => [...k, s])}
                className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[12px] text-sub transition hover:bg-black/[0.08] dark:bg-white/10 dark:text-slate-300"
              >
                + {s}
              </button>
            ))}
        </div>
      </div>

      <Grid preset="split" className="mt-5">
        <Field label="Acting experience">
          <Textarea
            rows={3}
            placeholder="Tell us about any plays, improv, or performances…"
            value={String(form.actingExperience ?? "")}
            onChange={(e) => set("actingExperience", e.target.value)}
          />
        </Field>
        <Field label="Portfolio (optional)" error={errors.portfolioUrl} hint="Link to a portfolio, reel, or headshots">
          <Input
            placeholder="https://…"
            value={String(form.portfolioUrl ?? "")}
            onChange={(e) => set("portfolioUrl", e.target.value)}
          />
        </Field>
      </Grid>

      {fields.length > 0 && (
        <div className="mt-6 border-t border-line pt-6 dark:border-white/10">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-faint">
            Additional questions
          </p>
          <Grid preset="split" className="mt-4">
            {fields.map((f) => {
              const val = form[f.name];
              const error = errors[f.name];
              if (f.type === "textarea") {
                return (
                  <Field key={f.name} label={f.label || f.name} error={error} className="sm:col-span-2">
                    <Textarea
                      rows={3}
                      value={val === undefined ? "" : String(val)}
                      onChange={(e) => set(f.name, e.target.value)}
                      placeholder={f.label || f.name}
                    />
                  </Field>
                );
              }
              if (f.type === "select") {
                return (
                  <Field key={f.name} label={f.label || f.name} error={error}>
                    <Select value={val === undefined ? "" : String(val)} onChange={(v) => set(f.name, v)}>
                      <option value="">Select…</option>
                      {(f.options || []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  </Field>
                );
              }
              if (f.type === "checkbox") {
                return (
                  <div key={f.name} className="flex items-center">
                    <Toggle
                      checked={Boolean(val)}
                      onChange={(v) => set(f.name, v)}
                      label={f.label || f.name}
                    />
                  </div>
                );
              }
              if (f.type === "number") {
                return (
                  <Field key={f.name} label={f.label || f.name} error={error}>
                    <Input
                      type="number"
                      value={val === undefined ? "" : String(val)}
                      onChange={(e) => set(f.name, e.target.value)}
                    />
                  </Field>
                );
              }
              return (
                <Field key={f.name} label={f.label || f.name} error={error}>
                  <Input
                    value={val === undefined ? "" : String(val)}
                    onChange={(e) => set(f.name, e.target.value)}
                    placeholder={f.label || f.name}
                  />
                </Field>
              );
            })}
          </Grid>
        </div>
      )}

      <div className="mt-7 flex flex-col items-center gap-3">
        <Button type="submit" loading={submitting} size="lg" full>
          Submit Application
        </Button>
        <p className="text-[12.5px] text-faint dark:text-slate-400">
          You&apos;ll receive a confirmation email once reviewed. Max 1 application per window.
        </p>
      </div>
    </form>
  );
}
