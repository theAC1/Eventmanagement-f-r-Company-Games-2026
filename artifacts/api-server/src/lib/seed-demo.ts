/**
 * Shared demo/rehearsal seed logic.
 *
 * Creates (idempotently):
 *  - a SCHIEDSRICHTER user  (username: demo-schiri / password: demo123)
 *  - an ADMIN user          (username: demo-admin  / password: demo123)
 *  - two teams with fixed check-in codes & QR tokens
 *  - two AKTIV games (a "formel" game with eingabefelder, plus a "zeit" game)
 *  - an active TEST gameday (only if none is active)
 *
 * Safe to run multiple times. Used by both the CLI seed (prisma/seed.mjs)
 * and the ADMIN-only API endpoint (POST /api/gameday/seed-demo).
 */
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";

export const DEMO_PASSWORD = "demo123";

export type SeedDemoResult = {
  users: { username: string; name: string; rolle: string; password: string }[];
  teams: { nummer: number; name: string; checkinCode: string; qrToken: string }[];
  games: string[];
  gamedayNote: string;
};

type PrismaLike = Pick<PrismaClient, "person" | "team" | "game" | "gamedayConfig">;

async function upsertUser(
  prisma: PrismaLike,
  { username, name, rolle }: { username: string; name: string; rolle: string },
) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return prisma.person.upsert({
    where: { username },
    update: { rolle: rolle as never, istAktiv: true },
    create: { username, name, rolle: rolle as never, passwordHash, istAktiv: true },
  });
}

async function upsertTeam(
  prisma: PrismaLike,
  team: { nummer: number; name: string; farbe: string; checkinCode: string; qrToken: string },
) {
  const { nummer, ...rest } = team;
  return prisma.team.upsert({
    where: { nummer },
    update: rest,
    create: { nummer, ...rest },
  });
}

async function upsertGame(prisma: PrismaLike, game: Record<string, unknown>) {
  const { slug, ...rest } = game as { slug: string } & Record<string, unknown>;
  return prisma.game.upsert({
    where: { slug },
    update: { ...rest, status: "AKTIV" } as never,
    create: { slug, ...rest, status: "AKTIV" } as never,
  });
}

/**
 * Returns true if a HOT (productive) gameday is currently active.
 * The demo seed must never run against a live gameday.
 */
export async function hasHotGameday(prisma: PrismaLike): Promise<boolean> {
  const active = await prisma.gamedayConfig.findFirst({
    where: { modus: "HOT" },
    orderBy: { createdAt: "desc" },
  });
  return Boolean(active);
}

export async function seedDemo(
  prisma: PrismaLike,
  startedById?: string,
): Promise<SeedDemoResult> {
  // ── Users ──
  const schiri = await upsertUser(prisma, {
    username: "demo-schiri",
    name: "Demo Schiedsrichter",
    rolle: "SCHIEDSRICHTER",
  });
  const admin = await upsertUser(prisma, {
    username: "demo-admin",
    name: "Demo Admin",
    rolle: "ADMIN",
  });

  // ── Teams (fixed check-in codes matching the L-D-L format, e.g. "D2E") ──
  const teamAlpha = await upsertTeam(prisma, {
    nummer: 101,
    name: "Demo Team Alpha",
    farbe: "#ef4444",
    checkinCode: "D2E",
    qrToken: "demo-qr-team-alpha",
  });
  const teamBravo = await upsertTeam(prisma, {
    nummer: 102,
    name: "Demo Team Bravo",
    farbe: "#3b82f6",
    checkinCode: "F3G",
    qrToken: "demo-qr-team-bravo",
  });

  // ── Games (AKTIV, with wertungslogik.eingabefelder) ──
  const wurfGame = await upsertGame(prisma, {
    slug: "demo-praezisionswurf",
    name: "Demo Präzisionswurf",
    typ: "NEU",
    modus: "SOLO",
    teamsProSlot: 1,
    kurzbeschreibung: "Demo-Spiel für die Generalprobe: Punkte pro Wurfzone eintragen.",
    wertungstyp: "formel",
    wertungslogik: {
      typ: "formel",
      richtung: "hoechster_gewinnt",
      eingabefelder: [
        { name: "zone_a", label: "Treffer Zone A" },
        { name: "zone_b", label: "Treffer Zone B" },
      ],
    },
  });
  const parcoursGame = await upsertGame(prisma, {
    slug: "demo-zeitparcours",
    name: "Demo Zeitparcours",
    typ: "NEU",
    modus: "SOLO",
    teamsProSlot: 1,
    kurzbeschreibung: "Demo-Spiel: Zeit stoppen, Strafsekunden für Fehler.",
    wertungstyp: "zeit",
    wertungslogik: {
      typ: "zeit",
      richtung: "niedrigster_gewinnt",
      strafen: { fehler: 5 },
      eingabefelder: [
        { name: "zeit_sekunden", label: "Zeit (Sekunden)" },
        { name: "fehler", label: "Fehler" },
      ],
    },
  });

  // ── Gameday: ensure an active TEST gameday ──
  const activeGameday = await prisma.gamedayConfig.findFirst({
    where: { modus: { not: "INAKTIV" } },
    orderBy: { createdAt: "desc" },
  });
  let gamedayNote: string;
  if (!activeGameday) {
    await prisma.gamedayConfig.create({
      data: { modus: "TEST", startedAt: new Date(), startedById: startedById ?? admin.id },
    });
    gamedayNote = "TEST-Gameday gestartet";
  } else if (activeGameday.modus === "TEST") {
    gamedayNote = "TEST-Gameday bereits aktiv";
  } else {
    gamedayNote = `Gameday im Modus ${activeGameday.modus} bereits aktiv – nicht überschrieben`;
  }

  return {
    users: [
      { username: "demo-schiri", name: schiri.name, rolle: "SCHIEDSRICHTER", password: DEMO_PASSWORD },
      { username: "demo-admin", name: admin.name, rolle: "ADMIN", password: DEMO_PASSWORD },
    ],
    teams: [
      { nummer: teamAlpha.nummer, name: teamAlpha.name, checkinCode: teamAlpha.checkinCode, qrToken: teamAlpha.qrToken },
      { nummer: teamBravo.nummer, name: teamBravo.name, checkinCode: teamBravo.checkinCode, qrToken: teamBravo.qrToken },
    ],
    games: [wurfGame.name, parcoursGame.name],
    gamedayNote,
  };
}
