import { createServer } from "http";
import { parse } from "url";
import next from "next";
import express from "express";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const expressApp = express();
  const httpServer = createServer(expressApp);

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
║  Mode:      ${dev ? "Development" : "Production"}                        ║
╚══════════════════════════════════════════════════╝
    `);
  });
});
