"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/client/api";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { MEMBER_STATUSES, membershipStatusLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ActionIcon } from "@/components/ui/button";
import { Grid } from "@/components/ui/layout";
import { BackLink, PageHeader } from "@/components/ui/page";
import { RequirePermission } from "@/components/require-permission";

interface LinkedUser {
  id: string;
  name: string;
  email: string;
}

function AddMemberPage() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    userId: "",
    memberCode: "",
    phone: "",
    dateOfBirth: "",
    address: "",
    emergencyContact: "",
    status: "",
  });
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<LinkedUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<LinkedUser | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!open) return;
      setSearching(true);
      try {
        const data = await apiGet<{ users: LinkedUser[] }>(
          `/api/users?search=${encodeURIComponent(search)}`
        );
        setResults(data.users);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [search, open]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const pick = (u: LinkedUser) => {
    setPicked(u);
    setForm((f) => ({ ...f, userId: u.id }));
    setOpen(false);
    setActiveIndex(-1);
    toast.info(`Linked to ${u.name} (${u.email})`);
  };

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      pick(results[activeIndex]);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.userId.trim() || !form.memberCode.trim()) {
      toast.error("Choose a user and set a member code");
      return;
    }
    setSaving(true);
    try {
      await apiPost("/api/members", {
        userId: form.userId.trim(),
        memberCode: form.memberCode.trim(),
        ...(form.phone ? { phone: form.phone } : {}),
        ...(form.dateOfBirth ? { dateOfBirth: new Date(form.dateOfBirth).toISOString() } : {}),
        ...(form.address ? { address: form.address } : {}),
        ...(form.emergencyContact ? { emergencyContact: form.emergencyContact } : {}),
        ...(form.status ? { status: form.status } : {}),
      });
      toast.success("Member created");
      router.push("/dashboard/members");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create member");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <BackLink href="/dashboard/members" className="mb-2">Back to members</BackLink>
      </div>
      <PageHeader icon="members" title="Add Member" subtitle="Link a member profile to an existing user account." />

      <Card>
        <CardHeader>
          <CardTitle>Member details</CardTitle>
        </CardHeader>
        <CardBody>
          <form onSubmit={save} className="space-y-4">
            <div className="rounded-2xl bg-accent-soft/50 p-4 text-[13px] leading-relaxed text-sub dark:bg-accent/10">
              <span className="flex items-start gap-2">
                <Icon name="info" size={15} className="mt-0.5 shrink-0 text-accent" />
                <span>
                  To create a member from a registration application instead, use{" "}
                  <Link href="/dashboard/registration" className="font-medium text-accent hover:underline">
                    Registration → Applications
                  </Link>{" "}
                  and convert the applicant — the account is created automatically.
                </span>
              </span>
            </div>

            <div ref={searchBoxRef}>
              <Field
                label="User account"
                hint={picked ? `${picked.name} · ${picked.email}` : "Search by name or email"}
              >
                {picked ? (
                  <div className="bg-card flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 dark:border-white/15">
                    <div className="min-w-0">
                      <p className="truncate text-[14.5px] font-semibold text-ink">
                        {picked.name}
                      </p>
                      <p className="truncate text-[12.5px] text-sub">
                        {picked.email}
                      </p>
                    </div>
                    <ActionIcon
                      icon="close"
                      label="Change user"
                      size="xs"
                      onClick={() => {
                        setPicked(null);
                        setForm((f) => ({ ...f, userId: "" }));
                      }}
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      autoFocus
                      aria-label="User account"
                      role="combobox"
                      aria-expanded={open}
                      aria-controls="user-search-results"
                      aria-activedescendant={
                        open && activeIndex >= 0 ? `user-option-${results[activeIndex].id}` : undefined
                      }
                      aria-autocomplete="list"
                      autoComplete="off"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setActiveIndex(-1);
                        setOpen(true);
                      }}
                      onFocus={() => setOpen(true)}
                      onKeyDown={onInputKeyDown}
                      placeholder="Type a name or email…"
                    />
                    {open && (
                      <div
                        id="user-search-results"
                        role="listbox"
                        aria-label="Matching accounts"
                        className="bg-card absolute inset-x-0 top-full z-20 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-line p-1.5 shadow-card dark:border-white/15"
                      >
                        {searching && (
                          <p className="px-3 py-2.5 text-[13px] text-faint">
                            Searching…
                          </p>
                        )}
                        {!searching && results.length === 0 && (
                          <p className="px-3 py-2.5 text-[13px] text-faint">
                            No accounts found — users can create an account on the{" "}
                            <Link
                              href="/register"
                              className="text-accent hover:underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              register page
                            </Link>
                            .
                          </p>
                        )}
                        {!searching &&
                          results.map((u, i) => (
                            <button
                              key={u.id}
                              id={`user-option-${u.id}`}
                              type="button"
                              role="option"
                              aria-selected={i === activeIndex}
                              onMouseEnter={() => setActiveIndex(i)}
                              onClick={() => pick(u)}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition",
                                i === activeIndex
                                  ? "bg-accent-soft/60 dark:bg-white/10"
                                  : "hover:bg-black/[0.04] dark:hover:bg-white/10"
                              )}
                            >
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink dark:bg-accent/20">
                                <Icon name="user" size={14} />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-[13.5px] font-medium text-ink">
                                  {u.name}
                                </span>
                                <span className="block truncate text-[12px] text-sub">
                                  {u.email}
                                </span>
                              </span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </Field>
            </div>

            <Field label="Member code" hint="e.g. DCM-2026-001">
              <Input
                value={form.memberCode}
                onChange={(e) => set("memberCode", e.target.value)}
                placeholder="DCM-2026-001"
              />
            </Field>

            <Grid preset="fields">
              <Field label="Phone" optional>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1 (555) 000-0000" />
              </Field>
              <Field label="Date of birth" optional>
                <Input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => set("dateOfBirth", e.target.value)}
                />
              </Field>
            </Grid>

            <Field label="Address" optional>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Campus address" />
            </Field>

            <Grid preset="fields">
              <Field label="Emergency contact" optional>
                <Input value={form.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} placeholder="Name & phone" />
              </Field>
              <Field label="Status" optional hint="defaults to Pending">
                <Select value={form.status} onChange={(v) => set("status", v)}>
                  <option value="">— Default (Pending) —</option>
                  {MEMBER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {membershipStatusLabel(s)}
                    </option>
                  ))}
                </Select>
              </Field>
            </Grid>

            <div className="flex gap-3 pt-2">
              <Button variant="ghost" full type="button" onClick={() => router.push("/dashboard/members")}>
                Cancel
              </Button>
              <Button full type="submit" loading={saving}>
                Create Member
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

export default function AddMemberPageRoute() {
  return (
    <RequirePermission permission="member.create">
      <AddMemberPage />
    </RequirePermission>
  );
}
