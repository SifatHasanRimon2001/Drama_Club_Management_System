"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Grid, Container } from "@/components/ui/layout";
import { PageIntro } from "@/components/ui/page";
import { Icon } from "@/components/icons";
import type { PublicAbout } from "@/lib/types";

export default function ContactPage() {
  const toast = useToast();
  const [about, setAbout] = useState<PublicAbout | null>(null);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void apiGet<PublicAbout>("/api/public/about").then(setAbout).catch(() => {});
  }, []);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = "Enter a valid email";
    if (form.message.trim().length < 10) errs.message = "Message must be at least 10 characters";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      await apiPost("/api/contact", form);
      setDone(true);
    } catch (err) {
      toast.error("Could not send message", err instanceof Error ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container size="narrow" className="pb-24 pt-28">
      <div className="grid gap-12 md:grid-cols-[1fr_1.2fr] md:gap-10">
        <div>
          <PageIntro
            eyebrow="Get in touch"
            title="Contact us"
            subtitle="Questions about joining, productions, venue hire, or collaborations? Drop us a line — we'd love to hear from you."
          />
          <div className="mt-8 space-y-4">
            {[
              {
                icon: "mail" as const,
                title: "Email",
                text: about?.contactEmail || "dramaclub@bracu.ac.bd",
              },
              {
                icon: "pin" as const,
                title: "Where to find us",
                text: "BRAC University Campus, Mohakhali, Dhaka 1212",
              },
              {
                icon: "phone" as const,
                title: "Phone",
                text: about?.contactPhone || "Reach us by email for the fastest response",
              },
            ].map((c) => (
              <div key={c.title} className="flex items-start gap-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
                  <Icon name={c.icon} size={18} />
                </span>
                <div>
                  <p className="text-[14.5px] font-semibold text-ink">{c.title}</p>
                  <p className="text-[13.5px] text-sub">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {done ? (
          <div className="flex h-full flex-col items-center justify-center rounded-apple border border-line bg-card p-8 text-center shadow-card sm:p-10 dark:bg-card dark:border-white/10">
            <span className="flex size-14 items-center justify-center rounded-full bg-green/12 text-[#248a3d] dark:text-green-400">
              <Icon name="check" size={26} />
            </span>
            <h2 className="mt-5 text-[19px] font-bold tracking-tight text-ink">
              Message received
            </h2>
            <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-sub">
              Thanks for reaching out! We&apos;ll get back to you as soon as we can.
            </p>
          </div>
        ) : (
          <div className="rounded-apple border border-line bg-card p-6 shadow-card sm:p-8 dark:bg-card dark:border-white/10">
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">
              Send us a message
            </h2>
            <form onSubmit={submit} className="mt-5 space-y-4">
              <Grid preset="fields">
                <Field label="Your name" error={errors.name}>
                  <Input placeholder="Rafiqul Islam" value={form.name} onChange={(e) => set("name", e.target.value)} />
                </Field>
                <Field label="Email" error={errors.email}>
                  <Input type="email" placeholder="you@bracu.ac.bd" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </Field>
              </Grid>
              <Field label="Message" error={errors.message}>
                <Textarea
                  rows={6}
                  placeholder="Tell us what's on your mind…"
                  value={form.message}
                  onChange={(e) => set("message", e.target.value)}
                />
              </Field>
              <Button type="submit" loading={submitting} full size="lg">
                Send Message
              </Button>
            </form>
          </div>
        )}
      </div>
    </Container>
  );
}
