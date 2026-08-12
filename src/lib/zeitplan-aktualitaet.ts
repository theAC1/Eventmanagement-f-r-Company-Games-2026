/**
 * Passt der gespeicherte Zeitplan noch zu den Stammdaten?
 *
 * Ein Zeitplan ist eine Momentaufnahme: er hält die Teams und Posten fest, mit
 * denen er gerechnet wurde. Kommt danach ein Team dazu, fliegt eins raus oder
 * ändert ein Game seine Durchgänge, stimmt der Plan nicht mehr — sichtbar wird
 * das aber erst am Turniertag, wenn es zu spät ist.
 *
 * Diese Prüfung vergleicht beides und benennt jede Abweichung im Klartext.
 * Reine Funktion ohne DB-Zugriff.
 */

export type GeplanterStand = {
  /** Team-IDs, die im gespeicherten Plan vorkommen. */
  teamIds: readonly string[];
  /** Game-ID → wie oft jedes Team dieses Game im Plan spielt. */
  durchgaengeProGame: Readonly<Record<string, number>>;
};

export type AktuellerStand = {
  teams: readonly { id: string; name: string }[];
  /** Nur die Games, die in einen Zeitplan gehören (BEREIT/AKTIV). */
  games: readonly { id: string; name: string; durchgaenge: number }[];
};

export type ZeitplanAktualitaet = {
  aktuell: boolean;
  abweichungen: string[];
};

/** Bis zu so viele Namen werden aufgezählt, danach wird zusammengefasst. */
const MAX_NAMEN = 5;

function nenne(namen: string[]): string {
  if (namen.length <= MAX_NAMEN) return namen.join(", ");
  return `${namen.slice(0, MAX_NAMEN).join(", ")} und ${namen.length - MAX_NAMEN} weitere`;
}

export function pruefeZeitplanAktualitaet(
  plan: GeplanterStand,
  aktuell: AktuellerStand,
): ZeitplanAktualitaet {
  const abweichungen: string[] = [];

  const imPlan = new Set(plan.teamIds);
  const neueTeams = aktuell.teams.filter((t) => !imPlan.has(t.id));
  const aktuelleIds = new Set(aktuell.teams.map((t) => t.id));
  const entfallene = [...imPlan].filter((id) => !aktuelleIds.has(id));

  if (neueTeams.length > 0) {
    abweichungen.push(
      `${neueTeams.length} Team(s) sind neu dazugekommen: ${nenne(neueTeams.map((t) => t.name))}.`,
    );
  }
  if (entfallene.length > 0) {
    abweichungen.push(
      `${entfallene.length} Team(s) aus dem Plan gibt es nicht mehr.`,
    );
  }

  const geplant = plan.durchgaengeProGame;
  for (const game of aktuell.games) {
    const istImPlan = game.id in geplant;
    if (!istImPlan) {
      abweichungen.push(`"${game.name}" ist bereit, steht aber nicht im Zeitplan.`);
      continue;
    }
    if (geplant[game.id] !== game.durchgaenge) {
      abweichungen.push(
        `"${game.name}": ${game.durchgaenge} Durchgang/Durchgänge eingestellt, im Plan sind es ${geplant[game.id]}.`,
      );
    }
  }

  const bereiteIds = new Set(aktuell.games.map((g) => g.id));
  const verwaiste = Object.keys(geplant).filter((id) => !bereiteIds.has(id));
  if (verwaiste.length > 0) {
    abweichungen.push(
      `${verwaiste.length} Posten im Plan sind nicht mehr auf "Bereit" oder wurden gelöscht.`,
    );
  }

  return { aktuell: abweichungen.length === 0, abweichungen };
}

/**
 * Leitet aus gespeicherten Slots ab, wie oft jedes Team welches Game spielt.
 * Massgeblich ist das Maximum über die Teams — ein einzelner Ausfall soll nicht
 * als geänderte Durchgangszahl durchgehen.
 */
export function durchgaengeAusSlots(
  slots: readonly { gameId: string; teamIds: readonly string[] }[],
): Record<string, number> {
  const proGameUndTeam = new Map<string, Map<string, number>>();
  for (const slot of slots) {
    if (!slot.gameId) continue;
    let proTeam = proGameUndTeam.get(slot.gameId);
    if (!proTeam) {
      proTeam = new Map();
      proGameUndTeam.set(slot.gameId, proTeam);
    }
    for (const teamId of slot.teamIds) {
      proTeam.set(teamId, (proTeam.get(teamId) ?? 0) + 1);
    }
  }

  const ergebnis: Record<string, number> = {};
  for (const [gameId, proTeam] of proGameUndTeam) {
    ergebnis[gameId] = Math.max(...proTeam.values(), 0);
  }
  return ergebnis;
}
