/**
 * Shared Types – verwendet von Frontend UND Backend
 * Single Source of Truth für alle DTOs
 */

// ─── Enums ───

export type GameTyp = "RETURNEE" | "NEU";
export type GameStatus = "ENTWURF" | "BEREIT" | "AKTIV" | "ABGESCHLOSSEN";
export type GameModus = "SOLO" | "DUELL";
export type MaterialKategorie = "SPONSOR" | "MIETE" | "KAUF" | "EIGENBAU" | "VERBRAUCH" | "INFRASTRUKTUR";
export type MaterialStatus = "OFFEN" | "ANGEFRAGT" | "BESTAETIGT" | "VORHANDEN" | "GELIEFERT";
export type ErgebnisStatus = "AUSSTEHEND" | "EINGETRAGEN" | "VERIFIZIERT" | "KORRIGIERT";

// ─── Wertungslogik (Discriminated Union) ───

export type WertungslogikBase = {
  richtung?: "hoechster_gewinnt" | "niedrigster_gewinnt";
  eingabefelder?: Array<{ name: string; typ: string; label: string }>;
};

export type MaxValueLogik = WertungslogikBase & {
  typ: "max_value";
  einheit: string;
  messung: string;
  tiebreaker?: string;
};

export type ZeitLogik = WertungslogikBase & {
  typ: "zeit";
  einheit: string;
  strafen?: Record<string, number>;
  nicht_geschafft?: string;
};

export type PunkteDuellLogik = WertungslogikBase & {
  typ: "punkte_duell";
};

export type FormelLogik = WertungslogikBase & {
  typ: "formel";
  formel: string;
  einheit: string;
};

export type MultiLevelLogik = WertungslogikBase & {
  typ: "multi_level";
  levels: Array<{ name: string; grundpunkte: number }>;
  zeit_bonus?: string;
};

export type RisikoWahlLogik = WertungslogikBase & {
  typ: "risiko_wahl";
  optionen: Array<{ name: string; punkte_erfolg: number; punkte_fail: number }>;
  tiebreaker?: string;
  show_modus?: boolean;
};

export type Wertungslogik =
  | MaxValueLogik
  | ZeitLogik
  | PunkteDuellLogik
  | FormelLogik
  | MultiLevelLogik
  | RisikoWahlLogik;

// ─── Game ───

export type GameDTO = {
  id: string;
  name: string;
  slug: string;
  typ: GameTyp;
  status: GameStatus;
  modus: GameModus;
  teamsProSlot: number;
  kurzbeschreibung: string | null;
  einfuehrungMin: number;
  playtimeMin: number;
  reserveMin: number;
  regeln: string | null;
  wertungstyp: string | null;
  wertungslogik: Wertungslogik | null;
  flaecheLaengeM: number | null;
  flaecheBreiteM: number | null;
  helferAnzahl: number;
  stromNoetig: boolean;
  _count?: { varianten: number; materialItems: number };
};

// ─── Team ───

export type TeamDTO = {
  id: string;
  name: string;
  nummer: number;
  captainName: string | null;
  captainEmail: string | null;
  farbe: string;
  logoUrl: string | null;
  motto: string | null;
  teilnehmerAnzahl: number | null;
  teilnehmerNamen: string[] | null;
  qrToken: string;
  checkinCode: string;
};

// ─── Ergebnis ───

export type ErgebnisDTO = {
  id: string;
  gameId: string;
  teamId: string;
  rohdaten: Record<string, unknown>;
  gamePunkte: number | null;
  rangImGame: number | null;
  rangPunkte: number | null;
  status: ErgebnisStatus;
  eingetragenUm: string | null;
  game?: { id: string; name: string; slug: string };
  team?: { id: string; name: string; nummer: number };
};

// ─── Material ───

export type MaterialItemDTO = {
  id: string;
  name: string;
  gameId: string | null;
  kategorie: MaterialKategorie;
  menge: string | null;
  beschreibung: string | null;
  status: MaterialStatus;
  sponsor: string | null;
  kostenGeschaetzt: string | null;
  kostenEffektiv: string | null;
  game: { id: string; name: string; slug: string } | null;
  verantwortlich: { id: string; name: string } | null;
  _count?: { kommentare: number };
};

// ─── Rangliste ───

export type RanglisteEntry = {
  teamId: string;
  teamName: string;
  rangPunkteSumme: number;
  gamesGespielt: number;
  gamesTotal: number;
  gesamtRang: number;
  platzierungen: Record<number, number>;
};

export type RanglisteResponse = {
  rangliste: RanglisteEntry[];
  totalGames: number;
  totalTeams: number;
  ergebnisseEingetragen: number;
};

// ─── Zeitplan ───

export type SlotOutput = {
  runde: number;
  startZeit: string;
  endZeit: string;
  gameId: string;
  gameName: string;
  teamIds: string[];
  teamNames: string[];
};
