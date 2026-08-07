"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";

export interface RealtimeChange {
  entity: string;
  action: string;
  id?: string;
  at: number;
}

interface RealtimeContextValue {
  connected: boolean;
  onChange: (handler: (ev: RealtimeChange) => void) => () => void;
  onNotification: (handler: (payload: Record<string, unknown>) => void) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

// Single socket for the whole app (module-scope singleton survives HMR).
let socketSingleton: Socket | null = null;

function getSocket(): Socket {
  if (!socketSingleton) {
    socketSingleton = io({
      autoConnect: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });
  }
  return socketSingleton;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  // Lazily seed from the shared singleton (already connected after HMR/remount).
  const [connected, setConnected] = useState<boolean>(
    () => socketSingleton?.connected ?? false
  );
  const changeHandlers = useRef(new Set<(ev: RealtimeChange) => void>());
  const notifHandlers = useRef(new Set<(payload: Record<string, unknown>) => void>());

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onChange = (ev: RealtimeChange) => {
      changeHandlers.current.forEach((h) => h(ev));
    };
    const onNotification = (payload: Record<string, unknown>) => {
      notifHandlers.current.forEach((h) => h(payload));
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("change", onChange);
    socket.on("notification", onNotification);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("change", onChange);
      socket.off("notification", onNotification);
    };
  }, []);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      connected,
      onChange: (handler) => {
        changeHandlers.current.add(handler);
        return () => changeHandlers.current.delete(handler);
      },
      onNotification: (handler) => {
        notifHandlers.current.add(handler);
        return () => notifHandlers.current.delete(handler);
      },
    }),
    [connected]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within RealtimeProvider");
  return ctx;
}

/**
 * Debounced live refresh: whenever the server broadcasts a change for one of
 * the given entity names, `refresh()` runs once after a short quiet period
 * (so bursts of writes trigger a single refetch). Safe to call on any page.
 */
export function useRealtimeRefresh(
  entities: string[],
  refresh: () => void,
  delay = 450
): void {
  const realtime = useRealtime();
  const entityKey = entities.join(",");
  // entityKey is a stable serialization of entities, so it is the real dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const wanted = useMemo(() => new Set(entities), [entityKey]);
  const refreshRef = useRef(refresh);

  // Keep the latest callback without resubscribing (runs after every render).
  useEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    if (!realtime.connected) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = realtime.onChange((ev) => {
      if (!wanted.has(ev.entity)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => refreshRef.current(), delay);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [realtime, wanted, delay]);
}

/**
 * Live push handler for targeted notifications (bell badge + toast).
 */
export function useRealtimeNotification(
  handler: (payload: Record<string, unknown>) => void
): void {
  const realtime = useRealtime();
  const handlerRef = useRef(handler);

  // Keep the latest handler without resubscribing.
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!realtime.connected) return;
    return realtime.onNotification((payload) => handlerRef.current(payload));
  }, [realtime]);
}
