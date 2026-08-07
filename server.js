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

app
  .prepare()
  .then(() => {
    const server = createServer((req, res) => handle(req, res));
    const io = new Server(server, {
      path: "/socket.io",
      cors: { origin: true, credentials: true },
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
