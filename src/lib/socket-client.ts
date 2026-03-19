"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      // Automatisch gleicher Host wie die Seite
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on("connect", () => {
      console.log("[Socket.io] Verbunden:", socket?.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket.io] Getrennt:", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket.io] Verbindungsfehler:", err.message);
    });
  }

  return socket;
}
