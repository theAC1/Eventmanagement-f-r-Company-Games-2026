/**
 * Zeitplan-Engine v3 — Postenlauf mit Turnierfenster und rollendem Mittag
 *
 * Was die Engine löst:
 * - N Teams rotieren durch M Games; jedes Game kann mehrfach verlangt sein
 *   (`durchgaenge`) — 10 Games mit zwei Doppel-Games ergeben 12 Posten pro Team.
 * - Pro Runde belegt jedes Game höchstens einen Slot und jedes Team höchstens
 *   ein Game.
 * - Der Mittag ist keine globale Pause mehr, sondern rollt: Teams essen in
 *   Wellen (2–3 gleichzeitig, 10 min Versatz) in Runden, in denen sie frei
 *   sind. Der Betrieb läuft weiter.
 * - Posten-Crew (Schiedsrichter/Helfer) bekommt dieselbe Behandlung: der Posten
 *   pausiert genau in seiner Welle, damit die Crew essen kann.
 * - Freirunden werden über den Tag gestreut statt am Ende gebündelt — Teams
 *   sollen zwischendurch zuschauen können.
 * - Vor/nach dem eigenen Mittag wird auf eine Zielverteilung hingearbeitet
 *   (Standard rund 60 % der Posten vormittags, also 7 von 12).
 *
 * Determinismus: gleiche Eingabe → gleiches Ergebnis (keine Zufallsquellen).
 */

import { formatZeit, parseZeit, ueberlappt } from "@/lib/zeit";
import {
  planeMittag,
  type MittagsfensterConfig,
  type MittagsWelle,
} from "@/lib/mittagsplanung";

// ─── Typen ───────────────────────────────────────────────────────────

export type GameInput = {
  id: string;
  name: string;
  /** 1 = Solo, 2 = Duell. */
  teamsProSlot: number;
  /** Wie oft jedes Team dieses Game absolviert (>= 1). */
  durchgaenge?: number;
  /** Personen der Posten-Crew — nur für die Mittagswellen relevant. */
  crewGroesse?: number;
};

export type TeamInput = {
  id: string;
  name: string;
  nummer: number;
  teilnehmerAnzahl?: number | null;
};

export type PauseInput = {
  nachRunde: number;
  dauerMin: number;
  name: string;
};

/**
 * Anti-Korrelation zweier Games (ungerichtetes Paar): Ein Team, das Game X
 * früh spielt, soll Game Y spät spielen — und umgekehrt. Gleicht den
 * Beobachtungsvorteil später Slots aus (z. B. Kisten stapeln ↔ Stack Attack).
 */
export type AntiKorrelationConfig = {
  gameXId: string;
  gameYId: string;
};

export type ScheduleConfig = {
  teams: TeamInput[];
  games: GameInput[];
  blockDauerMin: number;
  wechselzeitMin: number;
  /** Turnierstart. */
  startZeit: string;
  /** Spätestes Turnierende (Soll-Fenster) — überschreiten meldet die Engine. */
  fensterEndeZeit?: string | null;
  pausen: PauseInput[];
  mittagsfenster?: MittagsfensterConfig | null;
  /** Ziel: Posten vor der eigenen Mittagswelle. Standard ≈ 60 % aller Posten. */
  postenVormittag?: number | null;
  /** Helfer ohne Posten-Zuteilung, die mitessen. */
  freieHelfer?: { id: string; name: string }[];
  antiKorrelationen?: AntiKorrelationConfig[];
};

export type SlotOutput = {
  runde: number;
  startZeit: string;
  endZeit: string;
  gameId: string;
  gameName: string;
  teamIds: string[];
  teamNames: string[];
};

export type AntiKorrelationStatistik = {
  gameXId: string;
  gameXName: string;
  gameYId: string;
  gameYName: string;
  konformeTeams: number;
  verletzendeTeams: number;
};

