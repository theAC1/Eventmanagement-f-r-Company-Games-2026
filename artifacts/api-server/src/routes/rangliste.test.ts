import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import type { Server } from "http";

vi.mock("../lib/prisma", () => ({
  prisma: {
    gamedayConfig: { findFirst: vi.fn() },
    ergebnis: { findMany: vi.fn() },
    team: { findMany: vi.fn() },
    game: { findMany: vi.fn() },
  },
}));

import { prisma } from "../lib/prisma";
import ranglisteRouter from "./rangliste";

const mocked = prisma as unknown as {
  gamedayConfig: { findFirst: ReturnType<typeof vi.fn> };
  ergebnis: { findMany: ReturnType<typeof vi.fn> };
  team: { findMany: ReturnType<typeof vi.fn> };
  game: { findMany: ReturnType<typeof vi.fn> };
};

let server: Server;
let baseUrl: string;

beforeEach(async () => {
  vi.clearAllMocks();
  const app = express();
  app.use("/api/rangliste", ranglisteRouter);
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

const alleErgebnisse = [
  // echtes Ergebnis
  { id: "e1", gameId: "g1", teamId: "t1", gamePunkte: 10, rangImGame: 1, rangPunkte: 1, istTest: false },
  // Test-Ergebnis (Probelauf)
  { id: "e2", gameId: "g1", teamId: "t2", gamePunkte: 8, rangImGame: 2, rangPunkte: 2, istTest: true },
];

const teams = [
  { id: "t1", name: "Team Alpha", nummer: 1 },
  { id: "t2", name: "Team Beta", nummer: 2 },
];

/**
 * Simulates the DB: returns results filtered by the where clause the route
 * builds. This verifies the actual gating (istTest filter) end-to-end.
 */
function setupDb() {
  mocked.ergebnis.findMany.mockImplementation(async ({ where }: any) => {
    let rows = alleErgebnisse;
    if (where && where.istTest === false) rows = rows.filter((r) => !r.istTest);
    return rows.map(({ istTest: _t, ...rest }) => rest);
  });
  mocked.team.findMany.mockResolvedValue(teams);
  mocked.game.findMany.mockResolvedValue([{ id: "g1" }]);
}

async function getRangliste() {
  const res = await fetch(`${baseUrl}/api/rangliste`);
  expect(res.status).toBe(200);
  return res.json() as Promise<any>;
}

describe("GET /api/rangliste — istTest gating per gameday modus", () => {
  it("TEST-Modus: Test-Ergebnisse fliessen in die Rangliste ein", async () => {
    mocked.gamedayConfig.findFirst.mockResolvedValue({ modus: "TEST" });
    setupDb();

    const body = await getRangliste();

    expect(body.modus).toBe("TEST");
    expect(body.enthaeltTestErgebnisse).toBe(true);
    expect(body.ergebnisseEingetragen).toBe(2);
    const teamIds = body.rangliste.map((r: any) => r.teamId).sort();
    expect(teamIds).toEqual(["t1", "t2"]);

    // Route must NOT filter istTest in TEST mode
    const where = mocked.ergebnis.findMany.mock.calls[0][0].where;
    expect(where.istTest).toBeUndefined();
  });

  it("HOT-Modus: Test-Ergebnisse werden ausgeschlossen", async () => {
    mocked.gamedayConfig.findFirst.mockResolvedValue({ modus: "HOT" });
    setupDb();

    const body = await getRangliste();

    expect(body.modus).toBe("HOT");
    expect(body.enthaeltTestErgebnisse).toBe(false);
    expect(body.ergebnisseEingetragen).toBe(1);
    const teamIds = body.rangliste.map((r: any) => r.teamId);
    expect(teamIds).toEqual(["t1"]);
    expect(teamIds).not.toContain("t2");

    const where = mocked.ergebnis.findMany.mock.calls[0][0].where;
    expect(where.istTest).toBe(false);
  });

  it("INAKTIV-Modus: Test-Ergebnisse werden ausgeschlossen", async () => {
    mocked.gamedayConfig.findFirst.mockResolvedValue({ modus: "INAKTIV" });
    setupDb();

    const body = await getRangliste();

    expect(body.modus).toBe("INAKTIV");
    expect(body.enthaeltTestErgebnisse).toBe(false);
    expect(body.ergebnisseEingetragen).toBe(1);
    expect(body.rangliste.map((r: any) => r.teamId)).toEqual(["t1"]);

    const where = mocked.ergebnis.findMany.mock.calls[0][0].where;
    expect(where.istTest).toBe(false);
  });

  it("Ohne GamedayConfig (null): verhält sich wie INAKTIV und schliesst Tests aus", async () => {
    mocked.gamedayConfig.findFirst.mockResolvedValue(null);
    setupDb();

    const body = await getRangliste();

    expect(body.modus).toBe("INAKTIV");
    expect(body.enthaeltTestErgebnisse).toBe(false);
    expect(body.ergebnisseEingetragen).toBe(1);
  });
});
