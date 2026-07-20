/**
 * Demo/rehearsal seed for game day (CLI entrypoint).
 *
 * Thin wrapper around the shared seed logic in src/lib/seed-demo.ts so the
 * CLI and the ADMIN-only API endpoint stay in sync.
 *
 * Run: pnpm --filter @workspace/api-server run db:seed
 * Safe to run multiple times.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { seedDemo, DEMO_PASSWORD } from "../src/lib/seed-demo.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const result = await seedDemo(prisma);

  console.log("Seed complete ✔");
  console.log("─".repeat(50));
  for (const u of result.users) {
    console.log(`${u.rolle} login: ${u.username} / ${DEMO_PASSWORD}`);
  }
  for (const t of result.teams) {
    console.log(`Team ${t.nummer} "${t.name}": Check-in-Code ${t.checkinCode}, QR-Token ${t.qrToken}`);
  }
  console.log(`Games AKTIV: ${result.games.join(", ")}`);
  console.log(`Gameday: ${result.gamedayNote}`);
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