export type TurnierFenster = {
  startZeit: string;
  /** Soll-Ende aus der Konfiguration; null = kein Fenster gesetzt. */
  endeSoll: string | null;
  /** Tatsächliches Ende des generierten Plans. */
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
  /** Posten vor der eigenen Mittagswelle, je Team. */
  postenVormittagProTeam: Record<string, number>;
  /** Längste Serie aufeinanderfolgender Einsätze, je Team. */
  laengsteSerieProTeam: Record<string, number>;
  antiKorrelation?: AntiKorrelationStatistik[];
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

// ─── Gewichte des Kandidaten-Scorings ────────────────────────────────
// Reihenfolge der Wirkung: Gegner-Wiederholung > Serien-Bremse >
// Anti-Korrelation > Vormittags-Ziel > Dringlichkeit (pro offenem Posten) >
// Pausen-Streuung > Bye-Ausgleich.

const GEGNER_WIEDERHOLUNG = 1000;
const SERIEN_MALUS = 400;
const POSTEN_WIEDERHOLUNG = 350;
const ANTI_KORRELATION_WEIGHT = 300;
const VORMITTAG_WEIGHT = 200;
const DRINGLICHKEIT_WEIGHT = 100;
const PAUSEN_WEIGHT = 60;

/** Ab dieser Anzahl Runden am Stück wird ein Team spürbar zurückgestellt. */
const MAX_SERIE = 4;

// ─── Hilfsfunktionen ─────────────────────────────────────────────────

function durchgaengeVon(game: GameInput): number {
  return Math.max(1, Math.floor(game.durchgaenge ?? 1));
}

/**
 * Untere Schranke für die Rundenzahl: Team-Bedarf, Posten-Durchsatz und
 * Gesamtkapazität — die grösste der drei Schranken bindet.
 */
export function theoretischesMinimum(
  anzahlTeams: number,
  games: readonly GameInput[],
): number {
  if (anzahlTeams === 0 || games.length === 0) return 0;

  const postenProTeam = games.reduce((s, g) => s + durchgaengeVon(g), 0);
  let proGame = 0;
  let kapazitaetProRunde = 0;
  for (const g of games) {
    const proSlot = Math.max(1, g.teamsProSlot);
    const besuche = anzahlTeams * durchgaengeVon(g);
    proGame = Math.max(proGame, Math.ceil(besuche / proSlot));
    kapazitaetProRunde += proSlot;
  }
  const gesamtBesuche = anzahlTeams * postenProTeam;
  const kapazitaetsSchranke =
    kapazitaetProRunde > 0 ? Math.ceil(gesamtBesuche / kapazitaetProRunde) : Infinity;

  return Math.max(postenProTeam, proGame, kapazitaetsSchranke, 1);
}

/** Startminute jeder Runde inkl. fixer Pausen — das Zeitraster des Tages. */
function rundenRaster(
  anzahl: number,
  startMin: number,
  taktMin: number,
  pausen: readonly PauseInput[],
): number[] {
  const pauseNach = new Map<number, number>();
  for (const p of pausen) {
    pauseNach.set(p.nachRunde, (pauseNach.get(p.nachRunde) ?? 0) + p.dauerMin);
  }
  const raster: number[] = [];
  let t = startMin;
  for (let r = 0; r < anzahl; r++) {
    raster.push(t);
    t += taktMin + (pauseNach.get(r + 1) ?? 0);
  }
  return raster;
}

// ─── Bipartites Matching ─────────────────────────────────────────────

function bipartiteMatching(
  adj: number[][],
  leftCount: number,
  rightCount: number,
  matchLeft: number[],
  matchRight: number[],
): number {
  matchLeft.fill(-1);
  matchRight.fill(-1);
  function augment(u: number, visited: boolean[]): boolean {
    for (const v of adj[u]) {
      if (visited[v]) continue;
      visited[v] = true;
      if (matchRight[v] === -1 || augment(matchRight[v], visited)) {
        matchLeft[u] = v;
        matchRight[v] = u;
        return true;
      }
    }
    return false;
  }
  let matching = 0;
  for (let u = 0; u < leftCount; u++) {
    const visited = new Array(rightCount).fill(false);
    if (augment(u, visited)) matching++;
  }
  return matching;
}

function canActivateDuellSubset(
  gameSubset: number[],
  availableTeams: Map<number, number[]>,
  N: number,
): boolean {
  const K = gameSubset.length;
  if (K === 0) return true;
  const leftCount = K * 2;
  const adj: number[][] = Array.from({ length: leftCount }, () => []);
  for (let i = 0; i < K; i++) {
    const teams = availableTeams.get(gameSubset[i]);
    if (!teams || teams.length < 2) return false;
    for (const t of teams) {
      adj[2 * i].push(t);
      adj[2 * i + 1].push(t);
    }
  }
  const matchLeft = new Array(leftCount).fill(-1);
  const matchRight = new Array(N).fill(-1);
  return bipartiteMatching(adj, leftCount, N, matchLeft, matchRight) === leftCount;
}

function generateCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const result: T[][] = [];
  function combine(start: number, current: T[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      combine(i + 1, current);
      current.pop();
    }
  }
  combine(0, []);
  return result;
}

function findDuellSubsetOfSize(
  targetSize: number,
  candidateGames: number[],
  availableTeams: Map<number, number[]>,
  N: number,
): number[] | null {
  if (targetSize === 0) return [];
  const maxSize = Math.min(targetSize, candidateGames.length);
  for (let size = maxSize; size >= 1; size--) {
    for (const subset of generateCombinations(candidateGames, size)) {
      if (canActivateDuellSubset(subset, availableTeams, N)) return subset;
    }
  }
  return null;
}

// ─── Optimale Duell-Anzahl ───────────────────────────────────────────

