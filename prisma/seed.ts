import { PrismaClient, GameTyp, GameModus, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { games } from "./games-data";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding Company Games 2026...\n");

  // Bestehende Games löschen (für Re-Seed auf frischen Umgebungen)
  await prisma.game.deleteMany();

  for (const game of games) {
    const created = await prisma.game.create({
      data: {
        ...game,
        typ: game.typ as GameTyp,
        modus: game.modus as GameModus,
        wertungslogik: game.wertungslogik as Prisma.InputJsonValue,
      },
    });
    console.log(`  ✅ ${created.name} (${created.slug})`);
  }

  // Admin-User erstellen
  await prisma.person.deleteMany();
  const passwordHash = await bcrypt.hash("changeme", 12);
  const admin = await prisma.person.create({
    data: {
      name: "Juan Hausherr",
      email: "juan.hausherr@gmail.com",
      username: "juan",
      passwordHash,
      rolle: "ADMIN",
    },
  });
  console.log(`\n  👤 Admin: ${admin.name} (username: juan, passwort: changeme)`);
  console.log(`  ⚠️  Passwort nach erstem Login ändern!`);

  console.log(`\n✅ Seed abgeschlossen: ${games.length} Games + 1 Admin\n`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
