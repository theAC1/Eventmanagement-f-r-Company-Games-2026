/**
 * Material-Seed für alle 11 Games
 * Basiert auf CG26_Internes_Konzept.md
 *
 * Ausführen: npx tsx prisma/seed-materials.ts
 */
import { PrismaClient, MaterialKategorie, MaterialStatus } from "@prisma/client";

const prisma = new PrismaClient();

type MatItem = {
  name: string;
  kategorie: MaterialKategorie;
  menge: string | null;
  beschreibung: string | null;
  sponsor: string | null;
  kostenGeschaetzt: number | null;
};

const materialPerGame: Record<string, MatItem[]> = {
  "xxl-basketball": [
    { name: "XXL Basketball-Korb (aufblasbar)", kategorie: "MIETE", menge: "1", beschreibung: "Selbstverschliessend wie SUP, kein Dauerstrom nötig", sponsor: "Arena der Wunder", kostenGeschaetzt: null },
    { name: "Bälle", kategorie: "KAUF", menge: "2-3 Stk.", beschreibung: "Für flüssiges Spiel", sponsor: null, kostenGeschaetzt: 30 },
    { name: "Markierungen Wurflinie", kategorie: "KAUF", menge: "Set", beschreibung: "Pylonen oder Klebeband für Distanzzonen", sponsor: null, kostenGeschaetzt: 15 },
  ],
  "stack-attack": [
    { name: "Erusbacher Harassen", kategorie: "SPONSOR", menge: "100 + 50 Reserve", beschreibung: "Bierkisten für den Stack", sponsor: "Erusbacher Bier", kostenGeschaetzt: 0 },
    { name: "Stoppuhr", kategorie: "KAUF", menge: "1", beschreibung: null, sponsor: null, kostenGeschaetzt: 10 },
    { name: "Absperrband", kategorie: "KAUF", menge: "1 Rolle", beschreibung: "Für Spielbereich-Abgrenzung", sponsor: null, kostenGeschaetzt: 8 },
    { name: "Transportmittel Harassen", kategorie: "INFRASTRUKTUR", menge: "1", beschreibung: "Transport zum/vom Eventgelände", sponsor: null, kostenGeschaetzt: null },
  ],
  "human-soccer": [
    { name: "Human Soccer Arena (aufblasbar)", kategorie: "MIETE", menge: "1", beschreibung: "Neuer Anbieter, letztjährige Arena war defekt", sponsor: "Arena der Wunder", kostenGeschaetzt: null },
    { name: "Ball (weich)", kategorie: "KAUF", menge: "2", beschreibung: "Weicher Ball für Tischkicker-Modus", sponsor: null, kostenGeschaetzt: 15 },
    { name: "Stangen/Bänder Spielerreihen", kategorie: "MIETE", menge: "Set", beschreibung: "Je nach Modell bei Arena inkl.", sponsor: null, kostenGeschaetzt: 0 },
  ],
  "kisten-stappeln": [
    { name: "Kartonschachteln (Zügelkarton)", kategorie: "SPONSOR", menge: "Grosse Menge", beschreibung: "Einheitliche Grösse, mit Firmenlogos", sponsor: "Firma in Wohlen AG (TBD)", kostenGeschaetzt: 0 },
    { name: "Markierungsmaterial", kategorie: "KAUF", menge: "Set", beschreibung: null, sponsor: null, kostenGeschaetzt: 10 },
    { name: "Massband / Stoppuhr", kategorie: "KAUF", menge: "je 1", beschreibung: null, sponsor: null, kostenGeschaetzt: 15 },
  ],
  "lava-becken": [
    { name: "Bretter (diverse Längen)", kategorie: "KAUF", menge: "5-8 Stk.", beschreibung: "Keines überbrückt die 15m allein", sponsor: null, kostenGeschaetzt: 50 },
    { name: "Harassen (Lava-Material)", kategorie: "SPONSOR", menge: "10-15", beschreibung: "Nützlicher Gegenstand im Mix", sponsor: "Erusbacher Bier", kostenGeschaetzt: 0 },
    { name: "Seil", kategorie: "KAUF", menge: "20m", beschreibung: null, sponsor: null, kostenGeschaetzt: 15 },
    { name: "Störobjekte", kategorie: "EIGENBAU", menge: "Diverse", beschreibung: "Schwer, sperrig, unnütz – müssen trotzdem rüber", sponsor: null, kostenGeschaetzt: 20 },
    { name: "Markierungsmaterial", kategorie: "KAUF", menge: "Set", beschreibung: "Falls nicht im Unihockey-Feld", sponsor: null, kostenGeschaetzt: 10 },
  ],
  "cornhole": [
    { name: "Cornhole-Bretter (Miete)", kategorie: "MIETE", menge: "4 Stk.", beschreibung: "Mit Firmenlogos signiert (Marketing)", sponsor: null, kostenGeschaetzt: null },
    { name: "Cornhole-Bretter (Kauf)", kategorie: "KAUF", menge: "2 Stk.", beschreibung: "Mit Firmenlogos signiert", sponsor: null, kostenGeschaetzt: null },
    { name: "Wurfsäcke", kategorie: "KAUF", menge: "24 Stk. (4 pro Brett, 2 Farben)", beschreibung: null, sponsor: null, kostenGeschaetzt: 40 },
    { name: "Markierung Abwurfzone", kategorie: "KAUF", menge: "Set", beschreibung: null, sponsor: null, kostenGeschaetzt: 10 },
  ],
  "eierfall": [
    { name: "Rohe Eier", kategorie: "VERBRAUCH", menge: "~60 Stk. (3 pro Team)", beschreibung: "Grosszügig kalkuliert", sponsor: null, kostenGeschaetzt: 15 },
    { name: "Baumaterial-Sets", kategorie: "KAUF", menge: "20 Sets", beschreibung: "Identisch pro Team vorbereitet", sponsor: null, kostenGeschaetzt: 80 },
    { name: "Fallstruktur 2m/3m", kategorie: "EIGENBAU", menge: "1", beschreibung: "Leiter/Podest", sponsor: null, kostenGeschaetzt: 30 },
    { name: "Fallstruktur 5m", kategorie: "EIGENBAU", menge: "1", beschreibung: "Gerüst bauen oder Ort mit 5m Höhe finden – muss organisiert werden", sponsor: null, kostenGeschaetzt: null },
    { name: "Bodenfolie", kategorie: "KAUF", menge: "5m²", beschreibung: null, sponsor: null, kostenGeschaetzt: 10 },
    { name: "Waage", kategorie: "KAUF", menge: "1", beschreibung: "Wenn Gewichtswertung", sponsor: null, kostenGeschaetzt: 20 },
    { name: "Reinigungsmaterial", kategorie: "VERBRAUCH", menge: "Set", beschreibung: "Küchenpapier etc.", sponsor: null, kostenGeschaetzt: 10 },
  ],
  "radio-runner": [
    { name: "Sprinter-Van", kategorie: "INFRASTRUKTUR", menge: "1", beschreibung: "Laderaum abgedunkelt – WER ORGANISIERT?", sponsor: null, kostenGeschaetzt: null },
    { name: "Kapla-Steine", kategorie: "KAUF", menge: "Grosser Vorrat", beschreibung: null, sponsor: null, kostenGeschaetzt: 60 },
    { name: "Bild-Vorlagen (3 Stufen)", kategorie: "EIGENBAU", menge: "3 Stk.", beschreibung: "Einfach/Mittel/Schwer, laminiert", sponsor: null, kostenGeschaetzt: 5 },
    { name: "Walkie-Talkies", kategorie: "KAUF", menge: "2 Stk.", beschreibung: null, sponsor: null, kostenGeschaetzt: 40 },
    { name: "Leselampe", kategorie: "KAUF", menge: "1", beschreibung: "Für den Van", sponsor: null, kostenGeschaetzt: 10 },
    { name: "Bautisch", kategorie: "INFRASTRUKTUR", menge: "1", beschreibung: "Vor dem Van", sponsor: null, kostenGeschaetzt: 0 },
    { name: "Absperrband Material-Zone", kategorie: "KAUF", menge: "1 Rolle", beschreibung: "Material-Zone und Laufstrecke", sponsor: null, kostenGeschaetzt: 8 },
  ],
  "schwebender-architekt": [
    { name: "Seil-Platte-Konstruktion", kategorie: "EIGENBAU", menge: "1", beschreibung: "Juan baut das (Schreiner). Prototyp zusammen mit Roger.", sponsor: null, kostenGeschaetzt: null },
    { name: "Kapla-Steine / Bauklötze", kategorie: "KAUF", menge: "30-50 Stk.", beschreibung: null, sponsor: null, kostenGeschaetzt: 30 },
    { name: "Massstab / Messband", kategorie: "KAUF", menge: "1", beschreibung: null, sponsor: null, kostenGeschaetzt: 10 },
  ],
  "geschicklichkeits-parcour": [
    { name: "Station A: Absperrgitter + Band", kategorie: "KAUF", menge: "Set", beschreibung: "Heisser Draht – Gegenstand durch Labyrinth", sponsor: null, kostenGeschaetzt: 30 },
    { name: "Station B: Odi-Challenge Material", kategorie: "KAUF", menge: "TBD", beschreibung: "Details aus 2025 übernehmen", sponsor: null, kostenGeschaetzt: null },
    { name: "Station C: Bobby-Karts + Pylonen", kategorie: "MIETE", menge: "2-3 Karts", beschreibung: null, sponsor: null, kostenGeschaetzt: null },
    { name: "Station D: Kugelbrett + Kugeln", kategorie: "EIGENBAU", menge: "1 Brett", beschreibung: "Konstruktion und Schwierigkeitsgrad TBD", sponsor: null, kostenGeschaetzt: null },
  ],
  "quadrant-chaos": [
    { name: "XXL-Aufblasbälle", kategorie: "KAUF", menge: "4-6 Stk.", beschreibung: null, sponsor: null, kostenGeschaetzt: 40 },
    { name: "Markierungsmaterial", kategorie: "KAUF", menge: "Set", beschreibung: "Hütchen, Bänder für Mittellinie und Feldbegrenzung", sponsor: null, kostenGeschaetzt: 20 },
    { name: "Stoppuhr", kategorie: "KAUF", menge: "1", beschreibung: null, sponsor: null, kostenGeschaetzt: 10 },
    { name: "Ersatzbälle", kategorie: "KAUF", menge: "2-3", beschreibung: null, sponsor: null, kostenGeschaetzt: 20 },
  ],
};