function computeOptimalDuellCount(
  N: number,
  activeSoloCount: number,
  activeDuellCount: number,
  maxSoloRemaining: number,
  maxDuellRemaining: number,
): number {
  if (activeDuellCount === 0) return 0;
  let bestD = 0;
  let bestRounds = Infinity;
  const maxPossibleD = Math.min(activeDuellCount, Math.floor(N / 2));

  for (let D = 0; D <= maxPossibleD; D++) {
    const teamsForSolos = N - 2 * D;
    let soloRounds: number;
    if (activeSoloCount === 0) {
      soloRounds = 0;
    } else if (teamsForSolos >= activeSoloCount) {
      soloRounds = maxSoloRemaining;
    } else if (teamsForSolos <= 0) {
      soloRounds = Infinity;
    } else {
      soloRounds = Math.ceil((maxSoloRemaining * activeSoloCount) / teamsForSolos);
    }

    let duellRounds: number;
    if (D === 0) {
      duellRounds = maxDuellRemaining > 0 ? Infinity : 0;
    } else {
      duellRounds = Math.ceil((activeDuellCount * Math.ceil(maxDuellRemaining / 2)) / D);
    }

    const totalRounds = Math.max(soloRounds, duellRounds);
    if (totalRounds < bestRounds) {
      bestRounds = totalRounds;
      bestD = D;
    }
  }
  return bestD;
}

// ─── Zuweisungs-Kontext ──────────────────────────────────────────────

type Kontext = {
  N: number;
  M: number;
  games: GameInput[];
  /** Offene Durchgänge je Team/Game. */
  offen: number[][];
  /** Offene Posten je Team (Summe über alle Games). */
  offenProTeam: number[];
  /** Erste Runde, in der Team t Game g gespielt hat; -1 = noch nicht. */
  ersteRunde: number[][];
  /** Letzte Runde, in der Team t Game g gespielt hat; -1 = noch nicht. */
  letzteRunde: number[][];
  /** Wunsch-Abstand zwischen zwei Durchgängen desselben Games, je Game. */
  mindestAbstand: number[];
  opponentCount: number[][];
  byeCount: number[];
  /** Runden am Stück mit Einsatz. */
  serie: number[];
  /** Runden seit dem letzten Einsatz. */
  leerlauf: number[];
  /** Bereits absolvierte Posten. */
  gespielt: number[];
  /** Erste Runde der eigenen Mittagswelle; Infinity = kein Mittag. */
  mittagsRunde: number[];
  /** Runde gesperrt (Mittagswelle) je Team. */
  teamGesperrt: boolean[][];
  /** Runde gesperrt (Posten-Pause) je Game. */
  postenGesperrt: boolean[][];
  antiPartners: number[][];
  estRounds: number;
  zielVormittag: number;
};

function antiKorrelationScore(t: number, g: number, r: number, ctx: Kontext): number {
  const partners = ctx.antiPartners[g];
  if (partners.length === 0) return 0;
  const horizont = Math.max(1, ctx.estRounds - 1);
  let score = 0;
  for (const p of partners) {
    const rP = ctx.ersteRunde[t][p];
    if (rP >= 0) {
      const abstand = Math.min(1, Math.abs(rP - r) / horizont);
      score += ANTI_KORRELATION_WEIGHT * (abstand - 0.5);
    } else if (r < ctx.estRounds / 2) {
      score += ANTI_KORRELATION_WEIGHT * 0.1;
    }
  }
  return score;
}

/**
 * Vormittags-Ziel: vor der eigenen Mittagswelle sollen rund `zielVormittag`
 * Posten erledigt sein. Wer schon durch ist, wird zurückgestellt; wer hinten
 * liegt, wird umso stärker bevorzugt, je näher die Welle rückt.
 */
function vormittagScore(t: number, r: number, ctx: Kontext): number {
  const cut = ctx.mittagsRunde[t];
  if (!Number.isFinite(cut) || r >= cut) return 0;
  const rest = ctx.zielVormittag - ctx.gespielt[t];
  if (rest <= 0) return -VORMITTAG_WEIGHT;
  const verbleibendeRunden = Math.max(1, cut - r);
  return VORMITTAG_WEIGHT * Math.min(1, rest / verbleibendeRunden);
}

/**
 * Zwei Durchgänge desselben Postens sollen über den Tag verteilt liegen —
 * direkt hintereinander wäre für die Teams ermüdend und für den Posten
 * langweilig. Der Malus verläuft linear bis zum Wunschabstand.
 */
function wiederholungScore(t: number, g: number, r: number, ctx: Kontext): number {
  const letzte = ctx.letzteRunde[t][g];
  if (letzte < 0) return 0;
  const abstand = r - letzte;
  const wunsch = ctx.mindestAbstand[g];
  if (abstand >= wunsch) return 0;
  return -POSTEN_WIEDERHOLUNG * (1 - abstand / wunsch);
}

