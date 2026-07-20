import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../app";
import { prisma } from "../lib/prisma";
import { signToken } from "../middlewares/auth";

// Integration tests for the commitId replay guard on POST /api/ergebnisse.
// Uses the real dev database; all fixtures are created and removed here.

const SUFFIX = `commitid-test-${Date.now()}`;

let gameId: string;
let teamId: string;
let userId: string;
let gamedayConfigId: string;
let createdGameday = false;
let cookie: string;

beforeAll(async () => {
  const user = await prisma.person.create({
    data: {
      name: `Test Schiri ${SUFFIX}`,
      username: `schiri-${SUFFIX}`,
      rolle: "SCHIEDSRICHTER",
    },
  });
  userId = user.id;
  const token = signToken({ id: user.id, name: user.name, email: null, rolle: "SCHIEDSRICHTER" });
  cookie = `cg26-auth=${token}`;

  const game = await prisma.game.create({
    data: {
      name: `Test Game ${SUFFIX}`,
      slug: `test-game-${SUFFIX}`,
      typ: "NEU",
      modus: "SOLO",
      wertungslogik: { typ: "max_value", richtung: "hoechster_gewinnt", messung: "wert" },
    },
  });
  gameId = game.id;

  const maxNummer = await prisma.team.aggregate({ _max: { nummer: true } });
  const team = await prisma.team.create({
    data: { name: `Test Team ${SUFFIX}`, nummer: (maxNummer._max.nummer ?? 0) + 1000 },
  });
  teamId = team.id;

  // An active gameday is required by the endpoint; create one only if none is active.
  const active = await prisma.gamedayConfig.findFirst({ where: { modus: { not: "INAKTIV" } } });
  if (active) {
    gamedayConfigId = active.id;
  } else {
    const config = await prisma.gamedayConfig.create({ data: { modus: "TEST" } });
    gamedayConfigId = config.id;
    createdGameday = true;
  }
});

afterAll(async () => {
  await prisma.ergebnisHistory.deleteMany({ where: { ergebnis: { gameId } } });
  await prisma.ergebnis.deleteMany({ where: { gameId } });
  if (createdGameday) {
    await prisma.gamedayConfig.delete({ where: { id: gamedayConfigId } }).catch(() => {});
  }
  await prisma.game.delete({ where: { id: gameId } }).catch(() => {});
  await prisma.team.delete({ where: { id: teamId } }).catch(() => {});
  await prisma.person.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
});

describe("POST /api/ergebnisse commitId idempotency", () => {
  it("replaying the same commitId returns the existing row instead of creating a duplicate", async () => {
    const commitId = `commit-${SUFFIX}-1`;
    const body = { gameId, teamId, rohdaten: { wert: 42 }, commitId };

    const first = await request(app).post("/api/ergebnisse").set("Cookie", cookie).send(body);
    expect(first.status).toBe(201);
    expect(first.body.status).toBe("EINGETRAGEN");
    expect(first.body.commitId).toBe(commitId);

    const second = await request(app).post("/api/ergebnisse").set("Cookie", cookie).send(body);
    // Replay must be 200 (existing row), not 201 (new create)
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.status).toBe("EINGETRAGEN");

    const rows = await prisma.ergebnis.findMany({ where: { gameId, teamId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].commitId).toBe(commitId);

    // Replay must not add a history entry
    const histories = await prisma.ergebnisHistory.findMany({
      where: { ergebnisId: first.body.id },
    });
    expect(histories).toHaveLength(1);
  });

  it("a new commitId for the same game/team performs a legitimate correction (KORRIGIERT)", async () => {
    const commitId = `commit-${SUFFIX}-2`;
    const res = await request(app)
      .post("/api/ergebnisse")
      .set("Cookie", cookie)
      .send({ gameId, teamId, rohdaten: { wert: 99 }, commitId });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("KORRIGIERT");
    expect(res.body.commitId).toBe(commitId);
    expect(res.body.rohdaten).toEqual({ wert: 99 });

    const rows = await prisma.ergebnis.findMany({ where: { gameId, teamId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].gamePunkte).toBe(99);
  });
});
