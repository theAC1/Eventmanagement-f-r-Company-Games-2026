/**
 * Kanonische Game-Stammdaten der Company Games 2026.
 *
 * Quelle: company-games-spielregeln-protokoll.md (Stand 10.08.2026).
 * Wird vom Seed (prisma/seed.ts) und vom Live-DB-Update-Script
 * (scripts/update-games-protokoll.ts) gemeinsam genutzt.
 *
 * Slugs sind stabil und ändern sich bei Namenswechseln NICHT
 * (Referenzen laufen überall über slug — Import-Pipeline, Referee-URLs):
 * - radio-runner          → heisst neu "Robert Huber Radio"
 * - schwebender-architekt → heisst neu "Schwebendes Labyrinth"
 * - quadrant-chaos        → heisst neu "ChaosQuadrant"
 * - kisten-stappeln       → heisst neu "Kisten stapeln" (Slug behält den Alt-Tippfehler)
 *
 * Nicht mehr im Programm (werden vom Update-Script aus der Wertung genommen):
 * - xxl-basketball, geschicklichkeits-parcour
 */

import type { Wertungslogik } from "../src/lib/wertungslogik-types";

export type GameSeedData = {
  name: string;
  slug: string;
  typ: "RETURNEE" | "NEU";
  modus: "SOLO" | "DUELL";
  teamsProSlot: number;
  kurzbeschreibung: string;
  playtimeMin?: number;
  wertungstyp: string;
  wertungslogik: Wertungslogik;
  flaecheLaengeM: number;
  flaecheBreiteM: number;
  helferAnzahl: number;
  schiedsrichterAnzahl: number;
  stromNoetig: boolean;
  zaehltZurWertung: boolean;
  regeln: string;
};