/** Freirunden streuen: lange Serien bremsen, lange Leerläufe bevorzugen. */
function pausenScore(t: number, ctx: Kontext): number {
  const serie = ctx.serie[t];
  if (serie >= MAX_SERIE) return -SERIEN_MALUS;
  const leerlaufBonus = Math.min(1, ctx.leerlauf[t] / 3);
  const serienMalus = Math.min(1, serie / MAX_SERIE);
  return PAUSEN_WEIGHT * (leerlaufBonus - serienMalus);
}

/** Gesamtbewertung eines Teams für einen Posten in einer Runde. */
function teamScore(t: number, g: number, r: number, ctx: Kontext): number {
  return (
    ctx.offenProTeam[t] * DRINGLICHKEIT_WEIGHT +
    vormittagScore(t, r, ctx) +
    pausenScore(t, ctx) +
    wiederholungScore(t, g, r, ctx) +
    antiKorrelationScore(t, g, r, ctx) -
    ctx.byeCount[t]
  );
}

// ─── Kern: Rundenweise Zuweisung ─────────────────────────────────────

type RoundAssignment = { gameIdx: number; teamIdxs: number[] };

function assignRound(runde: number, ctx: Kontext): RoundAssignment[] {
  const { N, M, games, offen } = ctx;

  /** Distinkte Teams, die Game g noch brauchen und in dieser Runde dürfen. */
  const verfuegbar = new Map<number, number[]>();
  const besucheOffen = new Array(M).fill(0);
  const activeSoloIdxs: number[] = [];
  const activeDuellIdxs: number[] = [];
  const byeCandidates: { gameIdx: number; teamIdx: number }[] = [];

  for (let g = 0; g < M; g++) {
    if (ctx.postenGesperrt[g][runde]) continue;
    const teams: number[] = [];
    let besuche = 0;
    for (let t = 0; t < N; t++) {
      if (offen[t][g] > 0) {
        besuche += offen[t][g];
        if (!ctx.teamGesperrt[t][runde]) teams.push(t);
      }
    }
    if (besuche === 0) continue;
    besucheOffen[g] = besuche;
    if (games[g].teamsProSlot >= 2) {
      if (teams.length >= 2) {
        activeDuellIdxs.push(g);
        verfuegbar.set(g, teams);
      } else if (teams.length === 1) {
        byeCandidates.push({ gameIdx: g, teamIdx: teams[0] });
      }
    } else if (teams.length > 0) {
      activeSoloIdxs.push(g);
      verfuegbar.set(g, teams);
    }
  }

  let maxSoloRemaining = 0;
  for (const g of activeSoloIdxs) maxSoloRemaining = Math.max(maxSoloRemaining, besucheOffen[g]);
  let maxDuellRemaining = 0;
  for (const g of activeDuellIdxs) maxDuellRemaining = Math.max(maxDuellRemaining, besucheOffen[g]);

  // Für die Kapazitätsschätzung zählen nur Teams, die in dieser Runde
  // überhaupt dürfen — wer gerade isst, steht nicht zur Verfügung.
  let freieTeams = 0;
  for (let t = 0; t < N; t++) {
    if (ctx.offenProTeam[t] > 0 && !ctx.teamGesperrt[t][runde]) freieTeams++;
  }

  const optimalD = computeOptimalDuellCount(
    freieTeams,
    activeSoloIdxs.length,
    activeDuellIdxs.length,
    maxSoloRemaining,
    maxDuellRemaining,
  );

  for (let D = optimalD; D >= 0; D--) {
    const result = tryAssignment(
      D,
      activeDuellIdxs,
      activeSoloIdxs,
      verfuegbar,
      runde,
      ctx,
    );
    if (result !== null) {
      const belegt = new Set<number>();
      for (const a of result) for (const t of a.teamIdxs) belegt.add(t);
      for (const bye of byeCandidates) {
        if (!belegt.has(bye.teamIdx)) {
          result.push({ gameIdx: bye.gameIdx, teamIdxs: [bye.teamIdx] });
          belegt.add(bye.teamIdx);
        }
      }
      return result;
    }
  }

  const fallback: RoundAssignment[] = [];
  const belegt = new Set<number>();
  for (const bye of byeCandidates) {
    if (!belegt.has(bye.teamIdx)) {
      fallback.push({ gameIdx: bye.gameIdx, teamIdxs: [bye.teamIdx] });
      belegt.add(bye.teamIdx);
    }
  }
  return fallback;
}

