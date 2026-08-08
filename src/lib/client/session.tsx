"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiGet, ApiError } from "@/lib/client/api";
import type { SessionUser } from "@/lib/types";

/**
 * Global client-side auth state. The server (NextAuth JWT + /api/session) is
 * the single source of truth; this provider mirrors it into React and clears
 * itself on logout / session-invalidation so no part of the app can disagree
 * about whether the user is signed in.
 */
interface SessionContextValue {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  /** Resets the client-side auth state to "logged out" immediately. */
  clear: () => void;
  has: (permission: string) => boolean;
  hasAny: (permissions: string[]) => boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

// Broadcast channel key: lets every tab learn about auth changes (login/logout
// in another tab) instantly instead of waiting for focus/visibility events.
const AUTH_BROADCAST_KEY = "dcms:auth-state";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  // Epoch guard: bumped by clear()/401 so in-flight refresh responses that
  // raced with a logout can never resurrect stale user data afterwards.
  const epochRef = useRef(0);
  const refreshInFlight = useRef(false);

  const setUserSafe = useCallback((next: SessionUser | null) => {
    if (mounted.current) setUser(next);
  }, []);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    const epoch = epochRef.current;
    try {
      const data = await apiGet<{ user: SessionUser | null }>("/api/session");
      // A logout/401 happened while this request was in flight — drop it.
      if (epoch !== epochRef.current) return;
      setUserSafe(data.user);
    } catch (err) {
      if (epoch !== epochRef.current) return;
      // A genuine 401 means the session was invalidated server-side. Any other
      // failure (network blip, 5xx) keeps the current user so a transient error
      // does not bounce a validly-signed-in user off permission-gated pages.
      if (err instanceof ApiError && err.status === 401) setUserSafe(null);
    } finally {
      refreshInFlight.current = false;
      if (epoch === epochRef.current && mounted.current) setLoading(false);
    }
  }, [setUserSafe]);

  const clear = useCallback(() => {
    epochRef.current += 1; // invalidate any in-flight refresh
    setUserSafe(null);
    if (mounted.current) setLoading(false);
    try {
      window.localStorage.setItem(AUTH_BROADCAST_KEY, String(Date.now()));
    } catch {
      /* storage may be unavailable (private mode) — ignore */
    }
  }, [setUserSafe]);

  // Safety net: never leave loading=true indefinitely if /api/session hangs.
  useEffect(() => {
    const safety = setTimeout(() => {
      if (mounted.current) setLoading(false);
    }, 5000);
    return () => clearTimeout(safety);
  }, []);

  // Initial load + cross-tab synchronization.
  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => void refresh(), 0);

    // A logout/login in another tab clears/updates the same httpOnly cookie,
    // so we re-read the source of truth whenever this tab becomes active and
    // whenever a broadcast message is received.
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onFocus = () => void refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_BROADCAST_KEY) void refresh();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);

    return () => {
      mounted.current = false;
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  // Global 401 (session expired / invalidated server-side) — reset state
  // immediately. The api layer handles the actual redirect to /login.
  useEffect(() => {
    const onUnauthorized = () => {
      epochRef.current += 1; // invalidate any in-flight refresh
      setUserSafe(null);
      if (mounted.current) setLoading(false);
    };
    window.addEventListener("dcms:unauthorized", onUnauthorized);
    return () => window.removeEventListener("dcms:unauthorized", onUnauthorized);
  }, [setUserSafe]);

  const value: SessionContextValue = {
    user,
    loading,
    refresh,
    clear,
    has: (p) => user?.permissions?.includes(p) ?? false,
    hasAny: (ps) => ps.some((p) => user?.permissions?.includes(p) ?? false),
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
