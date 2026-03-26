import { PrismaClient, GameTyp, GameModus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const games = [
  {
    name: "XXL Basketball",
    slug: "xxl-basketball",
    typ: GameTyp.RETURNEE,
    modus: GameModus.DUELL,
    teamsProSlot: 2,
    kurzbeschreibung:
      "Überdimensioniertes Basketball mit aufblasbarem Korb. Zwei Teams treten direkt gegeneinander an.",
    wertungstyp: "punkte",
    wertungslogik: {
      typ: "punkte_duell",
      eingabefelder: [
        { name: "punkte_team_a", typ: "number", label: "Punkte Team A" },
        { name: "punkte_team_b", typ: "number", label: "Punkte Team B" },
      ],
      richtung: "hoechster_gewinnt",
    },
    flaecheLaengeM: 15,
    flaecheBreiteM: 10,
    helferAnzahl: 2,
    stromNoetig: false,
    regeln: `## Regeln
- Jeder Spieler wirft abwechselnd von markierter Wurflinie
- Ball muss im Korb landen (Abpraller zählen nur wenn sie drin landen)
- Distanzzonen: 1P / 2P / 3P [OFFEN]

## Wertung
Höhere Punktzahl nach 10 min gewinnt.`,
  },
  {
    name: "Stack Attack",
    slug: "stack-attack",
    typ: GameTyp.RETURNEE,
    modus: GameModus.SOLO,
    teamsProSlot: 1,
    kurzbeschreibung:
      "Das Team presst Erusbacher-Bierkisten zusammen zu einer möglichst langen Reihe und hebt diese vom Boden ab. Rekord 2025: 64 Harassen mit 6 Personen.",
    playtimeMin: 8, // 10 min minus 2 min Aufräumen durch Team
    wertungstyp: "laenge",
    wertungslogik: {
      typ: "max_value",
      einheit: "Harassen",
      messung: "anzahl_harassen",
      richtung: "hoechster_gewinnt",
      tiebreaker: "schnellere_zeit",
      eingabefelder: [
        { name: "anzahl_harassen", typ: "number", label: "Anzahl Harassen im Stack" },
        { name: "zeit_sekunden", typ: "number", label: "Zeit bis Ready (Sek.)" },
      ],
    },
    flaecheLaengeM: 15,
    flaecheBreiteM: 10,
    helferAnzahl: 2,
    stromNoetig: false,
    regeln: `## Regeln
- 100 Harassen verfügbar (+ 50 Reserve)
- Team presst Harassen zusammen und hebt den Stack vom Boden ab
- Mehrere Versuche innerhalb der Spielzeit erlaubt
- Aufräumen macht das Team selbst (in Spielzeit eingerechnet)
- Beste Harassen-Anzahl wird notiert

## Wertung
Längster erfolgreich gehobener Stack (Harassen-Anzahl). Tiebreaker: schnellere Zeit.`,
  },
  {
    name: "Human Soccer",
    slug: "human-soccer",
    typ: GameTyp.RETURNEE,
    modus: GameModus.DUELL,
    teamsProSlot: 2,
    kurzbeschreibung:
      "Tischkicker in Lebensgrösse. Spieler auf festen Reihen, nur seitliche Bewegung. Aufblasbare Arena via Arena der Wunder.",
    wertungstyp: "tore",
    wertungslogik: {
      typ: "punkte_duell",
      eingabefelder: [
        { name: "tore_team_a", typ: "number", label: "Tore Team A" },
        { name: "tore_team_b", typ: "number", label: "Tore Team B" },
      ],
      richtung: "hoechster_gewinnt",
    },
    flaecheLaengeM: 20,
    flaecheBreiteM: 12,
    helferAnzahl: 2,
    stromNoetig: true,
    regeln: `## Regeln
- Spieler auf fixen Reihen (Stangen/Bänder), nur seitliche Bewegung
- Ball: weich (Schaumstoff)
- Kein Hands, kein Halten, kein Treten über Hüfthöhe
- Spielerzahl abhängig vom gemieteten Modell

## Wertung
Anzahl Tore nach 10 min. Bei Unentschieden: [OFFEN]`,
  },
  {
    name: "Kisten Stappeln",
    slug: "kisten-stappeln",
    typ: GameTyp.NEU,
    modus: GameModus.SOLO,
    teamsProSlot: 1,
    kurzbeschreibung:
      "Team baut mit Kartonschachteln (Zügelkarton-Grösse) Türme. Option B: Mehrere Türme, Höhen-Multiplikator.",
    wertungstyp: "punkte",
    wertungslogik: {
      typ: "formel",
      formel: "sum(turm_hoehe * turm_hoehe)",
      einheit: "Punkte",
      richtung: "hoechster_gewinnt",
      eingabefelder: [
        { name: "turm_1_hoehe", typ: "number", label: "Turm 1 Höhe (Kisten)" },
        { name: "turm_2_hoehe", typ: "number", label: "Turm 2 Höhe (Kisten)" },
        { name: "turm_3_hoehe", typ: "number", label: "Turm 3 Höhe (Kisten)" },
      ],
    },
    flaecheLaengeM: 10,
    flaecheBreiteM: 10,
    helferAnzahl: 2,
    stromNoetig: false,
    regeln: `## Regeln
- Kartonschachteln (einheitlich, Zügelkarton-Grösse)
- Modus: [TBD – Option B: Mehrere Türme, Höhe² als Multiplikator]
- Sponsor-Karton mit Firmenlogos

## Wertung
Summe(Turmhöhe²) – höhere Türme lohnen sich überproportional.

## ⚠️ Outdoor-Risiko: Wind!`,
  },
  {
    name: "Lava Becken",
    slug: "lava-becken",
    typ: GameTyp.NEU,
    modus: GameModus.SOLO,
    teamsProSlot: 1,
    kurzbeschreibung:
      "Team überquert ein \"Lava-Becken\" (Unihockey-Feld, ~15m). Alle Personen + Material müssen rüber. Gegenstand fällt in Lava = weg.",
    wertungstyp: "zeit",
    wertungslogik: {
      typ: "zeit",
      einheit: "Sekunden",
      richtung: "niedrigster_gewinnt",
      nicht_geschafft: "letzter_rang",
      eingabefelder: [
        { name: "zeit_sekunden", typ: "number", label: "Zeit (Sek.)" },
        { name: "geschafft", typ: "boolean", label: "Geschafft?" },
        { name: "verlorene_items", typ: "number", label: "Verlorene Gegenstände" },
      ],
    },
    flaecheLaengeM: 40,
    flaecheBreiteM: 20,
    helferAnzahl: 2,
    stromNoetig: false,
    regeln: `## Regeln
- Standort: Unihockey-Feld (Banden, ~15m Länge)
- Material: Mix aus nützlichen + mühsamen Gegenständen
- Bodenberührung = Strafe (Person zurück zum Start)
- Gegenstand fällt in "Lava" = WEG, kein Zurückholen
- Nichts darf geworfen werden
- Nicht geschafft in 10 min = keine Punkte (letzter Rang)

## Wertung
Zeit bis alle Personen + Material auf der anderen Seite.`,
  },
  {
    name: "Cornhole",
    slug: "cornhole",
    typ: GameTyp.NEU,
    modus: GameModus.DUELL,
    teamsProSlot: 2,
    kurzbeschreibung:
      "Wurfsäcke auf schräge Bretter. Loch = 3P, Brett = 1P. 6 Bretter (4 Miete + 2 Kauf), alle mit Firmenlogos.",
    wertungstyp: "punkte",
    wertungslogik: {
      typ: "punkte_duell",
      eingabefelder: [
        { name: "punkte_team_a", typ: "number", label: "Punkte Team A" },
        { name: "punkte_team_b", typ: "number", label: "Punkte Team B" },
      ],
      richtung: "hoechster_gewinnt",
    },
    flaecheLaengeM: 10,
    flaecheBreiteM: 30,
    helferAnzahl: 1,
    stromNoetig: false,
    regeln: `## Regeln
- 6 Bretter = 3 Paare, 2 Teams verteilen sich
- Klassisches Cornhole: abwechselnd werfen
- Auf Zeit (10 min), nicht auf Punkte
- 3P = Sack im Loch, 1P = Sack auf Brett, 0P = daneben

## Wertung
Summe über alle 3 Paare. Höhere Punktzahl gewinnt.`,
  },
  {
    name: "Der grosse Eierfall",
    slug: "eierfall",
    typ: GameTyp.NEU,
    modus: GameModus.SOLO,
    teamsProSlot: 1,
    kurzbeschreibung:
      "Teams bauen Schutzkonstruktion für rohes Ei. Falltest aus 2m/3m/5m. Show-Variante: Auflösung vor Rangverkündung.",
    wertungstyp: "risiko",
    wertungslogik: {
      typ: "risiko_wahl",
      optionen: [
        { name: "2m", punkte_erfolg: 5, punkte_fail: 0 },
        { name: "3m", punkte_erfolg: 10, punkte_fail: 0 },
        { name: "5m", punkte_erfolg: 20, punkte_fail: 0 },
      ],
      tiebreaker: "leichtere_konstruktion",
      show_modus: true,
      eingabefelder: [
        { name: "gewaehlte_hoehe", typ: "select", label: "Gewählte Fallhöhe", options: ["2m", "3m", "5m"] },
        { name: "gewicht_gramm", typ: "number", label: "Gewicht Konstruktion (g)" },
        { name: "ei_ueberlebt", typ: "boolean", label: "Ei überlebt?" },
      ],
    },
    flaecheLaengeM: 5,
    flaecheBreiteM: 5,
    helferAnzahl: 2,
    stromNoetig: false,
    regeln: `## Regeln
- 8 min Bauphase, 1 Versuch
- Baumaterial wird gestellt (Papier, Karton, Strohhalme, Gummibänder, Schnur, Klebeband, etc.)
- Team wählt Fallhöhe: 2m, 3m oder 5m
- Show-Variante: Falltest vor Rangverkündung (alle Teams gleichzeitig)

## Wertung
Höhere Fallhöhe = mehr Punkte. Ei kaputt = 0. Tiebreaker: leichtere Konstruktion.`,
  },
  {
    name: "Radio Runner",
    slug: "radio-runner",
    typ: GameTyp.NEU,
    modus: GameModus.SOLO,
    teamsProSlot: 1,
    kurzbeschreibung:
      "Boda-Borg-Stil: 3 Schwierigkeitsstufen. Architekt im Van beschreibt Kapla-Modell per Walkie-Talkie, Runner bauen nach.",
    wertungstyp: "multi_level",
    wertungslogik: {
      typ: "multi_level",
      levels: [
        { name: "einfach", grundpunkte: 10 },
        { name: "mittel", grundpunkte: 25 },
        { name: "schwer", grundpunkte: 50 },
      ],
      zeit_bonus: "grundpunkte - (zeit_sekunden * 0.1)",
      richtung: "hoechster_gewinnt",
      eingabefelder: [
        { name: "level", typ: "select", label: "Schwierigkeitsstufe", options: ["einfach", "mittel", "schwer"] },
        { name: "zeit_sekunden", typ: "number", label: "Zeit (Sek.)" },
        { name: "korrekt", typ: "boolean", label: "Korrekt gebaut?" },
        { name: "steine_korrekt", typ: "number", label: "Korrekte Steine (falls nicht fertig)" },
      ],
    },
    flaecheLaengeM: 30,
    flaecheBreiteM: 10,
    helferAnzahl: 2,
    stromNoetig: false,
    regeln: `## Regeln
- Architekt im Sprinter-Van bekommt BILD des Kapla-Turms
- Kommunikation nur via Walkie-Talkie
- Runner: max. 2 Steine pro Lauf (10-20m)
- 3 Schwierigkeitsstufen: einfach / mittel / schwer
- Materialstrassen sind ERLAUBT (schlaue Strategien werden belohnt)
- "Fertig!" → Schiedsrichter vergleicht mit Bild

## Wertung
Schwierigkeit × Geschwindigkeit. Höheres Level = mehr Grundpunkte, schnellere Zeit = besserer Rang.`,
  },
  {
    name: "Der schwebende Architekt",
    slug: "schwebender-architekt",
    typ: GameTyp.NEU,
    modus: GameModus.SOLO,
    teamsProSlot: 1,
    kurzbeschreibung:
      "Team hält Holzplatte an Seilen schwebend (V2). Architekt baut Turm auf der wackligen Plattform.",
    wertungstyp: "hoehe",
    wertungslogik: {
      typ: "max_value",
      einheit: "Steine",
      messung: "turm_hoehe",
      richtung: "hoechster_gewinnt",
      eingabefelder: [
        { name: "turm_hoehe", typ: "number", label: "Turmhöhe (Anzahl Steine)" },
        { name: "stabil_10sek", typ: "boolean", label: "10 Sek. stabil?" },
      ],
    },
    flaecheLaengeM: 5,
    flaecheBreiteM: 5,
    helferAnzahl: 1,
    stromNoetig: false,
    regeln: `## Regeln
- Holzplatte an Seilen, jedes Teammitglied hält min. 1 Seil
- Platte darf Boden nicht berühren
- Architekt baut Turm auf der schwebenden Platte
- Architekt-Wechsel erlaubt
- Turm muss 10 Sekunden stabil stehen

## Wertung
Höhe des Turms (Anzahl Steine). Muss 10 Sek. stehen.

## Konstruktion
Eigenbau Juan + Roger (Prototyp vor Testtag).`,
  },
  {
    name: "Geschicklichkeits Parcour",
    slug: "geschicklichkeits-parcour",
    typ: GameTyp.NEU,
    modus: GameModus.SOLO,
    teamsProSlot: 1,
    kurzbeschreibung:
      "4 Stationen als Parcour auf Zeit. Min. 2 Durchgänge möglich, bester zählt. Stationen: Heisser Draht, Odi-Challenge, Bobby-Kart, Kugelbrett.",
    wertungstyp: "zeit",
    wertungslogik: {
      typ: "zeit",
      einheit: "Sekunden",
      richtung: "niedrigster_gewinnt",
      eingabefelder: [
        { name: "durchgang_1_zeit", typ: "number", label: "Durchgang 1 (Sek.)" },
        { name: "durchgang_2_zeit", typ: "number", label: "Durchgang 2 (Sek.)" },
        { name: "durchgang_3_zeit", typ: "number", label: "Durchgang 3 (Sek., optional)" },
      ],
    },
    flaecheLaengeM: 40,
    flaecheBreiteM: 10,
    helferAnzahl: 2,
    stromNoetig: false,
    regeln: `## Regeln
- 4 Stationen nacheinander als Parcour
- Min. 2, max. 3 Durchgänge in 10 min
- Bester Durchgang zählt
- Strafzeiten pro Station werden addiert

### Station A: Heisser Draht (Absperrgitter) [TBD]
### Station B: Odi-Challenge (Returnee 2025) [TBD]
### Station C: Bobby-Kart Rennen [TBD]
### Station D: Kugelbrett-Balance [TBD]

## Wertung
Beste Durchgangszeit (inkl. Strafzeiten).`,
  },
  {
    name: "Quadrant Chaos",
    slug: "quadrant-chaos",
    typ: GameTyp.NEU,
    modus: GameModus.DUELL,
    teamsProSlot: 2,
    kurzbeschreibung:
      "2 Teams, 2 Spielhälften. XXL-Bälle aus eigener Hälfte in gegnerische stossen. Wer mehr Bälle hat verliert.",
    wertungstyp: "runden",
    wertungslogik: {
      typ: "punkte_duell",
      eingabefelder: [
        { name: "runden_team_a", typ: "number", label: "Gewonnene Runden Team A" },
        { name: "runden_team_b", typ: "number", label: "Gewonnene Runden Team B" },
      ],
      richtung: "hoechster_gewinnt",
    },
    flaecheLaengeM: 20,
    flaecheBreiteM: 20,
    helferAnzahl: 2,
    stromNoetig: false,
    regeln: `## Regeln
- 2 Spielhälften, 2 Teams
- 4-6 XXL-Bälle starten in der Mitte
- 2-3 Kurzrunden à 3 min
- Bälle rollen, stossen, werfen erlaubt
- Spieler dürfen eigene Hälfte nicht verlassen
- Betreten gegnerische Hälfte = +1 Strafball

## Wertung
Gewonnene Runden (Best of 3). Weniger Bälle in eigener Hälfte = Runde gewonnen.`,
  },
];

async function main() {
  console.log("🌱 Seeding Company Games 2026...\n");

  // Bestehende Games löschen (für Re-Seed)
  await prisma.game.deleteMany();

  for (const game of games) {
    const created = await prisma.game.create({ data: game });
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
