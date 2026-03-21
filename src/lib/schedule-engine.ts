/**
 * Zeitplan-Engine v2: Adaptive Priority-Matching
 *
 * Löst das Constraint-Satisfaction-Problem für den Postenlauf:
 * - N Teams rotieren durch M Stationen (Solo + Duell)
 * - Jedes Team spielt jedes Game genau 1×
 * - Kein Team doppelt pro Runde, keine Station doppelt pro Runde
 *
 * Algorithmus:
 * 1. Dynamische Duell-Kapazitätsberechnung (Solo-Schutz)
 * 2. Bipartites Matching für Duell-Aktivierung
 * 3. Fallback-Kaskade bei Konflikten
 * 4. Byes (ungerade Teams) erst nach regulärer Zuweisung
 * 5. Scoring für Gegner-Diversität, Bye-Balance, Dringlichkeit
 *
 * Determinismus: Gleiche Eingabe → gleiches Ergebnis
 */

// ─── Typen ───────────────────────────────────────────────────────────

export type GameInput = {
  id: string;
  name: string;
  teamsProSlot: number; // 1 = Solo, 2 = Duell
};

export type PauseInput = {
  nachRunde: number;
  dauerMin: number;
  name: string;
};

export type ScheduleConfig = {
  teams: { id: string; name: string; nummer: number }[];
  games: GameInput[];
  blockDauerMin: number;
  wechselzeitMin: number;
  startZeit: string;
  pausen: PauseInput[];
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

export type ScheduleStatistiken = {
  freirundenProTeam: Record<string, number>;
  duellGegnerVerteilung: Record<string, Record<string, number>>;
  rundenEffizienz: number;
  teamAuslastung: Record<string, number>;
  theoretischesMinimum: number;
};

export type ScheduleResult = {
  slots: SlotOutput[];
  runden: number;
  endZeit: string;
  konflikte: string[];
  teamZeitplaene: Record<string, SlotOutput[]>;
  statistiken?: ScheduleStatistiken;
};

// ─── Hilfsfunktionen ─────────────────────────────────────────────────

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function theoretischesMinimum(N: number, soloCount: number, duellCount: number): number {
  if (soloCount === 0 && duellCount === 0) return 0;
  const soloMin = soloCount > 0 ? N : 0;
  const duellMin = duellCount > 0 ? Math.ceil(N / 2) : 0;
  const optD = Math.min(duellCount, Math.floor(Math.max(0, N - soloCount) / 2));
  const effectiveCap = Math.min(soloCount, N) + optD * 2;
  const totalAssignments = N * (soloCount + duellCount);
  const capacityMin = effectiveCap > 0 ? Math.ceil(totalAssignments / effectiveCap) : Infinity;
  const duellScheduleMin = optD > 0
    ? Math.ceil(duellCount * Math.ceil(N / 2) / optD)
    : (duellCount > 0 ? Infinity : 0);
  return Math.max(soloMin, duellMin, capacityMin, duellScheduleMin, 1);
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
    if (current.length === k) { result.push([...current]); return; }
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
    const subsets = generateCombinations(candidateGames, size);
    for (const subset of subsets) {
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
      soloRounds = Math.ceil(maxSoloRemaining * activeSoloCount / teamsForSolos);
    }

    let duellRounds: number;
    if (D === 0) {
      duellRounds = maxDuellRemaining > 0 ? Infinity : 0;
    } else {
      const totalDuellRoundsNeeded = activeDuellCount * Math.ceil(maxDuellRemaining / 2);
      duellRounds = Math.ceil(totalDuellRoundsNeeded / D);
    }

    const totalRounds = Math.max(soloRounds, duellRounds);
    if (totalRounds < bestRounds) {
      bestRounds = totalRounds;
      bestD = D;
    }
  }
  return bestD;
}

// ─── Kern: Rundenweise Zuweisung ─────────────────────────────────────

type RoundAssignment = { gameIdx: number; teamIdxs: number[] };

/**
 * Weist eine Runde zu. Gibt Zuweisungen zurück (modifiziert needed NICHT).
 */
