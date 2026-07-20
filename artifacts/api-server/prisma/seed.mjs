/**
 * Demo/rehearsal seed for game day.
 *
 * Creates (idempotently):
 *  - a SCHIEDSRICHTER user  (username: demo-schiri / password: demo123)
 *  - an ADMIN user          (username: demo-admin  / password: demo123)
 *  - two teams with fixed check-in codes & QR tokens
 *  - two AKTIV games (SOLO "formel" with eingabefelder, plus a "zeit" game)
 *  - an active TEST gameday
 *
 * Run: pnpm --filter @workspace/api-server run db:seed
 * Safe to run multiple times.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const DEMO_PASSWORD = "demo123";

async function upsertUser({ username, name, rolle }) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return prisma.person.upsert({
    where: { username },
    update: { rolle, istAktiv: true },
    create: { username, name, rolle, passwordHash, istAktiv: true },
  });
}

async function upsertTeam({ nummer, name, farbe, checkinCode, qrToken }) {
  return prisma.team.upsert({
    where: { nummer },
    update: { name, farbe, checkinCode, qrToken },
    create: { nummer, name, farbe, checkinCode, qrToken },
  });
}

async function upsertGame(game) {
  const { slug, ...rest } = game;
  return prisma.game.upsert({
    where: { slug },
    update: { ...rest, status: "AKTIV" },
    create: { slug, ...rest, status: "AKTIV" },
  });
}

async function main() {
  // ── Users ──
  const schiri = await upsertUser({
    username: "demo-schiri",
    name: "Demo Schiedsrichter",
    rolle: "SCHIEDSRICHTER",
  });
  const admin = await upsertUser({
    username: "demo-admin",
    name: "Demo Admin",
    rolle: "ADMIN",
  });

  // ── Teams (fixed check-in codes matching the L-D-L format, e.g. "D2E") ──
  const teamAlpha = await upsertTeam({
    nummer: 101,
    name: "Demo Team Alpha",
    farbe: "#ef4444",
    checkinCode: "D2E",
    qrToken: "demo-qr-team-alpha",
  });
  const teamBravo = await upsertTeam({
    nummer: 102,
    name: "Demo Team Bravo",
    farbe: "#3b82f6",
    checkinCode: "F3G",
    qrToken: "demo-qr-team-bravo",
  });

  // ── Games (AKTIV, with wertungslogik.eingabefelder) ──
  const wurfGame = await upsertGame({
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
  const parcoursGame = await upsertGame({
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
  let gamedayNote;
  if (!activeGameday) {
    await prisma.gamedayConfig.create({
      data: { modus: "TEST", startedAt: new Date(), startedById: admin.id },
    });
    gamedayNote = "TEST gameday started";
  } else if (activeGameday.modus === "TEST") {
    gamedayNote = "TEST gameday already active";
  } else {
    gamedayNote = `Gameday im Modus ${activeGameday.modus} bereits aktiv – nicht überschrieben`;
  }

  console.log("Seed complete ✔");
  console.log("─".repeat(50));
  console.log(`Schiedsrichter login: demo-schiri / ${DEMO_PASSWORD} (id ${schiri.id})`);
  console.log(`Admin login:          demo-admin  / ${DEMO_PASSWORD}`);
  console.log(`Team ${teamAlpha.nummer} "${teamAlpha.name}": Check-in-Code D2E, QR-Token demo-qr-team-alpha`);
  console.log(`Team ${teamBravo.nummer} "${teamBravo.name}": Check-in-Code F3G, QR-Token demo-qr-team-bravo`);
  console.log(`Games AKTIV: ${wurfGame.name}, ${parcoursGame.name}`);
  console.log(`Gameday: ${gamedayNote}`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
