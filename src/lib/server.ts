export const BASE_URL =
  process.env.NEXTAUTH_URL || process.env.NEXTAUTH_INTERNAL_URL || "http://localhost:3000";

export const R2_PUBLIC_URL =
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || "";

export async function publicFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Uncached variant — used where freshness matters (e.g. the maintenance gate). */
export async function publicFetchFresh<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function r2Url(key: string): string | null {
  if (!R2_PUBLIC_URL || !key) return null;
  return `${R2_PUBLIC_URL.replace(/\/+$/, "")}/${key}`;
}
