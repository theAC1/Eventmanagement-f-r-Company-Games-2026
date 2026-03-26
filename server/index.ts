import { createServer } from "http";
import { parse } from "url";
import next from "next";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import { setupSocketHandlers } from "./socket";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const expressApp = express();
  const httpServer = createServer(expressApp);

  // Socket.io Server
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: dev ? "http://localhost:3000" : (process.env.APP_URL || process.env.NEXTAUTH_URL),
      methods: ["GET", "POST"],
    },
    // Ping alle 25 Sek, Timeout nach 60 Sek
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  // Socket.io an Express anhängen (für API Routes zugänglich)
  expressApp.set("io", io);

  // Socket.io Event Handlers
  setupSocketHandlers(io);

  // Alle anderen Requests → Next.js
  expressApp.all("/{*path}", (req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  httpServer.listen(port, hostname, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║  Company Games 2026 - Server läuft              ║
║  ──────────────────────────────────────────────  ║
║  HTTP:      http://${hostname}:${port}              ║
║  Socket.io: ws://${hostname}:${port}                ║
║  Mode:      ${dev ? "Development" : "Production"}                        ║
╚══════════════════════════════════════════════════╝
    `);
  });
});
