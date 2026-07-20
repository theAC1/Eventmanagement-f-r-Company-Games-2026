/**
 * Remove demo/rehearsal seed data created by prisma/seed.mjs.
 *
 * Deletes (idempotently, only demo-* entities and their dependent records):
 *  - the demo users   (username: demo-schiri, demo-admin)
 *  - the demo teams    (qrToken demo-qr-team-alpha, demo-qr-team-bravo)
 *  - the demo games    (slug demo-praezisionswurf, demo-zeitparcours)
 *  - all records that depend on the above (results, QR scans, positions, …)
 *
 * Real (non-demo) data is never touched. Running this when no demo data
 * exists is a safe no-op.
 *
 * Run: pnpm --filter @workspace/api-server run db:seed:clean
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const DEMO_USERNAMES = ["demo-schiri", "demo-admin"];
// Match teams by their demo-unique qrToken (set by seed.mjs), NOT by team
// number – real teams could legitimately use numbers 101/102.
const DEMO_TEAM_QR_TOKENS = ["demo-qr-team-alpha", "demo-qr-team-bravo"];
const DEMO_GAME_SLUGS = ["demo-praezisionswurf", "demo-zeitparcours"];

async function main() {
  const [demoPersons, demoTeams, demoGames] = await Promise.all([
    prisma.person.findMany({
      where: { username: { in: DEMO_USERNAMES } },
      select: { id: true },
    }),
    prisma.team.findMany({
      where: { qrToken: { in: DEMO_TEAM_QR_TOKENS } },
      select: { id: true },
    }),
    prisma.game.findMany({
      where: { slug: { in: DEMO_GAME_SLUGS } },
      select: { id: true },
    }),
  ]);

  const personIds = demoPersons.map((p) => p.id);
  const teamIds = demoTeams.map((t) => t.id);
  const gameIds = demoGames.map((g) => g.id);

  if (personIds.length === 0 && teamIds.length === 0 && gameIds.length === 0) {
    console.log("No demo data found – nothing to clean. ✔");
    return;
  }

  const counts = await prisma.$transaction(async (tx) => {
    // Restrict-protected dependents must be deleted before their parents.

    // QRVerifikation restricts on team & schiedsrichter.
    const qr = await tx.qRVerifikation.deleteMany({
      where: {
        OR: [
          { teamId: { in: teamIds } },
          { schiedsrichterId: { in: personIds } },
        ],
      },
    });

    // Ergebnis restricts on game & team (ErgebnisHistory cascades from it).
    const ergebnis = await tx.ergebnis.deleteMany({
      where: {
        OR: [{ gameId: { in: gameIds } }, { teamId: { in: teamIds } }],
      },
    });

    // GamePosition restricts on game.
    const gamePos = await tx.gamePosition.deleteMany({
      where: { gameId: { in: gameIds } },
    });

    // ZeitplanSlotTeam.team has no onDelete rule (restrict), so slot
    // assignments for demo teams must be removed before the teams.
    await tx.zeitplanSlotTeam.deleteMany({
      where: { teamId: { in: teamIds } },
    });

    // Person is restrict-referenced as createdBy/updatedBy on Game, Team and
    // MaterialItem. Clear any such pointers that reference a demo person so
    // the person rows can be removed (SetNull semantics; only demo pointers
    // are affected, real content is untouched).
    if (personIds.length > 0) {
      await tx.game.updateMany({
        where: { createdById: { in: personIds } },
        data: { createdById: null },
      });
      await tx.game.updateMany({
        where: { updatedById: { in: personIds } },
        data: { updatedById: null },
      });
      await tx.team.updateMany({
        where: { createdById: { in: personIds } },
        data: { createdById: null },
      });
      await tx.team.updateMany({
        where: { updatedById: { in: personIds } },
        data: { updatedById: null },
      });
      await tx.materialItem.updateMany({
        where: { createdById: { in: personIds } },
        data: { createdById: null },
      });
      await tx.materialItem.updateMany({
        where: { updatedById: { in: personIds } },
        data: { updatedById: null },
      });
    }

    // Parents. Remaining dependents (GameVariante) cascade;
    // SetNull relations (ZeitplanSlot.gameId, MaterialItem.gameId,
    // GamedayConfig.startedById, …) are cleared automatically.
    const games = await tx.game.deleteMany({
      where: { id: { in: gameIds } },
    });
    const teams = await tx.team.deleteMany({
      where: { id: { in: teamIds } },
    });
    const persons = await tx.person.deleteMany({
      where: { id: { in: personIds } },
    });

    return {
      persons: persons.count,
      teams: teams.count,
      games: games.count,
      ergebnisse: ergebnis.count,
      qrScans: qr.count,
      gamePositionen: gamePos.count,
    };
  });

  console.log("Demo data cleaned ✔");
  console.log("─".repeat(50));
  console.log(`Users removed:        ${counts.persons}`);
  console.log(`Teams removed:        ${counts.teams}`);
  console.log(`Games removed:        ${counts.games}`);
  console.log(`Results removed:      ${counts.ergebnisse}`);
  console.log(`QR scans removed:     ${counts.qrScans}`);
  console.log(`Map positions removed:${counts.gamePositionen}`);
}

main()
  .catch((err) => {
    console.error("Clean failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
