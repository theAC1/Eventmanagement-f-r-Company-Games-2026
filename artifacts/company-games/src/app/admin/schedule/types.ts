export type Team = { id: string; name: string; nummer: number };
export type Game = { id: string; name: string; status: string; teamsProSlot: number };

export type SlotOutput = {
  runde: number;
  startZeit: string;
  endZeit: string;
  gameId: string;
  gameName: string;
  teamIds: string[];
  teamNames: string[];
};

export type MittagsSchicht = {
  schicht: number;
  startZeit: string;
  endZeit: string;
  teamIds: string[];
  teamNames: string[];
};

export type ScheduleResult = {
  slots: SlotOutput[];
  runden: number;
  endZeit: string;
  konflikte: string[];
  teamZeitplaene: Record<string, SlotOutput[]>;
  mittagsSchichten?: MittagsSchicht[];
};

export type SavedConfig = {
  id: string;
  name: string;
  anzahlTeams: number;
  istAktiv: boolean;
  createdAt: string;
  endZeit: string;
  _count: { slots: number };
};
