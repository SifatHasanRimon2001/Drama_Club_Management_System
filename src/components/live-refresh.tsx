"use client";

import { useRouter } from "next/navigation";
import { useRealtimeRefresh } from "@/lib/client/socket";

/**
 * Renders nothing; keeps server-rendered public pages fresh by re-running the
 * server components (router.refresh) whenever the realtime channel reports a
 * change to anything the public site displays (events, updates, gallery,
 * committee, departments, windows, settings, members).
 */
const PUBLIC_ENTITIES = [
  "Event",
  "ClubUpdate",
  "GalleryAlbum",
  "GalleryItem",
  "Department",
  "Committee",
  "CommitteeMemberRole",
  "RegistrationWindow",
  "SystemSetting",
  "Member",
  "Role",
];

export function LivePageRefresh() {
  const router = useRouter();
  useRealtimeRefresh(PUBLIC_ENTITIES, () => router.refresh(), 600);
  return null;
}
