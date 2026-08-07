export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(value?: string | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function timeAgo(value?: string | Date | null): string {
  if (!value) return "—";
  const d = new Date(value).getTime();
  if (Number.isNaN(d)) return "—";
  const seconds = Math.floor((Date.now() - d) / 1000);
  if (seconds < 45) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(new Date(d));
}

export function toIsoInput(value: string | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export const MEMBER_STATUSES = ["PENDING", "ACTIVE", "ALUMNI", "INACTIVE", "SUSPENDED"] as const;
export const EVENT_TYPES = ["WORKSHOP", "REHEARSAL", "PERFORMANCE", "AUDITION", "FESTIVAL", "TRAINING"] as const;
export const EVENT_STATUSES = ["DRAFT", "UPCOMING", "ONGOING", "COMPLETED", "CANCELLED"] as const;
export const APPLICANT_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "REJECTED", "CONVERTED"] as const;
export const REG_WINDOW_STATUSES = ["DRAFT", "SCHEDULED", "LIVE", "CLOSED"] as const;
export const PROMOTION_STATUSES = ["DRAFT", "SUBMITTED", "PENDING_APPROVAL", "APPROVED", "REJECTED"] as const;
export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
export const UPDATE_CATEGORIES = ["ANNOUNCEMENT", "NOTICE", "ACHIEVEMENT", "PRODUCTION", "RECRUITMENT", "EVENT"] as const;
export const ALBUM_CATEGORIES = ["PRODUCTIONS", "WORKSHOPS", "BEHIND_THE_SCENES", "FESTIVALS", "REHEARSALS", "CLUB_LIFE"] as const;

export const EVENT_TYPE_ICONS: Record<string, string> = {
  WORKSHOP: "note",
  REHEARSAL: "clock",
  PERFORMANCE: "star",
  AUDITION: "music",
  FESTIVAL: "trophy",
  TRAINING: "doc",
};

export const EVENT_TYPE_TONES: Record<string, string> = {
  WORKSHOP: "blue",
  REHEARSAL: "teal",
  PERFORMANCE: "purple",
  AUDITION: "pink",
  FESTIVAL: "orange",
  TRAINING: "indigo",
};

export function membershipStatusLabel(s: string): string {
  const map: Record<string, string> = {
    PENDING: "Pending",
    ACTIVE: "Active",
    ALUMNI: "Alumni",
    INACTIVE: "Inactive",
    SUSPENDED: "Suspended",
  };
  return map[s] ?? s;
}

export function windowStatusLabel(s: string): string {
  const map: Record<string, string> = {
    DRAFT: "Draft",
    SCHEDULED: "Scheduled",
    LIVE: "Live",
    CLOSED: "Closed",
  };
  return map[s] ?? s;
}

export function applicantStatusLabel(s: string): string {
  const map: Record<string, string> = {
    SUBMITTED: "Submitted",
    UNDER_REVIEW: "Under review",
    ACCEPTED: "Accepted",
    REJECTED: "Rejected",
    CONVERTED: "Converted",
  };
  return map[s] ?? s;
}

export function promotionStatusLabel(s: string): string {
  const map: Record<string, string> = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    PENDING_APPROVAL: "Pending approval",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  };
  return map[s] ?? s;
}

export function taskStatusLabel(s: string): string {
  const map: Record<string, string> = {
    TODO: "To do",
    IN_PROGRESS: "In progress",
    DONE: "Done",
  };
  return map[s] ?? s;
}

export function eventTypeLabel(s: string): string {
  const map: Record<string, string> = {
    WORKSHOP: "Workshop",
    REHEARSAL: "Rehearsal",
    PERFORMANCE: "Performance",
    AUDITION: "Audition",
    FESTIVAL: "Festival",
    TRAINING: "Training",
  };
  return map[s] ?? s;
}

export function eventStatusLabel(s: string): string {
  const map: Record<string, string> = {
    DRAFT: "Draft",
    UPCOMING: "Upcoming",
    ONGOING: "Ongoing",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };
  return map[s] ?? s;
}

export function updateCategoryLabel(s: string): string {
  const map: Record<string, string> = {
    ANNOUNCEMENT: "Announcement",
    NOTICE: "Notice",
    ACHIEVEMENT: "Achievement",
    PRODUCTION: "Production",
    RECRUITMENT: "Recruitment",
    EVENT: "Event",
  };
  return map[s] ?? s;
}

export function albumCategoryLabel(s: string): string {
  const map: Record<string, string> = {
    PRODUCTIONS: "Productions",
    WORKSHOPS: "Workshops",
    BEHIND_THE_SCENES: "Behind the scenes",
    FESTIVALS: "Festivals",
    REHEARSALS: "Rehearsals",
    CLUB_LIFE: "Club life",
  };
  return map[s] ?? s;
}