/** Versucht eine Runde mit D Duellen. null = nicht alle Solos bedienbar. */
function tryAssignment(
  targetD: number,
  activeDuellIdxs: number[],
  activeSoloIdxs: number[],
  verfuegbar: Map<number, number[]>,
  runde: number,
  ctx: Kontext,
): RoundAssignment[] | null {
  const belegt = new Set<number>();
  const assignments: RoundAssignment[] = [];

  if (targetD > 0) {
    const subset = findDuellSubsetOfSize(targetD, activeDuellIdxs, verfuegbar, ctx.N);
    if (subset === null || subset.length === 0) return null;

    // Knappste Duells zuerst — sie haben die wenigsten Ausweichmöglichkeiten.
    subset.sort(
      (a, b) => (verfuegbar.get(a)?.length ?? 0) - (verfuegbar.get(b)?.length ?? 0),
    );

    for (const g of subset) {
      const frei = (verfuegbar.get(g) ?? []).filter((t) => !belegt.has(t));
      if (frei.length < 2) return null;

      const sortiert = [...frei].sort(
        (a, b) => teamScore(b, g, runde, ctx) - teamScore(a, g, runde, ctx),
      );
      const t1 = sortiert[0];

      let bestT2 = sortiert[1];
      let bestScore = -Infinity;
      for (let i = 1; i < sortiert.length; i++) {
        const t2 = sortiert[i];
        const score =
          -ctx.opponentCount[t1][t2] * GEGNER_WIEDERHOLUNG + teamScore(t2, g, runde, ctx);
        if (score > bestScore) {
          bestScore = score;
          bestT2 = t2;
        }
      }

      belegt.add(t1);
      belegt.add(bestT2);
      assignments.push({ gameIdx: g, teamIdxs: [t1, bestT2] });
    }
  }

  // Solos über bipartites Matching: greedy kann sich selbst blockieren, wenn
  // ein Team von mehreren Solos gebraucht wird.
  const solos = [...activeSoloIdxs].sort(
    (a, b) => (verfuegbar.get(a)?.length ?? 0) - (verfuegbar.get(b)?.length ?? 0),
  );

  if (solos.length > 0) {
    const adj: number[][] = solos.map((g) => {
      const kandidaten = (verfuegbar.get(g) ?? [])
        .filter((t) => !belegt.has(t))
        .map((t) => ({ t, score: teamScore(t, g, runde, ctx) }));
      kandidaten.sort((a, b) => b.score - a.score);
      return kandidaten.map((k) => k.t);
    });

    const matchLeft = new Array(solos.length).fill(-1);
    const matchRight = new Array(ctx.N).fill(-1);
    const matched = bipartiteMatching(adj, solos.length, ctx.N, matchLeft, matchRight);

    // Solos sind der Engpass: was bedienbar ist, muss bedient werden. Bleibt
    // ein bedienbares Solo leer, kostet das eine ganze Runde — dann lieber ein
    // Duell weniger (nächste Stufe der Fallback-Kaskade). Solos ohne jeden
    // Kandidaten (alle Teams essen gerade) sind davon ausgenommen.
    const bedienbar = adj.filter((kandidaten) => kandidaten.length > 0).length;
    if (matched < bedienbar) return null;
    if (matched === 0 && assignments.length === 0) return null;

    for (let i = 0; i < solos.length; i++) {
      const t = matchLeft[i];
      if (t === -1) continue;
      belegt.add(t);
      assignments.push({ gameIdx: solos[i], teamIdxs: [t] });
    }
  }

  return assignments;
}

// ─── Mittagswellen auf das Rundenraster legen ────────────────────────

type MittagsSperren = {
  wellen: MittagsWelle[];
  teamGesperrt: boolean[][];
  postenGesperrt: boolean[][];
  mittagsRunde: number[];
  hinweise: string[];
};

function leereSperren(N: number, M: number, runden: number): MittagsSperren {
  return {
    wellen: [],
    teamGesperrt: Array.from({ length: N }, () => new Array(runden).fill(false)),
    postenGesperrt: Array.from({ length: M }, () => new Array(runden).fill(false)),
    mittagsRunde: new Array(N).fill(Infinity),
    hinweise: [],
  };
}

/**
 * Übersetzt die Mittagswellen in Runden-Sperren: Wer isst, wird in den
 * überlappenden Runden nicht eingeteilt — Teams nicht als Spieler, Posten
 * nicht als Station (damit die Crew mitessen kann).
 */