function assignRound(
  needed: boolean[][],
  games: GameInput[],
  N: number,
  M: number,
  opponentCount: number[][],
  teamByeCount: number[],
): RoundAssignment[] {
  const teamUrgency = new Array(N).fill(0);
  for (let t = 0; t < N; t++) {
    for (let g = 0; g < M; g++) {
      if (needed[t][g]) teamUrgency[t]++;
    }
  }

  const gameTeamsLeft = new Array(M).fill(0);
  for (let g = 0; g < M; g++) {
    for (let t = 0; t < N; t++) {
      if (needed[t][g]) gameTeamsLeft[g]++;
    }
  }

  // Aktive Games kategorisieren
  const activeSoloIdxs: number[] = [];
  const activeDuellIdxs: number[] = [];
  const duellAvailable = new Map<number, number[]>();
  // Duell-Games mit genau 1 verbleibendem Team → Bye-Kandidaten
  const byeCandidates: { gameIdx: number; teamIdx: number }[] = [];

  for (let g = 0; g < M; g++) {
    if (gameTeamsLeft[g] === 0) continue;
    if (games[g].teamsProSlot >= 2) {
      const available: number[] = [];
      for (let t = 0; t < N; t++) {
        if (needed[t][g]) available.push(t);
      }
      if (available.length >= 2) {
        activeDuellIdxs.push(g);
        duellAvailable.set(g, available);
      } else if (available.length === 1) {
        byeCandidates.push({ gameIdx: g, teamIdx: available[0] });
      }
    } else {
      activeSoloIdxs.push(g);
    }
  }

  // Optimale Duell-Anzahl berechnen
  let maxSoloRemaining = 0;
  for (const g of activeSoloIdxs) {
    if (gameTeamsLeft[g] > maxSoloRemaining) maxSoloRemaining = gameTeamsLeft[g];
  }
  let maxDuellRemaining = 0;
  for (const g of activeDuellIdxs) {
    if (gameTeamsLeft[g] > maxDuellRemaining) maxDuellRemaining = gameTeamsLeft[g];
  }

  const optimalD = computeOptimalDuellCount(
    N, activeSoloIdxs.length, activeDuellIdxs.length,
    maxSoloRemaining, maxDuellRemaining,
  );

  // Fallback-Kaskade: D von optimal runter bis 0
  for (let D = optimalD; D >= 0; D--) {
    const result = tryAssignment(
      D, activeDuellIdxs, activeSoloIdxs, duellAvailable,
      needed, games, N, M, opponentCount, teamByeCount, teamUrgency, gameTeamsLeft,
    );
    if (result !== null) {
      // Byes für freie Teams anhängen
      const usedTeams = new Set<number>();
      for (const a of result) {
        for (const t of a.teamIdxs) usedTeams.add(t);
      }
      for (const bye of byeCandidates) {
        if (!usedTeams.has(bye.teamIdx)) {
          result.push({ gameIdx: bye.gameIdx, teamIdxs: [bye.teamIdx] });
          usedTeams.add(bye.teamIdx);
        }
      }
      return result;
    }
  }

  // Absoluter Fallback: nur Byes (wenn überhaupt möglich)
  const fallback: RoundAssignment[] = [];
  const usedTeams = new Set<number>();
  for (const bye of byeCandidates) {
    if (!usedTeams.has(bye.teamIdx)) {
      fallback.push({ gameIdx: bye.gameIdx, teamIdxs: [bye.teamIdx] });
      usedTeams.add(bye.teamIdx);
    }
  }
  return fallback;
}

/**
 * Versucht Zuweisung mit D Duells. Gibt null zurück wenn nicht alle Solos bedienbar.
 */
