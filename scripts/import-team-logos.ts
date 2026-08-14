/**
 * Holt die Logos bestehender Teams einmalig auf unseren Server.
 *
 * Warum: Ein fremd eingebundenes Logo lädt der Badge-Export nicht. Er zeichnet
 * auf eine Canvas und muss die Bilder deshalb mit `crossOrigin="anonymous"`
 * anfordern; wer keinen CORS-Header schickt — und das sind die meisten
 * Firmen-Webserver — liefert dann gar nichts, und auf dem Badge steht die
 * Startnummer statt des Logos. Nach dem Import liegt das Bild unter
 * `/api/uploads/…` auf demselben Origin und erscheint überall.
 *
 * Neue Eingaben erledigt die Team-Maske selbst (`PUT /api/teams/:id` ruft
 * dieselbe Funktion auf). Dieses Skript ist für den Bestand.
 *
 * Ohne `--apply` wird nichts geschrieben, sondern nur gezeigt, was passieren
 * würde. Mehrfaches Ausführen ist unschädlich: bereits lokale Logos werden
 * übersprungen, und dieselbe Adresse ergibt immer denselben Dateinamen.
 *
 * Ausführen:  npm run logos:import
 *             npm run logos:import -- --apply
 * (auf dem Server: docker compose run --rm app npm run logos:import -- --apply)
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { logoUebernehmen } from "../src/lib/logo-import";
import { istLokalerPfad } from "../src/lib/logo-quelle";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const schreiben = process.argv.includes("--apply");

async function main() {
  const teams = await prisma.team.findMany({
    select: { id: true, name: true, nummer: true, logoUrl: true },
    orderBy: { nummer: "asc" },
  });

  const ohneLogo = teams.filter((t) => !t.logoUrl);
  const schonLokal = teams.filter((t) => t.logoUrl && istLokalerPfad(t.logoUrl));
  const zuHolen = teams.filter((t) => t.logoUrl && !istLokalerPfad(t.logoUrl));

  console.log(`Teams gesamt:      ${teams.length}`);
  console.log(`ohne Logo:         ${ohneLogo.length}`);
  console.log(`schon lokal:       ${schonLokal.length}`);
  console.log(`zu holen:          ${zuHolen.length}`);
  if (!schreiben) console.log("\n(Vorschau — mit --apply wird geschrieben)");
  console.log("");

  let geholt = 0;
  const gescheitert: { team: string; grund: string }[] = [];

  for (const team of zuHolen) {
    const ergebnis = await logoUebernehmen(team.logoUrl!);

    if ("fehler" in ergebnis) {
      gescheitert.push({ team: `#${team.nummer} ${team.name}`, grund: ergebnis.fehler });
      console.log(`✗ #${team.nummer} ${team.name}: ${ergebnis.fehler}`);
      console.log(`    ${team.logoUrl}`);
      continue;
    }

    geholt++;
    console.log(`✓ #${team.nummer} ${team.name} → ${ergebnis.pfad}`);
    if (schreiben) {
      await prisma.team.update({ where: { id: team.id }, data: { logoUrl: ergebnis.pfad } });
    }
  }

  console.log("");
  console.log(`Geholt:      ${geholt}`);
  console.log(`Gescheitert: ${gescheitert.length}`);

  if (gescheitert.length > 0) {
    console.log("\nDiese Logos brauchen eine andere Adresse (oder es gibt keine):");
    for (const f of gescheitert) console.log(`  ${f.team} — ${f.grund}`);
  }

  if (geholt > 0 && !schreiben) {
    console.log("\nMit `npm run logos:import -- --apply` wird es gespeichert.");
  }
}

main()
  .catch((fehler) => {
    console.error("Logo-Import fehlgeschlagen:", fehler);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