function baueMittagsSperren(
  config: ScheduleConfig,
  raster: number[],
  blockDauerMin: number,
): MittagsSperren {
  const N = config.teams.length;
  const M = config.games.length;
  const leer = leereSperren(N, M, raster.length);
  if (!config.mittagsfenster) return leer;

  const plan = planeMittag({
    fenster: config.mittagsfenster,
    teams: config.teams.map((t) => ({
      id: t.id,
      name: t.name,
      teilnehmerAnzahl: t.teilnehmerAnzahl,
    })),
    posten: config.games.map((g) => ({
      id: g.id,
      name: g.name,
      crewGroesse: Math.max(0, g.crewGroesse ?? 0),
    })),
    freieHelfer: config.freieHelfer ?? [],
  });

  if (plan.wellen.length === 0) {
    return { ...leer, hinweise: plan.hinweise };
  }

  const teamIdx = new Map(config.teams.map((t, i) => [t.id, i] as const));
  const gameIdx = new Map(config.games.map((g, i) => [g.id, i] as const));

  const sperren: MittagsSperren = {
    wellen: plan.wellen,
    teamGesperrt: Array.from({ length: N }, () => new Array(raster.length).fill(false)),
    postenGesperrt: Array.from({ length: M }, () => new Array(raster.length).fill(false)),
    mittagsRunde: new Array(N).fill(Infinity),
    hinweise: [...plan.hinweise],
  };

  const ohneRunde: string[] = [];

  for (const welle of plan.wellen) {
    const betroffeneRunden: number[] = [];
    for (let r = 0; r < raster.length; r++) {
      if (ueberlappt(raster[r], raster[r] + blockDauerMin, welle.startMin, welle.endeMin)) {
        betroffeneRunden.push(r);
      }
    }
    if (betroffeneRunden.length === 0) {
      ohneRunde.push(`${welle.startZeit}–${welle.endZeit}`);
      continue;
    }
    for (const id of welle.teamIds) {
      const t = teamIdx.get(id);
      if (t === undefined) continue;
      for (const r of betroffeneRunden) sperren.teamGesperrt[t][r] = true;
      sperren.mittagsRunde[t] = betroffeneRunden[0];
    }
    for (const id of welle.postenIds) {
      const g = gameIdx.get(id);
      if (g === undefined) continue;
      for (const r of betroffeneRunden) sperren.postenGesperrt[g][r] = true;
    }
  }

  if (ohneRunde.length > 0) {
    sperren.hinweise.push(
      `WARN: ${ohneRunde.length} Mittagswelle(n) liegen ausserhalb des Spielbetriebs ` +
        `(${ohneRunde.join(", ")}) — Turnierstart, Takt oder Mittagsfenster passen nicht zusammen.`,
    );
  }

  return sperren;
}

// ─── Hauptfunktion ───────────────────────────────────────────────────

