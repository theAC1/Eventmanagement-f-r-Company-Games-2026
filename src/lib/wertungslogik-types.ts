/**
 * Wertungslogik-Typen für Company Games 2026
 *
 * Quelle der Regeln: company-games-spielregeln-protokoll.md (Stand 10.08.2026)
 *
 * Unterstützte typ-Werte:
 * - "max_value"              — Anzahl = Punkte (Kisten stapeln, Stack Attack)
 * - "zeit"                   — Zeit in Sekunden, niedrigste gewinnt; DNF = maxSekunden
 *                              (Schwebendes Labyrinth, Lavabecken, Menschenkugelbahn)
 * - "punkte_duell"           — je Team ein Punktefeld (Human Soccer)
 * - "duell_kleinbegegnungen" — Cornhole: Score = Siegquote × G + Mittelwert
 * - "runden_strafpunkte"     — ChaosQuadrant: Σ(Bälle + Strafpunkte) über fixe Runden,
 *                              wenigste Punkte gewinnen
 * - "tuerme_punkte"          — Robert Huber Radio: Sektionen + Bonusklötze + 100%-Bonus
 * - "sieg_zuege"             — XXL Viergewinnt: Siege × Gewichtung − Züge
 * - "formel", "multi_level", "risiko_wahl" — Bestandstypen für Bonus-Games
 */

export type WertungsRichtung = "hoechster_gewinnt" | "niedrigster_gewinnt";

export type Eingabefeld = { name: string; typ?: string; label?: string };

export type TurmConfig = {
  name: string;
  /** Anzahl Sektionen — je 1 Punkt, nur bei vollständig korrekter Sektion */
  sektionen: number;
  /** Anzahl Bonusklötze — je 1 Punkt bei korrekter Platzierung */
  bonus: number;
  /** Abweichende Bezeichnung der Bonusklötze, z. B. "Farbklötze" */
  bonusLabel?: string;
};

export type Wertungslogik = {
  typ: string;
  richtung?: WertungsRichtung;
  einheit?: string;
  messung?: string;
  strafen?: Record<string, number>;
  eingabefelder?: Eingabefeld[];
  levels?: Array<{ name: string; grundpunkte: number }>;
  optionen?: Array<{ name: string; punkte_erfolg: number; punkte_fail: number }>;
  nicht_geschafft?: string;
  /** zeit: Obergrenze und DNF-Wert in Sekunden (Protokoll: 10:00 → 600) */
  maxSekunden?: number;
  /** duell_kleinbegegnungen: Gewichtungsfaktor G — nur Leitstand, nicht für Schiedsrichter */
  gewichtungG?: number;
  /** runden_strafpunkte: fixe Rundenzahl pro Game-Slot */
  runden?: number;
  /** tuerme_punkte: Turm-Definitionen mit Sektions-/Bonuszahl */
  tuerme?: TurmConfig[];
  /** sieg_zuege: Gewichtung eines Siegs gegenüber der Zügezahl — nur Leitstand */
  gewichtungSieg?: number;
};

// ─── Rohdaten-Formen der strukturierten Typen ───

/** Eine Cornhole-Kleinbegegnung aus Sicht des eigenen Teams (z. B. 16:13) */
export type KleinbegegnungRoh = { eigene: number; gegner: number };

/** Eine ChaosQuadrant-Runde aus Sicht des eigenen Teams */
export type RundeRoh = { baelle: number; strafpunkte: number };

/** Ergebnis eines Turms bei Robert Huber Radio (100%-Bonus wird abgeleitet) */
export type TurmRoh = { sektionen: number; bonus: number };

// ─── Defaults & Konstanten ───

/** Protokoll-Empfehlung: Siegquote dominiert, Mittelwert wirkt als Tiebreaker */
export const GEWICHTUNG_G_DEFAULT = 40;

/** Sieg dominiert die Zügezahl (ein Verlierer kann einen Sieger nie überholen) */
export const GEWICHTUNG_SIEG_DEFAULT = 100;

/** DNF-Sentinel für zeit-Games ohne konfiguriertes maxSekunden */
export const ZEIT_DNF_SENTINEL = 99999;

/**
 * Konfig-Schlüssel, die Schiedsrichter und Teams nicht sehen dürfen.
 * Das Protokoll verlangt: Der Schiedsrichter gibt nur Rohresultate ein und
 * sieht die Gewichtung nicht.
 */
export const VERTRAULICHE_WERTUNGS_KEYS = ["gewichtungG", "gewichtungSieg"] as const;

/**
 * Entfernt vertrauliche Gewichtungsfelder aus der Wertungslogik,
 * bevor sie an Nicht-ORGA-Clients (Schiedsrichter) ausgeliefert wird.
 */
export function sanitizeWertungslogikFuerSchiedsrichter(
  wertungslogik: Wertungslogik | null | undefined,
): Wertungslogik | null {
  if (!wertungslogik) return null;
  const kopie: Record<string, unknown> = { ...wertungslogik };
  for (const key of VERTRAULICHE_WERTUNGS_KEYS) {
    delete kopie[key];
  }
  return kopie as Wertungslogik;
}
