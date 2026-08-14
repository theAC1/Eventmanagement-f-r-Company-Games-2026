// Nur-lesende Bereitschaftsprüfung vor einem Probelauf oder dem Eventtag.
//
// Beantwortet zwei Fragen:
//   1. Ist `npm run users:init` auf dieser Datenbank gelaufen?
//   2. Warum sieht ein Schiedsrichter in "Mein Tagesplan" nichts?
//
// Schreibt nichts und gibt keine Aktivierungscodes aus (die stehen ohnehin nur
// als bcrypt-Hash in der Datenbank).
//
// Ausführen:
//   docker compose run --rm app npm run users:check
import { prisma } from "../src/lib/prisma";
import { getCurrentZeitplanConfig } from "../src/lib/zeitplan-config";

const ERWARTET: { username: string; rolle: "OWNER" | "ADMIN" }[] = [
  { username: "juan", rolle: "OWNER" },
  { username: "luca", rolle: "ADMIN" },
  { username: "gian", rolle: "ADMIN" },
  { username: "levin", rolle: "ADMIN" },
  { username: "roger", rolle: "ADMIN" },
  { username: "rahel", rolle: "ADMIN" },
  { username: "lea", rolle: "ADMIN" },
  { username: "sven", rolle: "ADMIN" },
];

/** Anmelde-Zustand in Klartext — ohne je ein Geheimnis auszugeben. */
function zustand(p: {
  passwordHash: string | null;
  aktivierungsCode: string | null;
  mussPasswortAendern: boolean;
}): string {
  if (p.passwordHash && !p.mussPasswortAendern) return "aktiviert, Passwort gesetzt";
  if (p.passwordHash && p.mussPasswortAendern) return "Passwort muss noch geändert werden";
  if (p.aktivierungsCode) return "wartet auf Erstanmeldung mit Aktivierungscode";
  return "WEDER Passwort NOCH Aktivierungscode — Login unmöglich, Code neu erzeugen";
}

async function accounts() {
  const gefunden = await prisma.person.findMany({
    where: { username: { in: ERWARTET.map((u) => u.username) } },
    select: {
      username: true,
      rolle: true,
      istAktiv: true,
      passwordHash: true,
      aktivierungsCode: true,
      mussPasswortAendern: true,
    },
  });
  const proName = new Map(gefunden.map((p) => [p.username, p]));

  let fehlend = 0;
  let falscheRolle = 0;

  console.log("── 1. Persönliche Accounts (users:init) ──────────────────");
  for (const erwartet of ERWARTET) {
    const p = proName.get(erwartet.username);
    if (!p) {
      fehlend++;
      console.log(`  FEHLT   ${erwartet.username.padEnd(6)} — erwartet als ${erwartet.rolle}`);
      continue;
    }
    const rolleOk = p.rolle === erwartet.rolle;
    if (!rolleOk) falscheRolle++;
    const hinweise = [
      rolleOk ? p.rolle : `ROLLE ${p.rolle}, erwartet ${erwartet.rolle}`,
      zustand(p),
      p.istAktiv ? null : "DEAKTIVIERT",
    ].filter(Boolean);
    console.log(`  ${rolleOk ? "OK     " : "PRÜFEN "}${erwartet.username.padEnd(6)} — ${hinweise.join(" · ")}`);
  }

  if (fehlend === ERWARTET.length) {
    console.log("  → users:init ist auf dieser Datenbank NOCH NIE gelaufen.");
  } else if (fehlend > 0) {
    console.log(`  → users:init ist nur teilweise gelaufen — ${fehlend} Account(s) fehlen.`);
  } else if (falscheRolle > 0) {
    console.log("  → Alle Accounts da, aber Rollen weichen ab (users:init hebt sie an).");
  } else {
    console.log("  → users:init ist gelaufen, alle Accounts vorhanden.");
  }
}

