"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "@/lib/client/api";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { PageLoader } from "@/components/ui/feedback";
import { Grid } from "@/components/ui/layout";
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

interface StorageStatus {
  configured: boolean;
  bucket: string | null;
  publicUrl: string;
  missing: string[];
}

export default function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<SettingsMap | null>(null);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [storageFailed, setStorageFailed] = useState(false);
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
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<SettingsMap>("/api/settings")
      .then((s) => {
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
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load settings"));
    apiGet<StorageStatus>("/api/settings/storage")
      .then((s) => {
        setStorage(s);
        setStorageFailed(false);
      })
      .catch(() => {
        setStorage(null);
        setStorageFailed(true);
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
        clubName: form.clubName,
        clubDescription: form.clubDescription,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        ...(socialLinks ? { socialLinks } : {}),
        logoUrl: form.logoUrl,
        bannerUrl: form.bannerUrl,
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

  if (!settings) {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong/60 px-6 py-16 text-center">
          <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-red/10 text-red" aria-hidden="true">
            <Icon name="warn" size={26} />
          </span>
          <h3 className="text-[16px] font-semibold text-ink dark:text-gray-100">Couldn&apos;t load settings</h3>
          <p className="mt-1 max-w-sm text-sm text-sub dark:text-gray-400">{error}</p>
        </div>
      );
    }
    return <PageLoader label="Loading settings…" />;
  }

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
            <Grid preset="fields">
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
            </Grid>
            <Field label="Description">
              <Textarea
                value={form.clubDescription}
                onChange={(e) => setForm({ ...form, clubDescription: e.target.value })}
                placeholder="What is your club about?"
                className="min-h-24"
              />
            </Field>
            <Grid preset="fields">
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
            </Grid>
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
                label="Allow registration"
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
                label="Maintenance mode"
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Club storage (Cloudflare R2)</CardTitle>
          </CardHeader>
          <CardBody>
            {storageFailed ? (
              <div className="flex items-start gap-3 rounded-2xl bg-red/10 px-4 py-3.5 dark:bg-red/15">
                <Icon name="warn" size={17} className="mt-0.5 shrink-0 text-red dark:text-red-300" />
                <div>
                  <p className="text-[14px] font-semibold text-ink dark:text-gray-100">
                    Couldn&apos;t check storage configuration
                  </p>
                  <p className="mt-0.5 text-[13px] text-sub dark:text-gray-400">
                    The storage status endpoint didn&apos;t respond.{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setStorageFailed(false);
                        apiGet<StorageStatus>("/api/settings/storage")
                          .then((s) => setStorage(s))
                          .catch(() => setStorageFailed(true));
                      }}
                      className="font-medium text-accent underline-offset-2 hover:underline"
                    >
                      Try again
                    </button>
                  </p>
                </div>
              </div>
            ) : storage ? (
              storage.configured ? (
                <div className="flex items-start gap-3 rounded-2xl bg-green/12 px-4 py-3.5 dark:bg-green/20">
                  <span className="mt-1 size-2.5 shrink-0 rounded-full bg-green" />
                  <div>
                    <p className="text-[14px] font-semibold text-ink dark:text-gray-100">
                      Connected to {storage.bucket}
                    </p>
                    <p className="mt-0.5 text-[13px] text-sub dark:text-gray-400">
                      Gallery uploads are stored in Cloudflare R2.
                      {storage.publicUrl
                        ? ` Public URL: ${storage.publicUrl}`
                        : " No public URL is set — media will be stored but not publicly served."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-2xl bg-orange/12 px-4 py-3.5 dark:bg-orange/20">
                  <Icon
                    name="warn"
                    size={17}
                    className="mt-0.5 shrink-0 text-orange dark:text-orange-400"
                  />
                  <div>
                    <p className="text-[14px] font-semibold text-ink dark:text-gray-100">
                      Storage is not configured
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-sub dark:text-gray-400">
                      Gallery uploads will be disabled until the following environment variables
                      are set in <code className="rounded bg-black/[0.06] px-1.5 py-0.5 font-mono text-[12px] dark:bg-white/10">.env</code>:
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {(storage.missing.length > 0 ? storage.missing : ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"]).map(
                        (v) => (
                          <code
                            key={v}
                            className="rounded-full bg-black/[0.06] px-2.5 py-1 font-mono text-[11.5px] font-medium text-ink dark:bg-white/10 dark:text-gray-200"
                          >
                            {v}
                          </code>
                        )
                      )}
                      <code className="rounded-full bg-black/[0.06] px-2.5 py-1 font-mono text-[11.5px] font-medium text-ink dark:bg-white/10 dark:text-gray-200">
                        R2_PUBLIC_URL
                      </code>
                    </div>
                    <p className="mt-2.5 text-[12.5px] text-faint dark:text-gray-500">
                      Restart the server after updating environment variables.
                    </p>
                  </div>
                </div>
              )
            ) : (
              <p className="text-[13.5px] text-sub dark:text-gray-400">
                Checking storage configuration…
              </p>
            )}
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