async function seedMaterials() {
  console.log("Lade Games aus DB...");
  const games = await prisma.game.findMany({ select: { id: true, slug: true, name: true } });
  const gameBySlug = new Map(games.map((g) => [g.slug, g]));

  let created = 0;
  let skipped = 0;

  for (const [slug, items] of Object.entries(materialPerGame)) {
    const game = gameBySlug.get(slug);
    if (!game) {
      console.log(`  SKIP: Game "${slug}" nicht in DB gefunden`);
      skipped += items.length;
      continue;
    }

    // Check ob schon Material für dieses Game existiert
    const existing = await prisma.materialItem.count({ where: { gameId: game.id } });
    if (existing > 0) {
      console.log(`  SKIP: ${game.name} hat bereits ${existing} Material-Items`);
      skipped += items.length;
      continue;
    }

    for (const item of items) {
      await prisma.materialItem.create({
        data: {
          gameId: game.id,
          name: item.name,
          kategorie: item.kategorie,
          menge: item.menge,
          beschreibung: item.beschreibung,
          status: MaterialStatus.OFFEN,
          sponsor: item.sponsor,
          kostenGeschaetzt: item.kostenGeschaetzt,
        },
      });
      created++;
    }
    console.log(`  ✓ ${game.name}: ${items.length} Items angelegt`);
  }

  console.log(`\nFertig: ${created} erstellt, ${skipped} übersprungen`);
}

seedMaterials()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