async function einsatzbereitschaft() {
  console.log("");
  console.log("── 2. Sieht ein Schiedsrichter seine Einsätze? ───────────");

  const gameday = await prisma.gamedayConfig.findFirst({
    where: { modus: { not: "INAKTIV" } },
    orderBy: { createdAt: "desc" },
    select: { modus: true },
  });
  console.log(`  Gameday: ${gameday?.modus ?? "INAKTIV"}${gameday ? "" : "  ← ohne aktiven Gameday zeigt die Schiedsrichter-Seite nur einen Hinweis"}`);

  const config = await getCurrentZeitplanConfig();
  if (!config) {
    console.log("  KEIN ZEITPLAN vorhanden → niemand sieht Einsätze. Zuerst im Leitstand einen Zeitplan erzeugen.");
    return;
  }
  console.log(`  Aktiver Zeitplan: "${config.name}"${config.istAktiv ? "" : "  (kein Plan ist als aktiv markiert — es gilt der zuletzt erstellte)"}`);

  const [slotsGesamt, slotsMitGame, slotPersonen, crew] = await Promise.all([
    prisma.zeitplanSlot.count({ where: { configId: config.id } }),
    prisma.zeitplanSlot.count({ where: { configId: config.id, gameId: { not: null } } }),
    prisma.zeitplanSlotPerson.count({ where: { slot: { configId: config.id } } }),
    prisma.gameCrew.findMany({
      select: { gameId: true, person: { select: { name: true, rolle: true } } },
    }),
  ]);

  console.log(`  Slots: ${slotsGesamt} gesamt, davon ${slotsMitGame} mit Posten belegt`);
  console.log(`  Posten-Crew-Zuteilungen (GameCrew): ${crew.length}`);
  console.log(`  Slot-Feinzuteilungen (ZeitplanSlotPerson): ${slotPersonen}`);

  if (crew.length === 0 && slotPersonen === 0) {
    console.log("  → NIEMAND ist eingeteilt. Deshalb ist jeder Tagesplan leer.");
    console.log("    Einteilen im Leitstand: Games-Tab → Posten → Crew zuweisen.");
    return;
  }

  // Pro Person hochrechnen, wie viele Slots ihr Tagesplan zeigen wird.
  const slots = await prisma.zeitplanSlot.findMany({
    where: { configId: config.id, gameId: { not: null } },
    select: {
      gameId: true,
      personen: { select: { personId: true } },
      schiedsrichterId: true,
    },
  });
  const crewProGame = new Map<string, string[]>();
  for (const c of crew) {
    const liste = crewProGame.get(c.gameId) ?? [];
    liste.push(c.person.name);
    crewProGame.set(c.gameId, liste);
  }

  const personen = await prisma.person.findMany({
    where: { rolle: { in: ["SCHIEDSRICHTER", "ORGA", "ADMIN", "OWNER"] } },
    select: { id: true, name: true, rolle: true },
    orderBy: { name: "asc" },
  });

  const zaehler = new Map<string, number>();
  for (const slot of slots) {
    const explizit = slot.personen.map((p) => p.personId);
    const sichtbarFuer = explizit.length > 0 ? explizit : [];
    if (explizit.length === 0) {
      // Ohne Feinzuteilung gilt die Posten-Crew.
      const crewIds = crew.filter((c) => c.gameId === slot.gameId);
      for (const c of crewIds) sichtbarFuer.push(`crew:${c.person.name}`);
    }
    if (slot.schiedsrichterId) sichtbarFuer.push(slot.schiedsrichterId);
    for (const key of sichtbarFuer) zaehler.set(key, (zaehler.get(key) ?? 0) + 1);
  }

  console.log("");
  console.log("  Voraussichtliche Einsätze pro Person:");
  let mitEinsatz = 0;
  for (const p of personen) {
    const ueberId = zaehler.get(p.id) ?? 0;
    const ueberCrew = zaehler.get(`crew:${p.name}`) ?? 0;
    const total = ueberId + ueberCrew;
    if (total > 0) mitEinsatz++;
    console.log(`    ${total > 0 ? "  " : "!!"} ${p.name.padEnd(18)} ${String(total).padStart(3)} Einsätze  (${p.rolle})`);
  }
  if (mitEinsatz === 0) {
    console.log("  → Niemand hat Einsätze. Tagespläne bleiben leer.");
  } else {
    console.log(`  → ${mitEinsatz} Person(en) sehen Einsätze in ihrem Tagesplan.`);
  }
}

async function main() {
  await accounts();
  await einsatzbereitschaft();
  console.log("");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
