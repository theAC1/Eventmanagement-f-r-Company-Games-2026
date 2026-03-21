/**
 * Zeitplan-Engine: Rotiert N Teams durch M Stationen (Postenlauf-Modell)
 *
 * Constraints:
 * 1. Jedes Team spielt jedes Game genau 1×
 * 2. Kein Team ist in 2 Stationen gleichzeitig
 * 3. Duell-Games brauchen 2 Teams im gleichen Slot
 * 4. Bei ungerader Teamanzahl für Duell-Games: Freirunden
 * 5. Pausen werden als leere Slots eingefügt
 */

export type GameInput = {
  id: string;
  name: string;
  teamsProSlot: number; // 1 = Solo, 2 = Duell
};

export type PauseInput = {
  nachRunde: number; // Insert pause after this round (1-based)
  dauerMin: number;
  name: string;
};

export type ScheduleConfig = {
  teams: { id: string; name: string; nummer: number }[];
  games: GameInput[];
  blockDauerMin: number; // Default 15
  wechselzeitMin: number; // Default 5
  startZeit: string; // "09:00"
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

export type ScheduleResult = {
  slots: SlotOutput[];
  runden: number;
  endZeit: string;
  konflikte: string[];
  teamZeitplaene: Record<string, SlotOutput[]>;
};

/**
 * Parse "HH:MM" to minutes since midnight
 */
function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Format minutes since midnight to "HH:MM"
 */
function formatTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Generate a rotation schedule using a round-robin approach
 */
export function generateSchedule(config: ScheduleConfig): ScheduleResult {
  const { teams, games, blockDauerMin, wechselzeitMin, startZeit, pausen } = config;
  const numTeams = teams.length;
  const numGames = games.length;
  const taktMin = blockDauerMin + wechselzeitMin;

  // Separate solo and duell games
  const soloGames = games.filter((g) => g.teamsProSlot === 1);
  const duellGames = games.filter((g) => g.teamsProSlot >= 2);

  // Total rounds needed: each team must play each game once
  // For solo games: numTeams rounds per game (1 team per round)
  // For duell games: ceil(numTeams/2) rounds per game (2 teams per round)
  // But since games run in parallel, we need max(numTeams, numGames) rounds

  // Build rotation matrix: rows = rounds, cols = games
  // Each cell = which team(s) play that game in that round
  const numRounds = numTeams; // Worst case: each team needs a slot at each station
  const schedule: { gameIdx: number; teamIdxs: number[] }[][] = [];

  // Track which games each team has played
  const teamPlayed: Set<number>[] = teams.map(() => new Set());

  // Simple greedy assignment
  for (let round = 0; round < numRounds; round++) {
    const roundSlots: { gameIdx: number; teamIdxs: number[] }[] = [];
    const teamsUsedThisRound = new Set<number>();

    // Assign duell games first (more constrained)
    for (let gi = 0; gi < games.length; gi++) {
      const game = games[gi];
      if (game.teamsProSlot < 2) continue;

      const available = [];
      for (let ti = 0; ti < numTeams; ti++) {
        if (!teamsUsedThisRound.has(ti) && !teamPlayed[ti].has(gi)) {
          available.push(ti);
        }
      }

      if (available.length >= 2) {
        const pair = [available[0], available[1]];
        pair.forEach((ti) => {
          teamsUsedThisRound.add(ti);
          teamPlayed[ti].add(gi);
        });
        roundSlots.push({ gameIdx: gi, teamIdxs: pair });
      }
    }

    // Then solo games
    for (let gi = 0; gi < games.length; gi++) {
      const game = games[gi];
      if (game.teamsProSlot >= 2) continue;

      for (let ti = 0; ti < numTeams; ti++) {
        if (!teamsUsedThisRound.has(ti) && !teamPlayed[ti].has(gi)) {
          teamsUsedThisRound.add(ti);
          teamPlayed[ti].add(gi);
          roundSlots.push({ gameIdx: gi, teamIdxs: [ti] });
          break; // 1 team per solo game per round
        }
      }
    }

    if (roundSlots.length === 0) break; // All games assigned
    schedule.push(roundSlots);
  }

  // Check if all teams have played all games
  const konflikte: string[] = [];
  for (let ti = 0; ti < numTeams; ti++) {
    for (let gi = 0; gi < numGames; gi++) {
      if (!teamPlayed[ti].has(gi)) {
        konflikte.push(
          `${teams[ti].name} hat ${games[gi].name} nicht zugeteilt bekommen`
        );
      }
    }
  }

  // Build time-based slots
  const slots: SlotOutput[] = [];
  let currentTime = parseTime(startZeit);
  const pauseMap = new Map(pausen.map((p) => [p.nachRunde, p]));

  for (let roundIdx = 0; roundIdx < schedule.length; roundIdx++) {
    const roundNum = roundIdx + 1;
    const roundStart = currentTime;
    const roundEnd = currentTime + blockDauerMin;

    for (const assignment of schedule[roundIdx]) {
      const game = games[assignment.gameIdx];
      slots.push({
        runde: roundNum,
        startZeit: formatTime(roundStart),
        endZeit: formatTime(roundEnd),
        gameId: game.id,
        gameName: game.name,
        teamIds: assignment.teamIdxs.map((ti) => teams[ti].id),
        teamNames: assignment.teamIdxs.map((ti) => teams[ti].name),
      });
    }

    currentTime = roundEnd + wechselzeitMin;

    // Insert pause if configured
    const pause = pauseMap.get(roundNum);
    if (pause) {
      currentTime += pause.dauerMin;
    }
  }

  // Build per-team schedules
  const teamZeitplaene: Record<string, SlotOutput[]> = {};
  for (const team of teams) {
    teamZeitplaene[team.id] = slots
      .filter((s) => s.teamIds.includes(team.id))
      .sort((a, b) => a.runde - b.runde);
  }

  return {
    slots,
    runden: schedule.length,
    endZeit: formatTime(currentTime - wechselzeitMin),
    konflikte,
    teamZeitplaene,
  };
}
