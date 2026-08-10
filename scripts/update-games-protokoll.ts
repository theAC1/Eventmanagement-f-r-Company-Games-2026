/**
 * Bringt eine bestehende Datenbank (Homelab/Replit/lokal) auf den Stand des
 * Spielregeln-Protokolls vom 10.08.2026 — ohne Ergebnisse oder Verknüpfungen
 * (Material, Zeitplan-Slots) zu verlieren.
 *
 * - Upsert der 11 Protokoll-Games per Slug (Name, Regeln, Wertungslogik, Modus, …)
 * - Ausgemusterte Games (xxl-basketball, geschicklichkeits-parcour) werden NICHT
 *   gelöscht, sondern auf Status ENTWURF gesetzt und aus der Wertung genommen
 * - Idempotent: mehrfaches Ausführen ist unschädlich
 * - Von der Orga justierte Laufzeitwerte bleiben beim Update erhalten:
 *   zaehltZurWertung (z. B. Eierfall-Abschaltung) und die vertraulichen
 *   Gewichtungen gewichtungG/gewichtungSieg aus dem Leitstand werden NICHT
 *   auf die Seed-Defaults zurückgesetzt (nur neu angelegte Games erhalten sie)
 *
 * Ausführen:  npm run games:update
 * (auf dem Server: docker compose run --rm app npm run games:update)
 *
 * Achtung: Bestehende gamePunkte werden hier NICHT neu berechnet. Falls es zu
 * einem Game bereits Ergebnisse gibt (sollte vor dem Event nicht der Fall sein),
 * die Wertungslogik danach einmal im Admin speichern — das stösst die
 * Neuberechnung an.
 */

import { PrismaClient, GameTyp, GameModus, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { games, ausgemusterteSlugs } from "../prisma/games-data";
import { VERTRAULICHE_WERTUNGS_KEYS } from "../src/lib/wertungslogik-types";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔄 Update der Game-Stammdaten auf Protokoll-Stand 10.08.2026\n");

  for (const game of games) {
    const daten = {
      ...game,
      typ: game.typ as GameTyp,
      modus: game.modus as GameModus,
      wertungslogik: game.wertungslogik as Prisma.InputJsonValue,
    };

    const existing = await prisma.game.findUnique({
      where: { slug: game.slug },
      select: { id: true, name: true, zaehltZurWertung: true, wertungslogik: true },
    });

    if (existing) {
      // Orga-Laufzeitwerte des bestehenden Games beibehalten:
      // (a) zaehltZurWertung nicht aus den Seed-Daten überschreiben,
      // (b) im Leitstand justierte Gewichtungen in die neue Wertungslogik mergen.
      const alteWertungslogik = existing.wertungslogik as Record<string, unknown> | null;
      const neueWertungslogik: Record<string, unknown> = {
        ...(game.wertungslogik as Record<string, unknown>),
      };
      const uebernommen: string[] = [];
      for (const key of VERTRAULICHE_WERTUNGS_KEYS) {
        const alterWert = alteWertungslogik?.[key];
        if (typeof alterWert === "number" && neueWertungslogik[key] !== alterWert) {
          neueWertungslogik[key] = alterWert;
          uebernommen.push(`${key}=${alterWert}`);
        }
      }

      await prisma.game.update({
        where: { slug: game.slug },
        data: {
          ...daten,
          zaehltZurWertung: existing.zaehltZurWertung,
          wertungslogik: neueWertungslogik as Prisma.InputJsonValue,
        },
      });
      const umbenannt = existing.name !== game.name ? ` (vorher: ${existing.name})` : "";
      console.log(`  🔁 aktualisiert: ${game.name} [${game.slug}]${umbenannt}`);
      if (existing.zaehltZurWertung !== game.zaehltZurWertung) {
        console.log(
          `     ↳ zaehltZurWertung=${existing.zaehltZurWertung} beibehalten (Orga-Einstellung)`
        );
      }
      if (uebernommen.length > 0) {
        console.log(`     ↳ Gewichtungen aus DB übernommen: ${uebernommen.join(", ")}`);
      }
    } else {
      await prisma.game.create({ data: daten });
      console.log(`  ✅ neu angelegt: ${game.name} [${game.slug}]`);
    }
  }

  for (const slug of ausgemusterteSlugs) {
    const result = await prisma.game.updateMany({
      where: { slug },
      data: { status: "ENTWURF", zaehltZurWertung: false },
    });
    if (result.count > 0) {
      console.log(`  🗑️  ausgemustert (ENTWURF, zählt nicht zur Wertung): ${slug}`);
    }
  }

  console.log(`\n✅ Fertig: ${games.length} Games auf Protokoll-Stand.\n`);
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
