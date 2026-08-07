/**
 * Realtime broadcast helpers.
 *
 * The custom server (server.js) attaches a Socket.IO instance to the same HTTP
 * server and stores it on `globalThis.__dcmsIO`. These helpers are the app-side
 * API for broadcasting lightweight "data changed" hints. Every Prisma write is
 * wired to emitChange() via the client extension in src/lib/prisma.ts, so any
 * create/update/delete automatically refreshes every open page in real time.
 */
import type { Server as IOServer } from "socket.io";

type RealtimeGlobal = { __dcmsIO?: IOServer };

function getIO(): IOServer | undefined {
  return (globalThis as RealtimeGlobal).__dcmsIO;
}

/** Broadcast a generic data-changed hint to every connected client. */
export function emitChange(entity: string, action: string, id?: string): void {
  const io = getIO();
  if (!io) return;
  try {
    io.emit("change", { entity, action, id, at: Date.now() });
  } catch {
    /* never break the caller */
  }
}

/** Push a new notification to a single user's live sockets. */
export function emitNotification(
  userId: string,
  notification: Record<string, unknown>
): void {
  const io = getIO();
  if (!io) return;
  try {
    io.to(`user:${userId}`).emit("notification", notification);
  } catch {
    /* never break the caller */
  }
}

/** Push a lightweight "you have new notifications" hint to many users. */
export function emitNotificationToMany(userIds: string[]): void {
  const io = getIO();
  if (!io) return;
  try {
    const seen = new Set<string>();
    for (const userId of userIds) {
      if (!userId || seen.has(userId)) continue;
      seen.add(userId);
      io.to(`user:${userId}`).emit("notification", {
        _bulk: true,
        at: Date.now(),
      });
    }
  } catch {
    /* never break the caller */
  }
}
