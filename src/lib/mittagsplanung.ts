/**
 * Mittagsplanung als Wellen statt als globale Pause.
 *
 * Die Orga gibt nur das Küchenfenster vor ("Mittag kann ab 11:30 starten und
 * muss bis 13:30 durch sein"). Wie die Teams darin verteilt werden, rechnet
 * diese Datei aus:
 *
 * - Wellen liegen auf dem Versatz-Raster (Standard: alle 10 min startet eine
 *   neue Gruppe von 2–3 Teams).
 * - Passen nicht alle Gruppen ins Fenster, werden die Wellen grösser statt
 *   länger — das Fenster ist die harte Grenze, die Gruppengrösse die weiche.
 * - Posten-Crew (Schiedsrichter/Helfer eines Games) und freie Helfer werden
 *   über dieselben Wellen gestreut. Daraus entsteht die Verpflegungsübersicht:
 *   wie viele Personen zu welcher Zeit am Essen sind.
 *
 * Reine Funktionen ohne DB-Zugriff — der Zeitplan-Generator übernimmt die
 * Wellen und sperrt die betroffenen Runden für Teams und Posten.
 */

import { formatZeit, parseZeit } from "@/lib/zeit";

export type MittagsfensterConfig = {
  /** Frühester Beginn der ersten Welle, "11:30". */
  von: string;
  /** Spätestes Ende der letzten Welle, "13:30". */
  bis: string;
  /** Essenszeit pro Gruppe in Minuten. */
  dauerMin: number;
  /** Wunschgrösse einer Welle (2–3 Teams). */
  teamsProWelle: number;
  /** Abstand zwischen zwei Wellenstarts in Minuten. */
  versatzMin: number;
};

export type MittagsTeam = {
  id: string;
  name: string;
  /** Kopfzahl für die Verpflegung; null ⇒ wird als 0 gezählt und gemeldet. */
  teilnehmerAnzahl?: number | null;
};

export type MittagsPosten = {
  id: string;
  name: string;
  /** Anzahl Personen der Posten-Crew (Schiedsrichter + Helfer). */
  crewGroesse: number;
};

export type MittagsHelfer = { id: string; name: string };

export type MittagsplanEingabe = {
  fenster: MittagsfensterConfig;
  teams: MittagsTeam[];
  /** Posten, deren Crew während der Welle Pause macht. */
  posten?: MittagsPosten[];
  /** Helfer ohne Posten-Zuteilung, die mitessen. */
  freieHelfer?: MittagsHelfer[];
};

export type MittagsWelle = {
  welle: number;
  startZeit: string;
  endZeit: string;
  startMin: number;
  endeMin: number;
  teamIds: string[];
  teamNamen: string[];
  postenIds: string[];
  postenNamen: string[];
  helferIds: string[];
  helferNamen: string[];
  /** Teilnehmer der Teams + Crew der pausierenden Posten + freie Helfer. */
  personenTotal: number;
};

export type Mittagsplan = {
  wellen: MittagsWelle[];
  /** Effektive Gruppengrösse (kann grösser als gewünscht sein). */
  teamsProWelle: number;
  hinweise: string[];
};

export const MITTAG_DEFAULT: MittagsfensterConfig = {
  von: "11:30",
  bis: "13:30",
  dauerMin: 30,
  teamsProWelle: 3,
  versatzMin: 10,
};

/**
 * Bringt eine gespeicherte Mittagskonfiguration auf die aktuelle Form.
 *
 * Die Spalte `ZeitplanConfig.mittagspause` ist JSON und trug früher eine
 * andere Form: `{ nachRunde, dauerMin, maxTeamsGleichzeitig, versatzMin }` —
 * eine feste Pause nach Runde N. Pläne aus dieser Zeit stehen weiterhin in der
 * Datenbank; ohne Übersetzung fehlten `von`/`bis` und die Zeitplanseite lief
 * beim Rendern auf.
 *
 * Was sich übernehmen lässt (Essenszeit, Versatz, Gruppengrösse), wird
 * übernommen; das Fenster selbst ist aus einer Rundennummer nicht ableitbar
 * und fällt auf den Standard zurück.
 */
export function normalisiereMittagsfenster(wert: unknown): MittagsfensterConfig | null {
  if (!wert || typeof wert !== "object") return null;
  const roh = wert as Record<string, unknown>;

  const zahl = (v: unknown, standard: number): number =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : standard;
  const zeit = (v: unknown, standard: string): string =>
    typeof v === "string" && /^\d{1,2}:[0-5]\d$/.test(v) ? v : standard;

  return {
    von: zeit(roh.von, MITTAG_DEFAULT.von),
    bis: zeit(roh.bis, MITTAG_DEFAULT.bis),
    dauerMin: Math.max(5, zahl(roh.dauerMin, MITTAG_DEFAULT.dauerMin)),
    // Altform: maxTeamsGleichzeitig war die Kapazität einer Schicht.
    teamsProWelle: Math.max(
      1,
      zahl(roh.teamsProWelle ?? roh.maxTeamsGleichzeitig, MITTAG_DEFAULT.teamsProWelle),
    ),
    versatzMin: zahl(roh.versatzMin, MITTAG_DEFAULT.versatzMin),
  };
}

/**
 * Wie viele Wellen passen ins Fenster? Die letzte Welle muss vollständig
 * innerhalb von [von, bis] liegen.
 */
