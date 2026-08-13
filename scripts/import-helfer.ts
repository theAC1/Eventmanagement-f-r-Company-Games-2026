/**
 * Führt die konsolidierte Helferliste (`prisma/helfer-data.ts`) mit den
 * Accounts zusammen, die bereits in der Datenbank liegen, und setzt die
 * Posten-Crew gemäss Einsatzplan.
 *
 * Zusammenführen heisst ergänzen, nicht überschreiben:
 *  - bestehende Accounts behalten ihre Rolle (nie herunterstufen), ihren
 *    Username und eine bereits hinterlegte E-Mail
 *  - fehlende E-Mails und Nachnamen werden nachgetragen
 *    («Juan» → «Juan Hausherr»)
 *  - neue Accounts bekommen einen Aktivierungscode, der genau einmal
 *    ausgegeben wird — wie bei `npm run users:init`
 *  - die Posten-Crew wird ergänzt, nie gelöscht: von Hand gesetzte
 *    Zuteilungen, die nicht im Plan stehen, werden nur gemeldet
 *
 * Ohne `--apply` wird nichts geschrieben, sondern nur gezeigt, was passieren
 * würde. Mehrfaches Ausführen ist unschädlich.
 *
 * Ausführen:  npm run helfer:import
 *             npm run helfer:import -- --apply
 * (auf dem Server: docker compose run --rm app npm run helfer:import -- --apply)
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { helfer } from "../prisma/helfer-data";
import { generateActivationCode } from "../src/lib/activation-code";
import { planeAbgleich, type BestandsPerson } from "../src/lib/helfer-abgleich";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const schreiben = process.argv.includes("--apply");

function titel(text: string) {
  console.log(`\n${text}\n${"─".repeat(text.length)}`);
}

async function main() {
  console.log(
    schreiben
      ? "🚀 Helfer-Import — Änderungen werden geschrieben\n"
      : "👀 Helfer-Import — Vorschau, es wird nichts geschrieben (--apply zum Ausführen)\n",
  );

  const bestand: BestandsPerson[] = await prisma.person.findMany({
    select: { id: true, name: true, username: true, email: true, rolle: true },
  });
  const plan = planeAbgleich(helfer, bestand);

  console.log(
    `${helfer.length} Personen in der Liste, ${bestand.length} Accounts in der Datenbank.`,
  );
  console.log(
    `→ ${plan.anlegen.length} neu, ${plan.aktualisieren.length} zu ergänzen, ` +
      `${plan.unveraendert.length} unverändert, ${plan.konflikte.length} Konflikte.`,
  );

  // ── Accounts anlegen und ergänzen ──

  const personId = new Map<string, string>();
  for (const t of [...plan.aktualisieren, ...plan.unveraendert]) {
    personId.set(t.soll.username, t.person.id);
  }

  if (plan.anlegen.length > 0) {
    titel("Neue Accounts");
    for (const eintrag of plan.anlegen) {
      if (!schreiben) {
        console.log(`  + ${eintrag.name} (${eintrag.username}, ${eintrag.rolle})`);
        continue;
      }
      const code = generateActivationCode();
      const person = await prisma.person.create({
        data: {
          name: eintrag.name,
          username: eintrag.username,
          email: eintrag.email,
          rolle: eintrag.rolle,
          aktivierungsCode: await bcrypt.hash(code, 12),
          mussPasswortAendern: true,
        },
        select: { id: true },
      });
      personId.set(eintrag.username, person.id);
      console.log(`  + ${eintrag.name} (${eintrag.username}, ${eintrag.rolle}) — Code: ${code}`);
    }
  }

  if (plan.aktualisieren.length > 0) {
    titel("Ergänzte Accounts");
    for (const { person, soll, aenderungen } of plan.aktualisieren) {
      const beschreibung = Object.entries(aenderungen)
        .map(([feld, wert]) => `${feld}: ${wert}`)
        .join(", ");
      if (schreiben) {
        await prisma.person.update({ where: { id: person.id }, data: aenderungen });
      }
      console.log(`  ~ ${soll.name} (${person.username ?? "ohne Username"}) — ${beschreibung}`);
    }
  }

  // ── Posten-Crew ──

  const games = await prisma.game.findMany({ select: { id: true, slug: true, name: true } });
  const gameNachSlug = new Map(games.map((g) => [g.slug, g]));
  const besetzt = new Map<string, string[]>();

  titel("Posten-Crew");
  for (const eintrag of helfer) {
    if (!eintrag.postenSlug) continue;
    const game = gameNachSlug.get(eintrag.postenSlug);
    if (!game) {
      console.log(`  ⚠️  ${eintrag.name}: Posten "${eintrag.postenSlug}" existiert nicht`);
      continue;
    }
    // Der Posten gilt als besetzt, sobald er im Plan steht — sonst meldete die
    // Vorschau jeden Posten als leer, dessen Kampfrichter erst angelegt wird.
    besetzt.set(game.name, [...(besetzt.get(game.name) ?? []), eintrag.name]);

    const id = personId.get(eintrag.username);
    if (!id) {
      console.log(`  · ${game.name} ← ${eintrag.name} (Account wird erst mit --apply angelegt)`);
      continue;
    }
    if (schreiben) {
      await prisma.gameCrew.upsert({
        where: { gameId_personId: { gameId: game.id, personId: id } },
        create: { gameId: game.id, personId: id, rolle: eintrag.rolle },
        update: { rolle: eintrag.rolle },
      });
    }
    console.log(`  ✓ ${game.name} ← ${eintrag.name}`);
  }

  // ── Was ein Mensch anschauen muss ──

  const ohnePosten = games.filter((g) => !besetzt.has(g.name));
  if (ohnePosten.length > 0) {
    titel("Posten ohne Kampfrichter");
    for (const g of ohnePosten) console.log(`  ⚠️  ${g.name} [${g.slug}]`);
  }

  const ausgemustert = helfer.filter((e) => e.postenAusgemustert);
  if (ausgemustert.length > 0) {
    titel("Kampfrichter, deren Posten es nicht mehr gibt");
    for (const e of ausgemustert) {
      console.log(`  ⚠️  ${e.name} — war eingeteilt für "${e.postenAusgemustert}"`);
    }
  }

  const ohneEinsatz = helfer.filter((e) => e.einsatz.length === 0);
  if (ohneEinsatz.length > 0) {
    titel("Auf der Mitgliederliste, im Einsatzplan ohne Aufgabe");
    for (const e of ohneEinsatz) console.log(`  · ${e.name} (${e.email ?? "keine E-Mail"})`);
  }

  const ohneMail = helfer.filter((e) => !e.email);
  if (ohneMail.length > 0) {
    titel("Ohne E-Mail-Adresse");
    for (const e of ohneMail) console.log(`  · ${e.name} — ${e.einsatz.join(", ") || "kein Einsatz"}`);
  }

  if (plan.konflikte.length > 0) {
    titel("Konflikte (nicht angefasst)");
    for (const k of plan.konflikte) console.log(`  ⚠️  ${k.soll.name}: ${k.grund}`);
  }

  if (plan.unbekannt.length > 0) {
    titel("Accounts ohne Eintrag in den Listen");
    for (const p of plan.unbekannt) {
      console.log(`  · ${p.name} (${p.username ?? "ohne Username"}, ${p.rolle}) — bleibt unverändert`);
    }
  }

  console.log(
    schreiben
      ? "\n✅ Fertig. Die Aktivierungscodes oben werden nicht erneut angezeigt."
      : "\n👀 Vorschau beendet — mit `--apply` ausführen.",
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