export function generateSchedule(config: ScheduleConfig): ScheduleResult {
  const {
    teams,
    games,
    blockDauerMin,
    wechselzeitMin,
    startZeit,
    fensterEndeZeit,
    pausen,
    antiKorrelationen,
  } = config;

  const N = teams.length;
  const M = games.length;

  if (N === 0 || M === 0) {
    return {
      slots: [],
      runden: 0,
      endZeit: startZeit,
      konflikte: N === 0 ? ["Keine Teams vorhanden"] : ["Keine Games vorhanden"],
      teamZeitplaene: {},
    };
  }

  const takt = blockDauerMin + wechselzeitMin;
  const startMin = parseZeit(startZeit);
  const postenProTeam = games.reduce((s, g) => s + durchgaengeVon(g), 0);
  const estRounds = theoretischesMinimum(N, games);
  // Reserve für Mittagssperren und Bye-Runden; die Schleife bricht ab, sobald
  // nichts mehr offen ist.
  const maxRunden = Math.max(estRounds + N + M + 20, postenProTeam + 20);
  const raster = rundenRaster(maxRunden, startMin, takt, pausen);

  const konflikte: string[] = [];

  // ── Anti-Korrelations-Paare auflösen ──
  const gameIdxById = new Map(games.map((g, i) => [g.id, i] as const));
  const antiPartners: number[][] = Array.from({ length: M }, () => []);
  const antiPairs: { x: number; y: number }[] = [];
  for (const paar of antiKorrelationen ?? []) {
    const x = gameIdxById.get(paar.gameXId);
    const y = gameIdxById.get(paar.gameYId);
    if (x === undefined || y === undefined) {
      konflikte.push(
        `WARN: Anti-Korrelation ignoriert – unbekannte Game-ID (${paar.gameXId} / ${paar.gameYId})`,
      );
      continue;
    }
    if (x === y) {
      konflikte.push(
        `WARN: Anti-Korrelation ignoriert – "${games[x].name}" ist mit sich selbst verknüpft`,
      );
      continue;
    }
    antiPairs.push({ x, y });
    antiPartners[x].push(y);
    antiPartners[y].push(x);
  }

  // ── Mittagswellen und die daraus folgenden Sperren ──
  const mittag = baueMittagsSperren(config, raster, blockDauerMin);
  konflikte.push(...mittag.hinweise);

  const zielVormittag = Math.min(
    Math.max(1, config.postenVormittag ?? Math.round(postenProTeam * 0.6)),
    postenProTeam,
  );

  const ctx: Kontext = {
    N,
    M,
    games,
    offen: Array.from({ length: N }, () => games.map((g) => durchgaengeVon(g))),
    offenProTeam: new Array(N).fill(postenProTeam),
    ersteRunde: Array.from({ length: N }, () => new Array(M).fill(-1)),
    letzteRunde: Array.from({ length: N }, () => new Array(M).fill(-1)),
    mindestAbstand: games.map((g) =>
      Math.max(2, Math.floor(estRounds / (durchgaengeVon(g) + 1))),
    ),
    opponentCount: Array.from({ length: N }, () => new Array(N).fill(0)),
    byeCount: new Array(N).fill(0),
    serie: new Array(N).fill(0),
    leerlauf: new Array(N).fill(0),
    gespielt: new Array(N).fill(0),
    mittagsRunde: mittag.mittagsRunde,
    teamGesperrt: mittag.teamGesperrt,
    postenGesperrt: mittag.postenGesperrt,
    antiPartners,
    estRounds,
    zielVormittag,
  };

  // ── Runden zuweisen ──
  const allRounds: RoundAssignment[][] = [];
  let leereRunden = 0;

  for (let r = 0; r < maxRunden; r++) {
    if (ctx.offenProTeam.every((o) => o === 0)) break;

    const zuweisungen = assignRound(r, ctx);

    if (zuweisungen.length === 0) {
      const gesperrt =
        ctx.teamGesperrt.some((z) => z[r]) || ctx.postenGesperrt.some((z) => z[r]);
      // Ohne Sperre gibt es keinen Grund, warum die nächste Runde besser
      // laufen sollte — dann ist der Plan nicht auflösbar.
      if (!gesperrt && ++leereRunden >= 2) break;
      allRounds.push([]);
      continue;
    }
    leereRunden = 0;

    const eingesetzt = new Set<number>();
    for (const a of zuweisungen) {
      for (const t of a.teamIdxs) {
        ctx.offen[t][a.gameIdx]--;
        ctx.offenProTeam[t]--;
        ctx.gespielt[t]++;
        if (ctx.ersteRunde[t][a.gameIdx] < 0) ctx.ersteRunde[t][a.gameIdx] = r;
        ctx.letzteRunde[t][a.gameIdx] = r;
        eingesetzt.add(t);
      }
      if (games[a.gameIdx].teamsProSlot >= 2 && a.teamIdxs.length === 2) {
        const [t1, t2] = a.teamIdxs;
        ctx.opponentCount[t1][t2]++;
        ctx.opponentCount[t2][t1]++;
      }
    }

    for (let t = 0; t < N; t++) {
      if (eingesetzt.has(t)) {
        ctx.serie[t]++;
        ctx.leerlauf[t] = 0;
      } else {
        ctx.serie[t] = 0;
        ctx.leerlauf[t]++;
        // Mittagswellen zählen nicht als verpasste Runde.
        if (ctx.offenProTeam[t] > 0 && !ctx.teamGesperrt[t][r]) ctx.byeCount[t]++;
      }
    }

    allRounds.push(zuweisungen);
  }

  // Leerlaufende Runden am Schluss abschneiden.
  while (allRounds.length > 0 && allRounds[allRounds.length - 1].length === 0) {
    allRounds.pop();
  }

  // ── Zeitslots bauen ──
  // Der wievielte Durchgang ein Slot für ein Team ist, hängt am Team (bei
  // Duellen können die beiden Teams unterschiedlich weit sein) — er wird
  // deshalb dort gezählt, wo er angezeigt wird, nicht am Slot gespeichert.
  const slots: SlotOutput[] = [];
  for (let r = 0; r < allRounds.length; r++) {
    const start = raster[r];
    const ende = start + blockDauerMin;
    for (const a of allRounds[r]) {
      const game = games[a.gameIdx];
      slots.push({
        runde: r + 1,
        startZeit: formatZeit(start),
        endZeit: formatZeit(ende),
        gameId: game.id,
        gameName: game.name,
        teamIds: a.teamIdxs.map((t) => teams[t].id),
        teamNames: a.teamIdxs.map((t) => teams[t].name),
      });
    }
  }

  const endeMin =
    allRounds.length > 0 ? raster[allRounds.length - 1] + blockDauerMin : startMin;
  const endZeit = formatZeit(endeMin);

  // ── Validierung ──
  for (let t = 0; t < N; t++) {
    for (let g = 0; g < M; g++) {
      if (ctx.offen[t][g] > 0) {
        konflikte.push(
          `HART: ${teams[t].name} fehlen ${ctx.offen[t][g]} Durchgang/Durchgänge bei "${games[g].name}"`,
        );
      }
    }
  }
  for (let r = 0; r < allRounds.length; r++) {
    const teamsGesehen = new Set<number>();
    const gamesGesehen = new Set<number>();
    for (const a of allRounds[r]) {
      if (gamesGesehen.has(a.gameIdx)) {
        konflikte.push(`HART: "${games[a.gameIdx].name}" in Runde ${r + 1} doppelt`);
      }
      gamesGesehen.add(a.gameIdx);
      for (const t of a.teamIdxs) {
        if (teamsGesehen.has(t)) {
          konflikte.push(`HART: ${teams[t].name} in Runde ${r + 1} doppelt`);
        }
        teamsGesehen.add(t);
      }
    }
  }

  // ── Anti-Korrelation als weiche Warnung ──
  const istFrueh = (r: number) => r < allRounds.length / 2;
  for (const { x, y } of antiPairs) {
    for (let t = 0; t < N; t++) {
      const rx = ctx.ersteRunde[t][x];
      const ry = ctx.ersteRunde[t][y];
      if (rx < 0 || ry < 0) continue;
      if (istFrueh(rx) === istFrueh(ry)) {
        konflikte.push(
          `WARN: ${teams[t].name} hat "${games[x].name}" (Runde ${rx + 1}) und "${games[y].name}" (Runde ${ry + 1}) beide ${istFrueh(rx) ? "früh" : "spät"}`,
        );
      }
    }
  }

  // ── Turnierfenster prüfen ──
  const endeSollMin = fensterEndeZeit ? parseZeit(fensterEndeZeit) : NaN;
  const hatFenster = Number.isFinite(endeSollMin);
  const ueberzugMin = hatFenster ? Math.max(0, endeMin - endeSollMin) : 0;
  if (hatFenster && ueberzugMin > 0) {
    konflikte.push(
      `WARN: Der Plan endet um ${endZeit} und überzieht das Turnierfenster (bis ${fensterEndeZeit}) um ${ueberzugMin} min. ` +
        `Blockdauer oder Wechselzeit kürzen, Durchgänge reduzieren oder das Fenster erweitern.`,
    );
  }

  // ── Team-Zeitpläne und Statistiken ──
  const teamZeitplaene: Record<string, SlotOutput[]> = {};
  for (const team of teams) {
    teamZeitplaene[team.id] = slots
      .filter((s) => s.teamIds.includes(team.id))
      .sort((a, b) => a.runde - b.runde);
  }

  const freirundenProTeam: Record<string, number> = {};
  const teamAuslastung: Record<string, number> = {};
  const postenVormittagProTeam: Record<string, number> = {};
  const laengsteSerieProTeam: Record<string, number> = {};

  for (let t = 0; t < N; t++) {
    const id = teams[t].id;
    const eigene = teamZeitplaene[id] ?? [];
    freirundenProTeam[id] = allRounds.length - eigene.length;
    teamAuslastung[id] = allRounds.length > 0 ? eigene.length / allRounds.length : 0;

    const cut = ctx.mittagsRunde[t];
    postenVormittagProTeam[id] = Number.isFinite(cut)
      ? eigene.filter((s) => s.runde - 1 < cut).length
      : eigene.length;

    let serie = 0;
    let maxSerie = 0;
    let letzte = -2;
    for (const s of eigene) {
      serie = s.runde - 1 === letzte + 1 ? serie + 1 : 1;
      letzte = s.runde - 1;
      maxSerie = Math.max(maxSerie, serie);
    }
    laengsteSerieProTeam[id] = maxSerie;
  }

  const duellGegnerVerteilung: Record<string, Record<string, number>> = {};
  for (let t1 = 0; t1 < N; t1++) {
    const gegner: Record<string, number> = {};
    for (let t2 = 0; t2 < N; t2++) {
      if (t1 !== t2 && ctx.opponentCount[t1][t2] > 0) {
        gegner[teams[t2].id] = ctx.opponentCount[t1][t2];
      }
    }
    if (Object.keys(gegner).length > 0) duellGegnerVerteilung[teams[t1].id] = gegner;
  }

  const kapazitaetProRunde = games.reduce((s, g) => s + Math.max(1, g.teamsProSlot), 0);
  const maxMoeglich = allRounds.length * Math.min(N, kapazitaetProRunde);

  let antiKorrelation: AntiKorrelationStatistik[] | undefined;
  if (antiPairs.length > 0) {
    antiKorrelation = antiPairs.map(({ x, y }) => {
      let konformeTeams = 0;
      let verletzendeTeams = 0;
      for (let t = 0; t < N; t++) {
        const rx = ctx.ersteRunde[t][x];
        const ry = ctx.ersteRunde[t][y];
        if (rx < 0 || ry < 0) continue;
        if (istFrueh(rx) === istFrueh(ry)) verletzendeTeams++;
        else konformeTeams++;
      }
      return {
        gameXId: games[x].id,
        gameXName: games[x].name,
        gameYId: games[y].id,
        gameYName: games[y].name,
        konformeTeams,
        verletzendeTeams,
      };
    });
  }

  return {
    slots,
    runden: allRounds.length,
    endZeit,
    konflikte,
    teamZeitplaene,
    statistiken: {
      freirundenProTeam,
      duellGegnerVerteilung,
      rundenEffizienz: maxMoeglich > 0 ? (N * postenProTeam) / maxMoeglich : 0,
      teamAuslastung,
      theoretischesMinimum: estRounds,
      postenProTeam,
      postenVormittagProTeam,
      laengsteSerieProTeam,
      antiKorrelation,
    },
    mittagsWellen: mittag.wellen.length > 0 ? mittag.wellen : undefined,
    fenster: {
      startZeit,
      endeSoll: fensterEndeZeit ?? null,
      endeIst: endZeit,
      passt: !hatFenster || ueberzugMin === 0,
      ueberzugMin,
    },
  };
}
