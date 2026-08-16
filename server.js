/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * DCMS custom server — Next.js + Socket.IO realtime.
 *
 * Adds a live Socket.IO channel (`/socket.io`) on the same HTTP server as the
 * Next.js app, so every page can receive realtime "data changed" broadcasts
 * (see src/lib/realtime.ts and src/lib/client/socket.tsx).
 *
 *   dev:      npm run dev     (uses the Next dev server)
 *   prod:     npm run build && npm start
 */
const { createServer } = require("node:http");
const next = require("next");
const { Server } = require("socket.io");

const port = parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOSTNAME || "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

/**
 * Origins allowed to open a Socket.IO connection.
 *
 * The realtime channel is authenticated: server.js joins each socket to a
 * `user:<id>` room based on the browser's session cookie, and notification
 * payloads are pushed into that room. Reflecting arbitrary origins with
 * `credentials: true` would therefore let ANY website open a cross-origin
 * socket carrying the visitor's cookie and silently receive that user's
 * private notification stream (cross-site WebSocket hijacking).
 *
 * Same-origin browser requests are still accepted when no Origin header is
 * sent (non-browser clients) or when it matches the deployment URL.
 */
const allowedOrigins = new Set(
  [
    process.env.NEXTAUTH_URL,
    process.env.AUTH_URL,
    process.env.APP_ORIGIN,
    ...(dev
      ? [
          `http://localhost:${port}`,
          `http://127.0.0.1:${port}`,
        ]
      : []),
  ]
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return null;
      }
    })
    .filter(Boolean)
);

function isAllowedOrigin(origin, req) {
  // No Origin header: same-origin navigation or a non-browser client. Browsers
  // always send Origin on cross-site requests, so this cannot be spoofed by a
  // malicious page.
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;

  // Same-origin fallback: browsers send Origin on every WebSocket handshake,
  // including same-origin ones. Comparing against the request's own Host keeps
  // realtime working on any host/port the app is actually served from (preview
  // deploys, LAN testing, a port that differs from NEXTAUTH_URL) without
  // widening the policy — Host is the address the browser already connected to.
  const host = req?.headers?.host;
  if (!host) return false;
  try {
    const { hostname, port: originPort, protocol } = new URL(origin);
    const expected = protocol === "https:" ? "443" : "80";
    const originAuthority = `${hostname}:${originPort || expected}`;
    const hostAuthority = host.includes(":")
      ? host
      : `${host}:${req.socket?.encrypted ? "443" : "80"}`;
    return originAuthority === hostAuthority;
  } catch {
    return false;
  }
}

app
  .prepare()
  .then(() => {
    const server = createServer((req, res) => handle(req, res));
    const io = new Server(server, {
      path: "/socket.io",
      // Delegate form so the per-request Host is available for the
      // same-origin comparison above.
      cors: (req, callback) => {
        const origin = req.headers.origin;
        callback(null, {
          origin: isAllowedOrigin(origin, req) ? origin || true : false,
          credentials: true,
        });
      },
      // Rejects the WebSocket upgrade too — the `cors` option alone only
      // governs the HTTP polling handshake.
      allowRequest: (req, callback) =>
        callback(null, isAllowedOrigin(req.headers.origin, req)),
    });

    // Share the io instance with the app so API/lib code can broadcast
    // (see src/lib/realtime.ts -> getIO()).
    globalThis.__dcmsIO = io;

    io.on("connection", (socket) => {
      // Best-effort: join `user:<id>` room when the NextAuth session cookie
      // is valid, so targeted events (e.g. new notifications) reach the
      // right user only. Anonymous sockets simply skip this.
      const cookie = socket.handshake.headers.cookie || "";
      if (!cookie) return;
      fetch(`http://127.0.0.1:${port}/api/session`, {
        headers: { cookie },
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.user?.id) {
            socket.join(`user:${data.user.id}`);
            console.log(`> socket ${socket.id} joined room user:${data.user.id}`);
          }
        })
        .catch((err) => {
          // Anonymous socket — no room to join.
          if (err?.name !== "TimeoutError") {
            console.log(`> socket ${socket.id}: no session (${err?.message ?? "unknown"})`);
          }
        });
    });

    server.listen(port, hostname, (err) => {
      if (err) throw err;
      console.log(`> DCMS ready on http://localhost:${port}`);
      console.log(`> Socket.IO realtime listening on /socket.io (dev=${dev})`);
    });

    const shutdown = () => {
      console.log("\nShutting down DCMS server…");
      io.close();
      server.close(() => process.exit(0));
      // Force-exit if connections are hanging.
      setTimeout(() => process.exit(0), 3000).unref();
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
