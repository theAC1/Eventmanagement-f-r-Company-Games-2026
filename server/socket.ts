import { Server as SocketIOServer, Socket } from "socket.io";

export function setupSocketHandlers(io: SocketIOServer) {
  io.on("connection", (socket: Socket) => {
    console.log(`[Socket.io] Client verbunden: ${socket.id}`);

    // ─── Room Management ───

    // Admin Dashboard
    socket.on("join:admin", () => {
      socket.join("admin");
      console.log(`[Socket.io] ${socket.id} → admin room`);
    });

    // Schiedsrichter einer Station
    socket.on("join:station", (gameId: string) => {
      socket.join(`station:${gameId}`);
      console.log(`[Socket.io] ${socket.id} → station:${gameId}`);
    });

    // Team-Portal
    socket.on("join:team", (teamId: string) => {
      socket.join(`team:${teamId}`);
      console.log(`[Socket.io] ${socket.id} → team:${teamId}`);
    });

    // Public Scoreboard
    socket.on("join:scoreboard", () => {
      socket.join("scoreboard");
      console.log(`[Socket.io] ${socket.id} → scoreboard`);
    });

    // ─── Schiedsrichter Events ───

    // Ergebnis eintragen
    socket.on("ergebnis:eintragen", async (data) => {
      console.log(`[Socket.io] Neues Ergebnis:`, data);
      // TODO: In DB speichern, Rang berechnen, dann broadcasten
      // Wird in Phase 2a (M6) implementiert

      // Broadcast an alle relevanten Clients
      io.to("admin").emit("ergebnis:neu", data);
      io.to("scoreboard").emit("rangliste:update", data);
      if (data.teamId) {
        io.to(`team:${data.teamId}`).emit("ergebnis:neu", data);
      }
    });

    // Station bereit
    socket.on("station:bereit", (data) => {
      io.to("admin").emit("slot:status", {
        ...data,
        status: "bereit",
      });
    });

    // Station meldet Problem
    socket.on("station:problem", (data) => {
      io.to("admin").emit("station:alert", data);
      console.log(`[Socket.io] ⚠️ Problem bei Station:`, data);
    });

    // ─── QR Events ───

    socket.on("qr:scan", (data) => {
      console.log(`[Socket.io] QR-Scan:`, data);
      // TODO: Verifizierung in DB speichern
      io.to("admin").emit("team:verifiziert", data);
      io.to(`station:${data.gameId}`).emit("team:verifiziert", data);
    });

    // ─── Disconnect ───

    socket.on("disconnect", (reason) => {
      console.log(`[Socket.io] Client getrennt: ${socket.id} (${reason})`);
    });
  });

  // Verbindungsstatistik
  setInterval(() => {
    const count = io.engine.clientsCount;
    if (count > 0) {
      console.log(`[Socket.io] Aktive Verbindungen: ${count}`);
    }
  }, 60000); // Jede Minute
}