function tryAssignment(
  targetD: number,
  activeDuellIdxs: number[],
  activeSoloIdxs: number[],
  duellAvailable: Map<number, number[]>,
  needed: boolean[][],
  games: GameInput[],
  N: number,
  _M: number,
  opponentCount: number[][],
  teamByeCount: number[],
  teamUrgency: number[],
  gameTeamsLeft: number[],
): RoundAssignment[] | null {
  const usedTeams = new Set<number>();
  const assignments: RoundAssignment[] = [];

  // ── Duell-Zuweisung ──
  if (targetD > 0) {
    const duellSubset = findDuellSubsetOfSize(targetD, activeDuellIdxs, duellAvailable, N);
    if (duellSubset === null || duellSubset.length === 0) return targetD === 0 ? null : null;

    // Sortiere nach Knappheit
    duellSubset.sort((a, b) =>
      (duellAvailable.get(a)?.length ?? 0) - (duellAvailable.get(b)?.length ?? 0)
    );

    for (const g of duellSubset) {
      const available = (duellAvailable.get(g) ?? []).filter(t => !usedTeams.has(t));
      if (available.length < 2) return null;

      available.sort((a, b) => {
        const d = teamUrgency[b] - teamUrgency[a];
        return d !== 0 ? d : teamByeCount[a] - teamByeCount[b];
      });

      const t1 = available[0];
      let bestT2 = available[1];
      let bestScore = -Infinity;
      for (let i = 1; i < available.length; i++) {
        const t2 = available[i];
        const score = -opponentCount[t1][t2] * 1000 + teamUrgency[t2] * 10 - teamByeCount[t2] * 5;
        if (score > bestScore) { bestScore = score; bestT2 = t2; }
      }

      usedTeams.add(t1);
      usedTeams.add(bestT2);
      assignments.push({ gameIdx: g, teamIdxs: [t1, bestT2] });
    }
  }

  // ── Solo-Zuweisung via Bipartites Matching ──
  // Greedy-Zuweisung kann sich selbst blockieren wenn ein Team von mehreren
  // Solos gebraucht wird. Bipartites Matching findet die optimale Verteilung.
  const sortedSolos = [...activeSoloIdxs].sort((a, b) => gameTeamsLeft[a] - gameTeamsLeft[b]);

  if (sortedSolos.length > 0) {
    const soloAdj: number[][] = Array.from({ length: sortedSolos.length }, () => []);
    for (let i = 0; i < sortedSolos.length; i++) {
      const g = sortedSolos[i];
      // Kanten nach Dringlichkeit sortiert (Matching bevorzugt frühere Kanten)
      const candidates: { t: number; score: number }[] = [];
      for (let t = 0; t < N; t++) {
        if (needed[t][g] && !usedTeams.has(t)) {
          candidates.push({ t, score: teamUrgency[t] * 100 - teamByeCount[t] });
        }
      }
      candidates.sort((a, b) => b.score - a.score);
      for (const c of candidates) soloAdj[i].push(c.t);
    }

    const soloMatchLeft = new Array(sortedSolos.length).fill(-1);
    const soloMatchRight = new Array(N).fill(-1);
    const matched = bipartiteMatching(soloAdj, sortedSolos.length, N, soloMatchLeft, soloMatchRight);

    if (matched < sortedSolos.length) {
      // Nicht alle Solos bedienbar mit dieser Duell-Konfiguration → Fallback
      return null;
    }

    for (let i = 0; i < sortedSolos.length; i++) {
      const g = sortedSolos[i];
      const t = soloMatchLeft[i];
      usedTeams.add(t);
      assignments.push({ gameIdx: g, teamIdxs: [t] });
    }
  }

  return assignments;
}

// ─── Hauptfunktion ───────────────────────────────────────────────────

