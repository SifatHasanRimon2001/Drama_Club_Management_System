import { buildLoginUrl } from "@/lib/callback-url";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let redirectingToLogin = false;

/**
 * A 401 from any authenticated endpoint means the session is invalid/expired.
 * Reset the client-side auth state (so no stale user data survives) and send
 * the user to /login, preserving the page they were on as callbackUrl.
 */
function handleUnauthorized(currentPath: string): void {
  if (typeof window === "undefined") return;
  if (redirectingToLogin) return;
  redirectingToLogin = true;
  // Reset the guard shortly after; if the navigation above was interrupted
  // (e.g. a beforeunload prompt) later 401s must be able to redirect again.
  setTimeout(() => {
    redirectingToLogin = false;
  }, 5000);

  window.dispatchEvent(new CustomEvent("dcms:unauthorized"));
  window.location.assign(buildLoginUrl(currentPath, { expired: true }));
}

export function getCurrentPath(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname + window.location.search;
}

async function parseError(res: Response): Promise<ApiError> {
  let message = res.statusText || `Request failed (${res.status})`;
  try {
    const data = await res.json();
    if (data?.error && typeof data.error === "string") message = data.error;
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(message, res.status);
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    // Session expired or invalidated server-side: exit to the unauthenticated
    // state immediately instead of letting stale data render in the shell.
    if (res.status === 401) handleUnauthorized(getCurrentPath());
    throw await parseError(res);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return api<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return api<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return api<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) });
}

export function apiDelete<T>(path: string): Promise<T> {
  return api<T>(path, { method: "DELETE" });
}

export function mediaUrl(r2BaseUrl: string, r2Key: string): string {
  const base = r2BaseUrl.replace(/\/+$/, "");
  return `${base}/${r2Key}`;
}
