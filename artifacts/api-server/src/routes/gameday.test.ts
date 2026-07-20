import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import type { Server } from "http";

vi.mock("../lib/prisma", () => ({
  prisma: {
    gamedayConfig: { findFirst: vi.fn() },
    ergebnis: { count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../middlewares/auth", () => ({
  requireRole: vi.fn(() => ({ id: "admin-1", role: "ADMIN" })),
  getAuthUser: vi.fn(),
}));

vi.mock("../lib/game-punkte", () => ({
  updateGameRaenge: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "../lib/prisma";
import { updateGameRaenge } from "../lib/game-punkte";
import gamedayRouter from "./gameday";

const mocked = prisma as unknown as {
  gamedayConfig: { findFirst: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

let server: Server;
let baseUrl: string;

beforeEach(async () => {
  vi.clearAllMocks();
  const app = express();
  app.use(express.json());
  app.use("/api/gameday", gamedayRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address();
  if (typeof addr === "object" && addr) baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

function makeTx(testErgebnisse: { id: string; gameId: string }[], games: { id: string; wertungslogik: unknown }[]) {
  const tx = {
    ergebnis: {
      findMany: vi.fn().mockResolvedValue(testErgebnisse),
      deleteMany: vi.fn().mockResolvedValue({ count: testErgebnisse.length }),
    },
    ergebnisHistory: {
      deleteMany: vi.fn().mockResolvedValue({ count: testErgebnisse.length * 2 }),
    },
    game: {
      findMany: vi.fn().mockResolvedValue(games),
    },
  };
  mocked.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(tx));
  return tx;
}

async function postReset() {
  return fetch(`${baseUrl}/api/gameday/reset`, { method: "POST" });
}

describe("POST /api/gameday/reset — purge of test results", () => {
  it("löscht Test-Ergebnisse + History und berechnet Ränge der betroffenen Games neu", async () => {
    mocked.gamedayConfig.findFirst.mockResolvedValue({ id: "c1", modus: "TEST" });
    const testErgebnisse = [
      { id: "e1", gameId: "g1" },
      { id: "e2", gameId: "g1" },
      { id: "e3", gameId: "g2" },
    ];
    const games = [
      { id: "g1", wertungslogik: { typ: "max_value", messung: "punkte" } },
      { id: "g2", wertungslogik: null },
    ];
    const tx = makeTx(testErgebnisse, games);

    const res = await postReset();
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.deleted).toEqual({ ergebnisse: 3, history: 6 });

    // History wird für genau die Test-Ergebnis-IDs gelöscht
    expect(tx.ergebnisHistory.deleteMany).toHaveBeenCalledWith({
      where: { ergebnisId: { in: ["e1", "e2", "e3"] } },
    });
    expect(tx.ergebnis.deleteMany).toHaveBeenCalledWith({ where: { istTest: true } });

    // Nur betroffene Games (dedupliziert) werden neu berechnet
    expect(tx.game.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["g1", "g2"] } },
      select: { id: true, wertungslogik: true },
    });
    expect(updateGameRaenge).toHaveBeenCalledTimes(2);
    expect(updateGameRaenge).toHaveBeenCalledWith("g1", games[0].wertungslogik, expect.anything());
    expect(updateGameRaenge).toHaveBeenCalledWith("g2", null, expect.anything());
  });

  it("ohne Test-Ergebnisse: nichts wird gelöscht und keine Rang-Neuberechnung", async () => {
    mocked.gamedayConfig.findFirst.mockResolvedValue({ id: "c1", modus: "INAKTIV" });
    const tx = makeTx([], []);

    const res = await postReset();
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.deleted).toEqual({ ergebnisse: 0, history: 0 });

    expect(tx.ergebnis.deleteMany).not.toHaveBeenCalled();
    expect(tx.ergebnisHistory.deleteMany).not.toHaveBeenCalled();
    expect(updateGameRaenge).not.toHaveBeenCalled();
  });

  it("im HOT-Modus wird der Reset abgelehnt (400) und keine Transaktion gestartet", async () => {
    mocked.gamedayConfig.findFirst.mockResolvedValue({ id: "c1", modus: "HOT" });

    const res = await postReset();
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toMatch(/HOT/);
    expect(mocked.$transaction).not.toHaveBeenCalled();
  });
});
