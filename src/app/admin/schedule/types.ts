import type {
  MittagsfensterParameter,
  ZeitplanParameter,
} from "@/lib/zeitplan-parameter";
import type { MittagsWelle } from "@/lib/mittagsplanung";
import type { ZeitplanAktualitaet } from "@/lib/zeitplan-aktualitaet";

export type { MittagsfensterParameter, ZeitplanParameter, MittagsWelle };

export type Team = { id: string; name: string; nummer: number };

export type Game = {
  id: string;
  name: string;
  slug: string;
  status: string;
  teamsProSlot: number;
  durchgaenge: number;
};

// Ungerichtetes Game-Paar: wer Game A früh spielt, spielt Game B spät
export type AntiKorrelationConfig = { gameXId: string; gameYId: string };

export type SlotOutput = {
  runde: number;
  startZeit: string;
  endZeit: string;
  gameId: string;
  gameName: string;
  teamIds: string[];
  teamNames: string[];
};

/** Wie der Plan zum Turnierfenster steht. */
export type TurnierFenster = {
  startZeit: string;
  endeSoll: string | null;
  endeIst: string;
  passt: boolean;
  ueberzugMin: number;
};

export type ScheduleStatistiken = {
  freirundenProTeam: Record<string, number>;
  duellGegnerVerteilung: Record<string, Record<string, number>>;
  rundenEffizienz: number;
  teamAuslastung: Record<string, number>;
  theoretischesMinimum: number;
  postenProTeam: number;
  postenVormittagProTeam: Record<string, number>;
  laengsteSerieProTeam: Record<string, number>;
};

export type ScheduleResult = {
  slots: SlotOutput[];
  runden: number;
  endZeit: string;
  konflikte: string[];
  teamZeitplaene: Record<string, SlotOutput[]>;
  statistiken?: ScheduleStatistiken;
  mittagsWellen?: MittagsWelle[];
  fenster?: TurnierFenster;
};

/** Was an den Slots eines gespeicherten Zeitplans hängt. */
export type ZeitplanAbhaengigkeiten = {
  qrScans: number;
  ergebnisse: number;
  einsaetze: number;
};

/** Sperr-Status, den `GET /api/schedule/:id` mitliefert. */
export type ZeitplanSperre = {
  gamedayModus: string | null;
  neuaufbauErlaubt: boolean;
  grund: string | null;
  warnungen: string[];
};

/** Antwort von `GET /api/schedule/:id` — Ergebnis plus gespeicherte Metadaten. */
export type GeladenerZeitplan = ScheduleResult &
  ZeitplanParameter & {
    id: string;
    name: string;
    anzahlTeams: number;
    istAktiv: boolean;
    createdAt: string;
    updatedAt: string;
    abhaengigkeiten: ZeitplanAbhaengigkeiten;
    aktualitaet: ZeitplanAktualitaet;
    sperre: ZeitplanSperre;
  };

/** Listeneintrag von `GET /api/schedule` — inklusive Parameter. */
export type SavedConfig = {
  id: string;
  name: string;
  anzahlTeams: number;
  istAktiv: boolean;
  createdAt: string;
  updatedAt: string;
  blockDauerMin: number;
  wechselzeitMin: number;
  startZeit: string;
  endZeit: string;
  fensterEndeZeit: string | null;
  postenVormittag: number | null;
  mittagspause: MittagsfensterParameter | null;
  _count: { slots: number };
};

/** Antwort von `GET /api/gameday`. */
export type GamedayStatus = {
  modus: string;
  active: boolean;
};
