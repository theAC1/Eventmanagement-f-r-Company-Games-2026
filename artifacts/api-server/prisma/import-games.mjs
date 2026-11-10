/**
 * Importiert die Game-Stammdaten aus games-export.json (Homelab-Export) in die DB.
 *
 * Run: pnpm --filter @workspace/api-server run db:import:games -- <pfad-zur-json>
 *
 * Flags:
 *   --dry-run            nur validieren, nichts schreiben (braucht keine DB)
 *   --replace-material   bestehendes Material eines Games ersetzen
 *
 * Idempotent: Games werden per "slug" geupsertet, nicht per ID. Ein Game, das
 * in der Ziel-DB bereits existiert (z.B. aus dem Demo-Seed), wird aktualisiert
 * statt dupliziert. Das ganze Ding läuft in einer Transaktion — entweder es geht
 * komplett durch, oder die DB bleibt unverändert.
 *
 * Material wird per Default nur für Games angelegt, die noch keines haben.
 * Mit --replace-material wird bestehendes Material eines Games ersetzt
 * (Achtung: löscht auch die daran hängenden MaterialKommentare).
 */
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { GamesExport, findeKaputteReferenzen } from "./games-export.schema.mjs";

const TRANSACTION_TIMEOUT_MS = 120_000;

// ─── Import ───

async function importGames(tx, games) {
  const slugToId = new Map();

  for (const { varianten, ...game } of games) {
    const record = await tx.game.upsert({
      where: { slug: game.slug },
      update: game,
      create: game,
    });
    slugToId.set(game.slug, record.id);

    // Varianten hängen komplett am Game und haben keinen eigenen fachlichen
    // Schlüssel -> vollständig ersetzen statt zu mergen.
    await tx.gameVariante.deleteMany({ where: { gameId: record.id } });
    if (varianten.length > 0) {
      await tx.gameVariante.createMany({
        data: varianten.map((v) => ({ ...v, gameId: record.id })),
      });
    }
  }

  return slugToId;
}

async function importMaterial(tx, material, slugToId, replace) {
  const byGame = new Map();
  for (const { gameSlug, ...item } of material) {
    const gameId = slugToId.get(gameSlug);
    if (!gameId) throw new Error(`Material "${item.name}" verweist auf unbekanntes Game "${gameSlug}"`);
    if (!byGame.has(gameId)) byGame.set(gameId, []);
    byGame.get(gameId).push({ ...item, gameId });
  }

  let created = 0;
  let skipped = 0;

  for (const [gameId, items] of byGame) {
    const vorhanden = await tx.materialItem.count({ where: { gameId } });

    if (vorhanden > 0 && !replace) {
      skipped += items.length;
      continue;
    }
    if (vorhanden > 0) {
      await tx.materialItem.deleteMany({ where: { gameId } });
    }

    await tx.materialItem.createMany({ data: items });
    created += items.length;
  }

  return { created, skipped };
}

async function importPlaene(tx, plaene, slugToId) {
  let positionen = 0;

  for (const { gamePositionen, customFelder, ...plan } of plaene) {
    // Situationsplan hat keinen Unique-Key auf "name" -> manuell auflösen.
    const vorhanden = await tx.situationsplan.findFirst({ where: { name: plan.name } });
    const record = vorhanden
      ? await tx.situationsplan.update({ where: { id: vorhanden.id }, data: plan })
      : await tx.situationsplan.create({ data: plan });

    for (const { gameSlug, ...pos } of gamePositionen) {
      const gameId = slugToId.get(gameSlug);
      if (!gameId) throw new Error(`Position im Plan "${plan.name}" verweist auf unbekanntes Game "${gameSlug}"`);

      await tx.gamePosition.upsert({
        where: { planId_gameId: { planId: record.id, gameId } },
        update: pos,
        create: { ...pos, planId: record.id, gameId },
      });
      positionen++;
    }

    await tx.customFeld.deleteMany({ where: { planId: record.id } });
    if (customFelder.length > 0) {
      await tx.customFeld.createMany({
        data: customFelder.map((cf) => ({ ...cf, planId: record.id })),
      });
    }
  }

  return positionen;
}

// ─── CLI ───

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find((a) => !a.startsWith("--")) ?? "games-export.json";
  const replaceMaterial = args.includes("--replace-material");
  const dryRun = args.includes("--dry-run");

  // Erst die Datei prüfen — ohne DB, damit ein kaputter Export auffällt,
  // bevor irgendetwas geschrieben wird.
  let raw;
  try {
    raw = JSON.parse(await readFile(filePath, "utf8"));
  } catch (err) {
    throw new Error(`Export-Datei "${filePath}" nicht lesbar: ${err.message}`);
  }

  const parsed = GamesExport.safeParse(raw);
  if (!parsed.success) {
    console.error("Export-Datei entspricht nicht dem erwarteten Format:");
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    throw new Error("Validierung fehlgeschlagen — nichts importiert.");
  }
  const data = parsed.data;

  const refFehler = findeKaputteReferenzen(data);
  if (refFehler.length > 0) {
    console.error("Der Export ist in sich nicht schlüssig:");
    for (const f of refFehler) console.error(`  ${f}`);
    throw new Error("Validierung fehlgeschlagen — nichts importiert.");
  }

  if (dryRun) {
    console.log(`Export "${filePath}" (vom ${data.exportedAt}) ist gültig ✔`);
    console.log(`  Games:    ${data.games.length}`);
    console.log(`  Material: ${data.material.length}`);
    console.log(`  Pläne:    ${data.plaene.length}`);
    console.log("\n--dry-run: nichts geschrieben.");
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const slugToId = await importGames(tx, data.games);
        const mat = await importMaterial(tx, data.material, slugToId, replaceMaterial);
        const positionen = await importPlaene(tx, data.plaene, slugToId);
        return { games: slugToId.size, mat, positionen };
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );

    console.log(`Import aus "${filePath}" (Export vom ${data.exportedAt}) ✔`);
    console.log("─".repeat(50));
    console.log(`Games:            ${result.games}`);
    console.log(`Material:         ${result.mat.created} importiert, ${result.mat.skipped} übersprungen`);
    console.log(`Pläne:            ${data.plaene.length} (${result.positionen} Game-Positionen)`);
    if (result.mat.skipped > 0) {
      console.log("\nHinweis: Übersprungenes Material gehört zu Games, die bereits Material haben.");
      console.log("Mit --replace-material wird es ersetzt (löscht auch MaterialKommentare).");
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Import fehlgeschlagen:", err.message);
  process.exitCode = 1;
});