export function maximaleWellen(fenster: MittagsfensterConfig): number {
  const von = parseZeit(fenster.von);
  const bis = parseZeit(fenster.bis);
  if (!Number.isFinite(von) || !Number.isFinite(bis)) return 0;
  const spielraum = bis - von - fenster.dauerMin;
  if (spielraum < 0) return 0;
  if (fenster.versatzMin <= 0) return 1;
  return Math.floor(spielraum / fenster.versatzMin) + 1;
}

/** Reihum verteilen — hält die Wellen gleich gross und ist deterministisch. */
function reihum<T>(elemente: readonly T[], anzahlWellen: number): T[][] {
  const eimer: T[][] = Array.from({ length: anzahlWellen }, () => []);
  elemente.forEach((el, i) => eimer[i % anzahlWellen].push(el));
  return eimer;
}

/**
 * Verteilt Teams, Posten-Crew und freie Helfer auf Wellen im Küchenfenster.
 */
export function planeMittag(eingabe: MittagsplanEingabe): Mittagsplan {
  const { fenster } = eingabe;
  const teams = eingabe.teams;
  const posten = eingabe.posten ?? [];
  const freieHelfer = eingabe.freieHelfer ?? [];
  const hinweise: string[] = [];

  const von = parseZeit(fenster.von);
  const bis = parseZeit(fenster.bis);

  if (!Number.isFinite(von) || !Number.isFinite(bis)) {
    return {
      wellen: [],
      teamsProWelle: fenster.teamsProWelle,
      hinweise: [`WARN: Mittagsfenster "${fenster.von}–${fenster.bis}" ist keine gültige Zeitangabe.`],
    };
  }

  if (bis - von < fenster.dauerMin) {
    return {
      wellen: [],
      teamsProWelle: fenster.teamsProWelle,
      hinweise: [
        `WARN: Mittagsfenster ${fenster.von}–${fenster.bis} ist kürzer als die Essenszeit von ${fenster.dauerMin} min.`,
      ],
    };
  }

  if (teams.length === 0 && posten.length === 0 && freieHelfer.length === 0) {
    return { wellen: [], teamsProWelle: fenster.teamsProWelle, hinweise };
  }

  const wunschGroesse = Math.max(1, fenster.teamsProWelle);
  const passenMax = Math.max(1, maximaleWellen(fenster));
  const gewuenscht = Math.max(1, Math.ceil(teams.length / wunschGroesse));
  const anzahlWellen = Math.min(gewuenscht, passenMax);
  const effektiveGroesse = Math.max(1, Math.ceil(teams.length / anzahlWellen));

  if (gewuenscht > passenMax) {
    hinweise.push(
      `WARN: ${teams.length} Teams zu je ${wunschGroesse} bräuchten ${gewuenscht} Wellen, ` +
        `ins Fenster ${fenster.von}–${fenster.bis} passen nur ${passenMax}. ` +
        `Es essen jetzt bis zu ${effektiveGroesse} Teams gleichzeitig — ` +
        `Fenster verlängern oder Versatz verkleinern, wenn die Küche das nicht trägt.`,
    );
  }

  const teamGruppen = reihum(teams, anzahlWellen);
  const postenGruppen = reihum(posten, anzahlWellen);
  const helferGruppen = reihum(freieHelfer, anzahlWellen);

  const ohneKopfzahl = teams.filter(
    (t) => t.teilnehmerAnzahl == null || t.teilnehmerAnzahl <= 0,
  );
  if (ohneKopfzahl.length > 0) {
    hinweise.push(
      `INFO: ${ohneKopfzahl.length} Team(s) ohne Teilnehmerzahl — sie fehlen in der Kopfzahl der Verpflegung.`,
    );
  }

  const wellen: MittagsWelle[] = [];
  for (let w = 0; w < anzahlWellen; w++) {
    const startMin = von + w * fenster.versatzMin;
    const endeMin = startMin + fenster.dauerMin;
    const wTeams = teamGruppen[w];
    const wPosten = postenGruppen[w];
    const wHelfer = helferGruppen[w];

    const personenTotal =
      wTeams.reduce((s, t) => s + Math.max(0, t.teilnehmerAnzahl ?? 0), 0) +
      wPosten.reduce((s, p) => s + Math.max(0, p.crewGroesse), 0) +
      wHelfer.length;

    wellen.push({
      welle: w + 1,
      startZeit: formatZeit(startMin),
      endZeit: formatZeit(endeMin),
      startMin,
      endeMin,
      teamIds: wTeams.map((t) => t.id),
      teamNamen: wTeams.map((t) => t.name),
      postenIds: wPosten.map((p) => p.id),
      postenNamen: wPosten.map((p) => p.name),
      helferIds: wHelfer.map((h) => h.id),
      helferNamen: wHelfer.map((h) => h.name),
      personenTotal,
    });
  }

  return { wellen, teamsProWelle: effektiveGroesse, hinweise };
}

/** Gesamtzahl Personen, die im Fenster verpflegt werden. */
export function personenGesamt(wellen: readonly MittagsWelle[]): number {
  return wellen.reduce((s, w) => s + w.personenTotal, 0);
}

/** Höchste gleichzeitige Belegung — die Zahl, an der die Küche hängt. */
export function spitzenBelegung(wellen: readonly MittagsWelle[]): number {
  let spitze = 0;
  for (const a of wellen) {
    let gleichzeitig = 0;
    for (const b of wellen) {
      if (b.startMin < a.endeMin && a.startMin < b.endeMin) {
        gleichzeitig += b.personenTotal;
      }
    }
    if (gleichzeitig > spitze) spitze = gleichzeitig;
  }
  return spitze;
}