export function generateSchedule(config: ScheduleConfig): ScheduleResult {
  const { teams, games, blockDauerMin, wechselzeitMin, startZeit, pausen } = config;
  const N = teams.length;
  const M = games.length;

  if (N === 0 || M === 0) {
    return {
      slots: [], runden: 0, endZeit: startZeit,
      konflikte: N === 0 ? ["Keine Teams vorhanden"] : ["Keine Games vorhanden"],
      teamZeitplaene: {},
    };
  }

  const soloCount = games.filter(g => g.teamsProSlot === 1).length;
  const duellCount = games.filter(g => g.teamsProSlot >= 2).length;

  const needed: boolean[][] = Array.from({ length: N }, () => new Array(M).fill(true));
  const opponentCount: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  const teamByeCount = new Array(N).fill(0);

  const allRounds: RoundAssignment[][] = [];
  const MAX_ROUNDS = N + M + 20;

  for (let r = 0; r < MAX_ROUNDS; r++) {
    let remaining = 0;
    for (let t = 0; t < N; t++) {
      for (let g = 0; g < M; g++) {
        if (needed[t][g]) remaining++;
      }
    }
    if (remaining === 0) break;

    const roundResult = assignRound(needed, games, N, M, opponentCount, teamByeCount);
    if (roundResult.length === 0) break;

    // Zuweisungen anwenden
    for (const a of roundResult) {
      for (const t of a.teamIdxs) {
        needed[t][a.gameIdx] = false;
      }
      // Gegner-Tracking
      if (games[a.gameIdx].teamsProSlot >= 2 && a.teamIdxs.length === 2) {
        const [t1, t2] = a.teamIdxs;
        opponentCount[t1][t2]++;
        opponentCount[t2][t1]++;
      }
    }

    // Bye-Tracking
    const usedThisRound = new Set<number>();
    for (const a of roundResult) {
      for (const t of a.teamIdxs) usedThisRound.add(t);
    }
    for (let t = 0; t < N; t++) {
      let hasRemaining = false;
      for (let g = 0; g < M; g++) {
        if (needed[t][g]) { hasRemaining = true; break; }
      }
      if (hasRemaining && !usedThisRound.has(t)) teamByeCount[t]++;
    }

    allRounds.push(roundResult);
  }

  // ── Validierung ──
  const konflikte: string[] = [];
  for (let t = 0; t < N; t++) {
    for (let g = 0; g < M; g++) {
      if (needed[t][g]) {
        konflikte.push(`HART: ${teams[t].name} hat "${games[g].name}" nicht zugeteilt bekommen`);
      }
    }
  }
  for (let r = 0; r < allRounds.length; r++) {
    const seen = new Set<number>();
    for (const a of allRounds[r]) {
      for (const t of a.teamIdxs) {
        if (seen.has(t)) konflikte.push(`HART: ${teams[t].name} in Runde ${r + 1} doppelt`);
        seen.add(t);
      }
    }
  }
  for (let r = 0; r < allRounds.length; r++) {
    const seen = new Set<number>();
    for (const a of allRounds[r]) {
      if (seen.has(a.gameIdx)) konflikte.push(`HART: "${games[a.gameIdx].name}" in Runde ${r + 1} doppelt`);
      seen.add(a.gameIdx);
    }
  }

  // ── Zeitslots ──
  const slots: SlotOutput[] = [];
  let currentTime = parseTime(startZeit);
  const pauseMap = new Map(pausen.map(p => [p.nachRunde, p]));

  for (let r = 0; r < allRounds.length; r++) {
    const roundNum = r + 1;
    const roundStart = currentTime;
    const roundEnd = currentTime + blockDauerMin;
    for (const a of allRounds[r]) {
      const game = games[a.gameIdx];
      slots.push({
        runde: roundNum,
        startZeit: formatTime(roundStart),
        endZeit: formatTime(roundEnd),
        gameId: game.id, gameName: game.name,
        teamIds: a.teamIdxs.map(t => teams[t].id),
        teamNames: a.teamIdxs.map(t => teams[t].name),
      });
    }
    currentTime = roundEnd + wechselzeitMin;
    const pause = pauseMap.get(roundNum);
    if (pause) currentTime += pause.dauerMin;
  }

  // ── Team-Zeitpläne ──
  const teamZeitplaene: Record<string, SlotOutput[]> = {};
  for (const team of teams) {
    teamZeitplaene[team.id] = slots
      .filter(s => s.teamIds.includes(team.id))
      .sort((a, b) => a.runde - b.runde);
  }

  // ── Statistiken ──
  const freirundenProTeam: Record<string, number> = {};
  for (let t = 0; t < N; t++) {
    freirundenProTeam[teams[t].id] = allRounds.length - (teamZeitplaene[teams[t].id]?.length ?? 0);
  }

  const duellGegnerVerteilung: Record<string, Record<string, number>> = {};
  for (let t1 = 0; t1 < N; t1++) {
    const gegner: Record<string, number> = {};
    for (let t2 = 0; t2 < N; t2++) {
      if (t1 !== t2 && opponentCount[t1][t2] > 0) gegner[teams[t2].id] = opponentCount[t1][t2];
    }
    if (Object.keys(gegner).length > 0) duellGegnerVerteilung[teams[t1].id] = gegner;
  }

  const totalAssignments = N * M;
  const capPerRound = soloCount + duellCount * 2;
  const maxPossible = allRounds.length * Math.min(N, capPerRound);

  const teamAuslastung: Record<string, number> = {};
  for (let t = 0; t < N; t++) {
    teamAuslastung[teams[t].id] = allRounds.length > 0
      ? (teamZeitplaene[teams[t].id]?.length ?? 0) / allRounds.length : 0;
  }

  return {
    slots,
    runden: allRounds.length,
    endZeit: formatTime(currentTime - wechselzeitMin),
    konflikte,
    teamZeitplaene,
    statistiken: {
      freirundenProTeam,
      duellGegnerVerteilung,
      rundenEffizienz: maxPossible > 0 ? totalAssignments / maxPossible : 0,
      teamAuslastung,
      theoretischesMinimum: theoretischesMinimum(N, soloCount, duellCount),
    },
  };
}