export const games: GameSeedData[] = [
  // ─── 1. Cornhole ───
  {
    name: "Cornhole",
    slug: "cornhole",
    typ: "NEU",
    modus: "DUELL",
    teamsProSlot: 2,
    kurzbeschreibung:
      "Wurfsäcke auf schräge Bretter, 6 m Distanz, ein Brett pro Station. " +
      "Kleinbegegnungen 1 gegen 1, je 12 Säcke pro Spieler.",
    wertungstyp: "punkte",
    wertungslogik: {
      typ: "duell_kleinbegegnungen",
      richtung: "hoechster_gewinnt",
      einheit: "Punkte",
      // Score = Siegquote × G + Mittelwert. G ist im Leitstand justierbar
      // und wird Schiedsrichtern nie ausgeliefert (API filtert das Feld).
      gewichtungG: 40,
    },
    flaecheLaengeM: 10,
    flaecheBreiteM: 30,
    helferAnzahl: 1,
    schiedsrichterAnzahl: 1,
    stromNoetig: false,
    zaehltZurWertung: true,
    regeln: `## Setup
- Wurfdistanz **6 Meter** (bewusste Abweichung vom klassischen 8-m-Cornhole)
- **Ein Brett pro Station**, 6 Stationen — 6 Teams können gleichzeitig spielen

## Spielmodus
- Versus-Format: Team A gegen Team B, mindestens 5 Spieler pro Team
- Eine **Kleinbegegnung** = 1 Spieler Team A gegen 1 Spieler Team B an einem Brett
- Pro Kleinbegegnung wirft **jeder Spieler 12 Säcke** (4 Säcke × 3 Wurfrunden), Maximum 36 Punkte
- Wer beginnt, machen die beiden Spieler unter sich aus
- Nach einer Kleinbegegnung sucht sich der Spieler einen neuen Gegner aus dem anderen Team
- Gesamtspielzeit pro Slot: **10 Minuten** (nicht auf Zielpunktzahl gespielt)

## Punkte pro Wurf
- Sack **im Loch** = 3 Punkte
- Sack **berührt das Brett** = 1 Punkt — gilt auch für Seitenflächen und indirekte Würfe
  (über den Boden aufs Brett gesprungen/gerollt)
- Nur **Beine/Stützen** berührt = 0 Punkte (Beine gehören nicht zum Brett)

## Erfassung (kein Cancellation Scoring)
- Pro Kleinbegegnung werden **beide Rohpunktzahlen** eingetragen (z. B. 16 : 13)
- Gleichstand: Stechen über **+4 Würfe** pro Spieler
- Laufende Kleinbegegnung bei Zeitablauf: Schiedsrichter entscheidet nach Ermessen
  (Zeitplantreue, Fortschritt der Runde), ob fertiggespielt wird

## Wertung
Score aus Siegquote und Punkte-Mittelwert über alle Kleinbegegnungen.
Die Gewichtung legt die Orga im Leitstand fest.

## Offen
- Verfahren, wenn auch das Stechen unentschieden endet.
  **Vorläufig implementiert:** Unentschieden zählt als halber Sieg für beide.`,
  },

  // ─── 2. Robert Huber Radio ───
  {
    name: "Robert Huber Radio",
    slug: "radio-runner",
    typ: "NEU",
    modus: "SOLO",
    teamsProSlot: 1,
    kurzbeschreibung:
      "Abgedunkelter Mercedes-Van mit 3 Klotz-Türmen. 2–3 Personen beschreiben per Funk, " +
      "der Rest baut an der Nachbaustation nach. Maximal 19 Punkte.",
    wertungstyp: "punkte",
    wertungslogik: {
      typ: "tuerme_punkte",
      richtung: "hoechster_gewinnt",
      einheit: "Punkte",
      tuerme: [
        { name: "Turm 1", sektionen: 3, bonus: 0 },
        { name: "Turm 2", sektionen: 4, bonus: 2 },
        { name: "Turm 3", sektionen: 4, bonus: 3, bonusLabel: "Farbklötze" },
      ],
    },
    flaecheLaengeM: 30,
    flaecheBreiteM: 10,
    helferAnzahl: 2,
    schiedsrichterAnzahl: 1,
    stromNoetig: false,
    zaehltZurWertung: true,
    regeln: `## Setup
- Gesponserter **Mercedes-Van**, innen komplett abgedunkelt — Türme werden mit
  Taschenlampen abgesucht
- **3 Türme** aus Duplo-/Konstruktionsklötzen (einfach bis schwierig), mit Heissleim fixiert
- Nachbaustation mit Tisch ausserhalb des Vans

## Spielmodus
- **2–3 Personen im Van** (Team teilt sich selbst ein), Kommunikation nur über **Funkgeräte**
- Die übrigen Teammitglieder bauen am Tisch nach den Funkanweisungen nach
- Spielzeit: **10 Minuten**, Solo-Team gegen die Uhr

## Wertung (max. 19 Punkte)
Bewertung durch den Schiedsrichter anhand **vorbereiteter Referenzfotos** mit Sektionen:

| Turm | Sektionen | Bonusklötze | 100 %-Bonus | Maximum |
|---|---|---|---|---|
| Turm 1 | 3 | 0 | 1 | 4 |
| Turm 2 | 4 | 2 | 1 | 7 |
| Turm 3 | 4 | 3 (farbig) | 1 | 8 |

- Eine Sektion zählt nur, wenn sie **vollständig korrekt** gebaut ist (jeder Klotz stimmt)
- Ein Bonusklotz zählt bei **richtigem Ort und richtig anliegend**;
  bei Turm 3 muss zusätzlich die **Farbe** stimmen
- Der 100 %-Bonus pro Turm wird von der App **automatisch** vergeben,
  wenn alle Sektionen und Bonusklötze korrekt sind

## Offen
- Gewichtung nach Schwierigkeitsgrad (falls ja: nur minimal, ganze Punkte)`,
  },

  // ─── 3. Kisten stapeln ───
  {
    name: "Kisten stapeln",
    slug: "kisten-stappeln",
    typ: "NEU",
    modus: "SOLO",
    teamsProSlot: 1,
    kurzbeschreibung:
      "Kartonzügelkisten (ca. 50×30×40 cm) in 10 Minuten möglichst hoch stapeln. " +
      "Anzahl Kisten = Punktzahl.",
    wertungstyp: "anzahl",
    wertungslogik: {
      typ: "max_value",
      richtung: "hoechster_gewinnt",
      einheit: "Kisten",
      messung: "anzahl_kisten",
      eingabefelder: [
        { name: "anzahl_kisten", typ: "number", label: "Anzahl Kisten im Turm" },
      ],
    },
    flaecheLaengeM: 10,
    flaecheBreiteM: 10,
    helferAnzahl: 2,
    schiedsrichterAnzahl: 1,
    stromNoetig: false,
    zaehltZurWertung: true,
    regeln: `## Regeln
- Ziel: so viele Kisten wie möglich aufeinander stapeln, Bauzeit **10 Minuten**
- Ausrichtung der Kisten ist **frei** (längs oder quer)
- **Keine Höhenmessung** — gezählt wird ausschliesslich die Anzahl Kisten
- **Stützen ist erlaubt**, aber nicht am Boden abgestützt und **ohne Fremdhilfsmittel**
- Der Turm muss **innerhalb des markierten Feldes** (ca. 5 m, Rasenspray) entstehen,
  sonst keine Wertung
- Kreativität ist ausdrücklich erwünscht (seitliches Abstützen mit Kisten,
  Personen als Stütze, Huckepack)

## Wertung
**Anzahl Kisten = Punktzahl** (1:1, kein Maximum). Punktegleichstände sind in Kauf genommen.

*Einordnung aus dem internen Test: 8 Kisten = mittel, 10 = gut, 11–12 = hervorragend.*

## Offen
- Genaue Formulierung der Boden-/Stützregel (vermutete Lesart: Stützkonstruktionen
  dürfen nicht am Boden aufliegen; Personen und weitere Kisten dürfen stützen)
- Zählzeitpunkt: im gestützten Zustand oder nach kurzem Freistehen?
- Anzahl bereitgestellter Kisten pro Station`,
  },

  // ─── 4. ChaosQuadrant ───
  {
    name: "ChaosQuadrant",
    slug: "quadrant-chaos",
    typ: "NEU",
    modus: "DUELL",
    teamsProSlot: 2,
    kurzbeschreibung:
      "Völkerball-Variante auf 30×15 m: Bälle ins gegnerische Feld werfen. " +
      "3 fixe Runden à 1:30 — das Team mit den wenigsten Punkten gewinnt.",
    wertungstyp: "punkte",
    wertungslogik: {
      typ: "runden_strafpunkte",
      richtung: "niedrigster_gewinnt",
      einheit: "Punkte",
      runden: 3,
    },
    flaecheLaengeM: 30,
    flaecheBreiteM: 15,
    helferAnzahl: 2,
    schiedsrichterAnzahl: 3,
    stromNoetig: false,
    zaehltZurWertung: true,
    regeln: `## Setup
- Feld **30 × 15 m**, Mittellinie trennt zwei Quadranten à 15 × 15 m
- **20 Bälle** zu Beginn mittig auf der Mittellinie, Teams starten an ihrer Grundlinie

## Regeln
- Auf Startsignal Bälle ins gegnerische Feld werfen
- **Das gegnerische Feld darf nie betreten werden** (kein Übertritt über die Mittellinie)
- Ball nur **mit den Händen** fangen und werfen; mehrere Bälle tragen und rennen erlaubt
- **Kicken/Treten verboten** — auch ein Reflexkick ist ein Foul
- Ball rollt **ausserhalb** des gegnerischen Feldes: **Strafpunkt**; das werfende Team
  holt den Ball und darf erst wieder werfen, wenn der Spieler zurück im eigenen Feld ist
- Ball in der Hand zählt zum Quadranten, in dem der Spieler steht
- Gewertet wird, **wo der Ball liegen bleibt** — auch seitlich ausserhalb
- Runde endet, wenn alle Bälle in einem Quadranten sind oder die Zeit abläuft
- Doppelbestrafung ist gewollt: zu weit geworfene Bälle geben Strafpunkt **und**
  liegen wieder im eigenen Feld

## Rundenstruktur
- **Fix 3 Runden** à **1:30 Minuten** pro Slot
- Pro Runde und Team: Bälle im eigenen Quadranten + Strafpunkte, laufend erfasst
- Punkte werden über alle Runden **addiert** — **wenigste Punkte gewinnen**

## Schiedsrichter
- **2 Quadranten-Schiedsrichter** (je einer pro Quadrant) erfassen Fouls **laufend**
- **1 Haupt-Schiedsrichter** trägt die Punkte in der App ein

## Offen
- Bestätigung der 3/20-Faulpunkt-Regel. **Implementierte Lesart:** Bälle + Strafpunkte
  werden schlicht addiert — ein Team, das leerräumt, aber 3 Fouls hat, bekommt damit
  automatisch 3 Punkte statt 0.`,
  },

  // ─── 5. Schwebendes Labyrinth ───
  {
    name: "Schwebendes Labyrinth",
    slug: "schwebender-architekt",
    typ: "NEU",
    modus: "SOLO",
    teamsProSlot: 1,
    kurzbeschreibung:
      "Grosses Murmel-Labyrinth an Seilen. Team navigiert die Murmel ins Ziel — " +
      "schnellste Zeit zählt, Maximum 10:00.",
    wertungstyp: "zeit",
    wertungslogik: {
      typ: "zeit",
      richtung: "niedrigster_gewinnt",
      einheit: "Sekunden",
      maxSekunden: 600,
    },
    flaecheLaengeM: 5,
    flaecheBreiteM: 5,
    helferAnzahl: 1,
    schiedsrichterAnzahl: 1,
    stromNoetig: false,
    zaehltZurWertung: true,
    regeln: `## Setup
- **Murmel-Labyrinth mit Löchern** im Grossformat, an Seilen aufgehängt
- Auf dem Brett sind **2 Checkpoints** markiert (Minimalziel für jedes Team)

## Spielmodus
- Die Gruppe hebt das Labyrinth an den Seilen vom Boden ab und navigiert die Murmel ins Ziel
- Murmel fällt in ein Loch oder vom Brett → **von vorne** starten
- **Mehrere Versuche** erlaubt, um die schnellste Zeit zu erreichen
- **Alle Teammitglieder müssen mindestens einmal gespielt haben**
  (5er-Team: min. 2 Versuche, 10er-Team: min. 3 Versuche)
- Zeitfenster: **10 Minuten**

## Wertung
- Schiedsrichter stoppt die Zeit — **die schnellste Zeit des Teams zählt**
- Nach 10 Minuten nicht fertig → **10:00 wird eingetragen**
  (Checkpoints spielen für die Wertung keine Rolle)
- Umrechnung in Rangpunkte erfolgt am Ende des Tages

## Offen
- Anzahl Seile am Labyrinth (bestimmt, wie viele Personen gleichzeitig spielen)`,
  },

  // ─── 6. Lavabecken ───
  {
    name: "Lavabecken",
    slug: "lava-becken",
    typ: "NEU",
    modus: "SOLO",
    teamsProSlot: 1,
    kurzbeschreibung:
      "Floor-is-Lava im Unihockey-Feld: 5 Personen, 2 Yogamatten, Torschuss und " +
      "Hindernisse. Schnellste Zeit gewinnt, Maximum 10:00.",
    wertungstyp: "zeit",
    wertungslogik: {
      typ: "zeit",
      richtung: "niedrigster_gewinnt",
      einheit: "Sekunden",
      maxSekunden: 600,
    },
    flaecheLaengeM: 40,
    flaecheBreiteM: 20,
    helferAnzahl: 2,
    schiedsrichterAnzahl: 1,
    stromNoetig: false,
    zaehltZurWertung: true,
    regeln: `## Setup
- Austragung im **Unihockey-Feld** (vier Türen werden genutzt)
- **5 Personen** pro Durchgang, **2 Gymnastik-/Yogamatten** als einziges Fortbewegungsmittel
- Im Feld: ein **Unihockeyball** und ein **Unihockeystock**; Hindernisse im zweiten
  Abschnitt (Hürden, Kasten)

## Ablauf
**Grundregel durchgehend:** Nur auf den Matten stehen, den **Boden nie berühren**.
Fortbewegung durch Weitergeben und Umlegen der Matten.

1. **Abschnitt 1 — Torschuss:** Stock holen und ein Tor schiessen; bei Fehlschuss Ball
   holen und erneut schiessen, bis das Tor fällt
2. **Zwischenphase:** Am gegenüberliegenden Feldende kurz aus dem Feld,
   **Spielerwechsel möglich**, danach Wiedereinstieg
3. **Abschnitt 2 — Hindernisse:** Hürden und Kasten über-/durchqueren,
   Lavabecken bis zum Ende durchschreiten

## Strafen
- **Bodenberührung** → das Team erhält einen **Gegenstand, den es fortan mittragen muss**
- Strafgegenstände sind **eskalierend** (jede weitere Strafe = ein zusätzlicher,
  grösserer/schwererer Gegenstand: Kisten, Bänke)
- Alle Gegenstände müssen **bis zum Schluss** mitgetragen werden
- Keine Zeitstrafen — die Verlangsamung durch die Gegenstände ist die Strafe

## Wertung
- **Die Zeit entscheidet**, schnellstes Team gewinnt; maximale Spielzeit **10 Minuten**
- Nach 10 Minuten nicht fertig → **10:00 wird eingetragen** (schlechteste Rangpunkte)

*Gimmick: Kartonflügel für die Schiedsrichter — sie dürfen als «Hermes» durchs Lavabecken laufen.*`,
  },

  // ─── 7. Erussbacher Stack Attack ───
  {
    name: "Erussbacher Stack Attack",
    slug: "stack-attack",
    typ: "RETURNEE",
    modus: "SOLO",
    teamsProSlot: 1,
    kurzbeschreibung:
      "Das Team presst Erusbacher-Bierharassen zu einer möglichst langen Reihe zusammen " +
      "und hebt sie vom Boden ab. Rekord 2025: 64 Harassen mit 6 Personen.",
    playtimeMin: 8, // 10 min minus 2 min Aufräumen durch Team
    wertungstyp: "anzahl",
    wertungslogik: {
      typ: "max_value",
      richtung: "hoechster_gewinnt",
      einheit: "Harassen",
      messung: "anzahl_harassen",
      eingabefelder: [
        { name: "anzahl_harassen", typ: "number", label: "Anzahl Harassen im Stack" },
      ],
    },
    flaecheLaengeM: 15,
    flaecheBreiteM: 10,
    helferAnzahl: 2,
    schiedsrichterAnzahl: 1,
    stromNoetig: false,
    zaehltZurWertung: true,
    regeln: `## Regeln
- **Bierharassen werden gegeneinander gepresst** und als Reihe vom Boden abgehoben
- Ziel: möglichst viele Harassen schaffen
- Mehrere Versuche innerhalb der Spielzeit erlaubt, bester Versuch zählt
- Aufräumen macht das Team selbst (in der Spielzeit eingerechnet)

**Achtung:** Kisten stapeln und Stack Attack sind **zwei verschiedene Games**
(Kartonzügelkisten vs. Bierharassen).

## Wertung
**Anzahl Harassen = Punktzahl** (analog Kisten stapeln).

## Offen
- Wertungslogik ist noch nicht explizit bestätigt (vermutlich analog Kisten stapeln)`,
  },

  // ─── 8. Human Soccer ───
  {
    name: "Human Soccer",
    slug: "human-soccer",
    typ: "RETURNEE",
    modus: "DUELL",
    teamsProSlot: 2,
    kurzbeschreibung:
      "Tischkicker in Lebensgrösse. Spieler auf festen Reihen, nur seitliche Bewegung. " +
      "Aufblasbare Arena via Arena der Wunder.",
    wertungstyp: "tore",
    wertungslogik: {
      typ: "punkte_duell",
      richtung: "hoechster_gewinnt",
      einheit: "Tore",
      eingabefelder: [
        { name: "tore_team_a", typ: "number", label: "Tore Team A" },
        { name: "tore_team_b", typ: "number", label: "Tore Team B" },
      ],
    },
    flaecheLaengeM: 20,
    flaecheBreiteM: 12,
    helferAnzahl: 2,
    schiedsrichterAnzahl: 1,
    stromNoetig: true,
    zaehltZurWertung: true,
    regeln: `## Regeln
- Spieler auf fixen Reihen (Stangen/Bänder), nur seitliche Bewegung
- Ball: weich (Schaumstoff)
- Kein Hands, kein Halten, kein Treten über Hüfthöhe
- Spielerzahl abhängig vom gemieteten Modell

## Wertung
**Wie beim Fussball:** Die Torpunkte werden eingetragen. Mehr Tore nach 10 min gewinnt.
Unentschieden ist möglich und führt zu geteilten Rängen.`,
  },

  // ─── 9. XXL Viergewinnt ───
  {
    name: "XXL Viergewinnt",
    slug: "xxl-viergewinnt",
    typ: "NEU",
    modus: "DUELL",
    teamsProSlot: 2,
    kurzbeschreibung:
      "Vier gewinnt im Grossformat, kombiniert mit einer Staffette — Strategie plus " +
      "sportliches Geschick. Sieg zählt, weniger Züge sind besser.",
    wertungstyp: "sieg_zuege",
    wertungslogik: {
      typ: "sieg_zuege",
      richtung: "hoechster_gewinnt",
      einheit: "Punkte",
      // Score = Siege × Gewichtung − Züge. Gewichtung nur im Leitstand sichtbar.
      gewichtungSieg: 100,
      eingabefelder: [
        { name: "siege", typ: "number", label: "Gewonnene Partien" },
        { name: "zuege", typ: "number", label: "Züge in gewonnenen Partien (Summe)" },
      ],
    },
    flaecheLaengeM: 15,
    flaecheBreiteM: 10,
    helferAnzahl: 2,
    schiedsrichterAnzahl: 1,
    stromNoetig: false,
    zaehltZurWertung: true,
    regeln: `## Regeln
- Vier gewinnt im Grossformat, Duell zwischen zwei Teams
- **Kombiniert mit einer Staffette** — die Spielsteine müssen erlaufen werden;
  Nichttreffer können Personen kosten
- Strategie und sportliches Geschick zählen gleichermassen

## Wertung
- Der **Sieg zählt primär**, die **Zügezahl** der Siegpartien fliesst als Feinwertung ein
  (eine Viererreihe in 10 Zügen ist besser als eine in 13)
- Der Schiedsrichter trägt pro Team die gewonnenen Partien und die Summe der Züge
  in den gewonnenen Partien ein

## Offen
- Die konkrete Verrechnungsformel Sieg ↔ Zügezahl ist nicht final entschieden.
  **Vorläufig implementiert:** Sieg primär, Zügezahl als Tiebreaker — ein Verlierer
  kann einen Sieger nie überholen (analog zur Cornhole-Logik).`,
  },

  // ─── 10. Der grosse Eierfall ───
  {
    name: "Der grosse Eierfall",
    slug: "eierfall",
    typ: "NEU",
    modus: "SOLO",
    teamsProSlot: 1,
    kurzbeschreibung:
      "Bonusrunde über den ganzen Tag: Teams bauen eine Schutzkonstruktion für ein rohes Ei. " +
      "Streichung möglich — Game ist abschaltbar gebaut.",
    wertungstyp: "risiko",
    wertungslogik: {
      typ: "risiko_wahl",
      richtung: "hoechster_gewinnt",
      optionen: [
        { name: "2m", punkte_erfolg: 5, punkte_fail: 0 },
        { name: "3m", punkte_erfolg: 10, punkte_fail: 0 },
        { name: "5m", punkte_erfolg: 20, punkte_fail: 0 },
      ],
    },
    flaecheLaengeM: 5,
    flaecheBreiteM: 5,
    helferAnzahl: 2,
    schiedsrichterAnzahl: 1,
    stromNoetig: false,
    zaehltZurWertung: true,
    regeln: `## Regeln
- **Bonusrunde, die über den ganzen Tag läuft**
- Teams bauen eine Schutzkonstruktion für ein rohes Ei und wählen die Fallhöhe

## Offen
- **Wertungslogik ist nicht spezifiziert** — die hinterlegte Risiko-Wertung
  (2 m/3 m/5 m) ist ein Platzhalter aus der früheren Planung
- **Streichung ist möglich.** Das Game kann über «Zählt zur Wertung» im Admin
  jederzeit aus der Gesamtwertung genommen werden, ohne dass Ergebnisse verloren gehen.`,
  },

  // ─── 11. Menschenkugelbahn ───
  {
    name: "Menschenkugelbahn",
    slug: "menschenkugelbahn",
    typ: "NEU",
    modus: "SOLO",
    teamsProSlot: 1,
    kurzbeschreibung:
      "Parcours, der auf Zeit gerechnet wird. Details folgen — Zeitlimit und " +
      "Nichtabschluss-Regel noch offen.",
    wertungstyp: "zeit",
    wertungslogik: {
      typ: "zeit",
      richtung: "niedrigster_gewinnt",
      einheit: "Sekunden",
      maxSekunden: 600,
    },
    flaecheLaengeM: 20,
    flaecheBreiteM: 10,
    helferAnzahl: 2,
    schiedsrichterAnzahl: 1,
    stromNoetig: false,
    zaehltZurWertung: true,
    regeln: `## Regeln
- **Parcours, der auf Zeit gerechnet wird**

## Offen
- Zeitlimit und Umgang mit Nichtabschluss sind nicht festgelegt.
  **Vorläufig implementiert:** analog Schwebendes Labyrinth und Lavabecken —
  Maximalzeit 10:00 wird bei Nichtabschluss eingetragen.`,
  },
];

/** Slugs von Games, die nicht mehr im Programm sind (Protokoll: 11 Games). */
export const ausgemusterteSlugs = ["xxl-basketball", "geschicklichkeits-parcour"];
