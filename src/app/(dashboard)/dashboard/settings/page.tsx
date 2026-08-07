"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { PageLoader } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { ThemeToggle } from "@/components/theme-toggle";

interface SettingsMap {
  clubName?: string;
  clubDescription?: string;
  contactEmail?: string;
  contactPhone?: string;
  socialLinks?: Record<string, string>;
  theme?: string;
  logoUrl?: string;
  bannerUrl?: string;
  registrationEnabled?: boolean;
  maintenanceMode?: boolean;
}

export default function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<SettingsMap | null>(null);
  const [form, setForm] = useState({
    clubName: "",
    clubDescription: "",
    contactEmail: "",
    contactPhone: "",
    socialLinks: "",
    logoUrl: "",
    bannerUrl: "",
  });
  const [toggles, setToggles] = useState({ registrationEnabled: false, maintenanceMode: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void apiGet<SettingsMap>("/api/settings").then((s) => {
      setSettings(s);
      setForm({
        clubName: s.clubName ?? "",
        clubDescription: s.clubDescription ?? "",
        contactEmail: s.contactEmail ?? "",
        contactPhone: s.contactPhone ?? "",
        socialLinks: s.socialLinks ? JSON.stringify(s.socialLinks, null, 2) : "",
        logoUrl: s.logoUrl ?? "",
        bannerUrl: s.bannerUrl ?? "",
      });
      setToggles({
        registrationEnabled: s.registrationEnabled ?? false,
        maintenanceMode: s.maintenanceMode ?? false,
      });
    });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let socialLinks: Record<string, string> | undefined;
      if (form.socialLinks.trim()) {
        try {
          socialLinks = JSON.parse(form.socialLinks) as Record<string, string>;
        } catch {
          toast.error("Social links must be valid JSON, e.g. { \"instagram\": \"…\" }");
          setSaving(false);
          return;
        }
      }
      await apiPatch("/api/settings", {
        ...(form.clubName ? { clubName: form.clubName } : {}),
        ...(form.clubDescription ? { clubDescription: form.clubDescription } : {}),
        ...(form.contactEmail ? { contactEmail: form.contactEmail } : {}),
        ...(form.contactPhone ? { contactPhone: form.contactPhone } : {}),
        ...(socialLinks ? { socialLinks } : {}),
        ...(form.logoUrl ? { logoUrl: form.logoUrl } : {}),
        ...(form.bannerUrl ? { bannerUrl: form.bannerUrl } : {}),
        registrationEnabled: toggles.registrationEnabled,
        maintenanceMode: toggles.maintenanceMode,
      });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <PageLoader label="Loading settings…" />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-ink dark:text-gray-100">
          Settings
        </h1>
        <p className="mt-1 text-[14px] text-sub dark:text-gray-400">
          Club identity and site configuration
        </p>
      </div>

      <form onSubmit={save} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Club identity</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Club name">
                <Input
                  value={form.clubName}
                  onChange={(e) => setForm({ ...form, clubName: e.target.value })}
                  placeholder="Drama Club"
                />
              </Field>
              <Field label="Contact email">
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  placeholder="club@university.edu"
                />
              </Field>
            </div>
            <Field label="Description">
              <Textarea
                value={form.clubDescription}
                onChange={(e) => setForm({ ...form, clubDescription: e.target.value })}
                placeholder="What is your club about?"
                className="min-h-24"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact phone" optional>
                <Input
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                />
              </Field>
              <Field label="Logo URL" optional>
                <Input
                  value={form.logoUrl}
                  onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                  placeholder="https://…"
                />
              </Field>
            </div>
            <Field label="Banner URL" optional>
              <Input
                value={form.bannerUrl}
                onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })}
                placeholder="https://…"
              />
            </Field>
            <Field
              label="Social links"
              hint='JSON object, e.g. { "instagram": "https://instagram.com/dcm" }'
            >
              <Textarea
                value={form.socialLinks}
                onChange={(e) => setForm({ ...form, socialLinks: e.target.value })}
                placeholder='{ "instagram": "…", "youtube": "…" }'
                className="font-mono text-[13px]"
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardBody className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[14.5px] font-medium text-ink dark:text-gray-100">Theme</p>
              <p className="mt-0.5 text-[12.5px] text-sub dark:text-gray-400">
                System matches your device automatically.
              </p>
            </div>
            <ThemeToggle asSegmented />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Site behavior</CardTitle>
          </CardHeader>
          <CardBody className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[14.5px] font-medium text-ink dark:text-gray-100">
                  Allow registration
                </p>
                <p className="mt-0.5 text-[12.5px] text-sub dark:text-gray-400">
                  Show open registration windows on the public site.
                </p>
              </div>
              <Toggle
                checked={toggles.registrationEnabled}
                onChange={(v) => setToggles({ ...toggles, registrationEnabled: v })}
              />
            </div>
            <div className="flex items-start justify-between gap-4 border-t border-line pt-5 dark:border-white/10">
              <div>
                <p className="text-[14.5px] font-medium text-ink dark:text-gray-100">
                  Maintenance mode
                </p>
                <p className="mt-0.5 text-[12.5px] text-sub dark:text-gray-400">
                  Temporarily hide the public site.
                </p>
              </div>
              <Toggle
                checked={toggles.maintenanceMode}
                onChange={(v) => setToggles({ ...toggles, maintenanceMode: v })}
              />
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="submit" icon="check" loading={saving}>
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
