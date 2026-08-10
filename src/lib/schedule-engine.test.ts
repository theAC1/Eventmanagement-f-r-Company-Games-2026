/**
 * Tests für die Zeitplan-Engine v2
 *
 * 7 Szenarien aus der Spezifikation + Constraint-Validierung
 * Ausführen: npx tsx src/lib/schedule-engine.test.ts
 */

import { generateSchedule, type ScheduleConfig, type GameInput, type ScheduleResult, type AntiKorrelationConfig } from "./schedule-engine";

// ─── Test-Helfer ─────────────────────────────────────────────────────

function makeTeams(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `team-${i + 1}`,
    name: `Team ${i + 1}`,
    nummer: i + 1,
  }));
}

const STANDARD_GAMES: GameInput[] = [
  { id: "g1", name: "XXL Basketball", teamsProSlot: 2 },
  { id: "g2", name: "Human Soccer", teamsProSlot: 2 },
  { id: "g3", name: "Cornhole", teamsProSlot: 2 },
  { id: "g4", name: "Quadrant Chaos", teamsProSlot: 2 },
  { id: "g5", name: "Stack Attack", teamsProSlot: 1 },
  { id: "g6", name: "Kisten Stappeln", teamsProSlot: 1 },
  { id: "g7", name: "Lava Becken", teamsProSlot: 1 },
  { id: "g8", name: "Eierfall", teamsProSlot: 1 },
  { id: "g9", name: "Radio Runner", teamsProSlot: 1 },
  { id: "g10", name: "Schwebender Architekt", teamsProSlot: 1 },
  { id: "g11", name: "Geschicklichkeits Parcour", teamsProSlot: 1 },
];

const SOLO_ONLY_GAMES: GameInput[] = STANDARD_GAMES.filter(g => g.teamsProSlot === 1).concat([
  { id: "g12", name: "Solo Extra 1", teamsProSlot: 1 },
  { id: "g13", name: "Solo Extra 2", teamsProSlot: 1 },
  { id: "g14", name: "Solo Extra 3", teamsProSlot: 1 },
  { id: "g15", name: "Solo Extra 4", teamsProSlot: 1 },
]);

const DUELL_ONLY_GAMES: GameInput[] = STANDARD_GAMES.filter(g => g.teamsProSlot === 2);

function makeConfig(
  teamCount: number,
  games: GameInput[],
  antiKorrelationen?: AntiKorrelationConfig[],
): ScheduleConfig {
  return {
    teams: makeTeams(teamCount),
    games,
    blockDauerMin: 15,
    wechselzeitMin: 5,
    startZeit: "09:00",
    pausen: [],
    antiKorrelationen,
  };
}

// ─── Constraint-Prüfung ─────────────────────────────────────────────

function validateHardConstraints(result: ScheduleResult, config: ScheduleConfig): string[] {
  const errors: string[] = [];
  const { teams, games } = config;

  // 1. Jedes Team spielt jedes Game genau 1×
  for (const team of teams) {
    for (const game of games) {
      const count = result.slots.filter(
        s => s.gameId === game.id && s.teamIds.includes(team.id)
      ).length;
      if (count === 0) {
        errors.push(`${team.name} hat ${game.name} nicht gespielt`);
      } else if (count > 1) {
        errors.push(`${team.name} hat ${game.name} ${count}× gespielt (statt 1×)`);
      }
    }
  }

  // 2. Kein Team in 2 Stationen gleichzeitig
  const roundNums = [...new Set(result.slots.map(s => s.runde))];
  for (const runde of roundNums) {
    const roundSlots = result.slots.filter(s => s.runde === runde);
    const teamCounts = new Map<string, number>();
    for (const slot of roundSlots) {
      for (const tid of slot.teamIds) {
        teamCounts.set(tid, (teamCounts.get(tid) ?? 0) + 1);
      }
    }
    for (const [tid, count] of teamCounts) {
      if (count > 1) {
        errors.push(`${tid} ist in Runde ${runde} ${count}× eingeteilt`);
      }
    }
  }

  // 3. Jede Station max 1× pro Runde
  for (const runde of roundNums) {
    const roundSlots = result.slots.filter(s => s.runde === runde);
    const gameCounts = new Map<string, number>();
    for (const slot of roundSlots) {
      gameCounts.set(slot.gameId, (gameCounts.get(slot.gameId) ?? 0) + 1);
    }
    for (const [gid, count] of gameCounts) {
      if (count > 1) {
        errors.push(`Game ${gid} ist in Runde ${runde} ${count}× belegt`);
      }
    }
  }

  return errors;
}

function analyzeResult(label: string, result: ScheduleResult, config: ScheduleConfig): void {
  const hardErrors = validateHardConstraints(result, config);
  const allErrors = [...result.konflikte, ...hardErrors];

  const stats = result.statistiken!;
  const freirunden = Object.values(stats.freirundenProTeam);
  const minByes = Math.min(...freirunden);
  const maxByes = Math.max(...freirunden);
  const avgByes = freirunden.reduce((a, b) => a + b, 0) / freirunden.length;

  // Gegner-Diversität: max Begegnungen zwischen 2 Teams
  let maxOpponentMeetings = 0;
  for (const [, gegner] of Object.entries(stats.duellGegnerVerteilung)) {
    for (const count of Object.values(gegner)) {
      if (count > maxOpponentMeetings) maxOpponentMeetings = count;
    }
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${"═".repeat(60)}`);
  console.log(`  Teams: ${config.teams.length} | Games: ${config.games.length} (${config.games.filter(g => g.teamsProSlot >= 2).length} Duell + ${config.games.filter(g => g.teamsProSlot === 1).length} Solo)`);
  console.log(`  Runden: ${result.runden} (theoretisches Minimum: ${stats.theoretischesMinimum})`);
  console.log(`  Effizienz: ${(stats.rundenEffizienz * 100).toFixed(1)}%`);
  console.log(`  Freirunden: min=${minByes} max=${maxByes} avg=${avgByes.toFixed(1)} (Spread: ${maxByes - minByes})`);
  if (maxOpponentMeetings > 0) {
    console.log(`  Max Duell-Begegnungen gleicher Gegner: ${maxOpponentMeetings}`);
  }
  console.log(`  Endzeit: ${result.endZeit}`);
  console.log(`  Konflikte (Engine): ${result.konflikte.length}`);
  console.log(`  Harte Constraint-Verletzungen: ${hardErrors.length}`);

  if (allErrors.length > 0) {
    console.log(`\n  ❌ FEHLER:`);
    for (const e of allErrors.slice(0, 10)) {
      console.log(`     - ${e}`);
    }
    if (allErrors.length > 10) {
      console.log(`     ... und ${allErrors.length - 10} weitere`);
    }
  } else {
    console.log(`\n  ✅ ALLE CONSTRAINTS ERFÜLLT`);
  }
}

// ─── Testszenarien ───────────────────────────────────────────────────

function runAllTests() {
  console.log("\n🏟️  ZEITPLAN-ENGINE v2 – TESTLAUF\n");

  let allPassed = true;

  // 1. Standard: 18 Teams, 11 Games (4 Duell + 7 Solo)
  {
    const config = makeConfig(18, STANDARD_GAMES);
    const t0 = performance.now();
    const result = generateSchedule(config);
    const dt = performance.now() - t0;
    analyzeResult("Test 1: Standard (18 Teams, 11 Games)", result, config);
    console.log(`  Laufzeit: ${dt.toFixed(1)}ms`);
    const errors = validateHardConstraints(result, config);
    if (errors.length > 0 || result.konflikte.length > 0) allPassed = false;
  }

  // 2. Minimum: 12 Teams, 11 Games
  {
    const config = makeConfig(12, STANDARD_GAMES);
    const t0 = performance.now();
    const result = generateSchedule(config);
    const dt = performance.now() - t0;
    analyzeResult("Test 2: Minimum (12 Teams, 11 Games)", result, config);
    console.log(`  Laufzeit: ${dt.toFixed(1)}ms`);
    const errors = validateHardConstraints(result, config);
    if (errors.length > 0 || result.konflikte.length > 0) allPassed = false;
  }

  // 3. Maximum: 20 Teams, 11 Games
  {
    const config = makeConfig(20, STANDARD_GAMES);
    const t0 = performance.now();
    const result = generateSchedule(config);
    const dt = performance.now() - t0;
    analyzeResult("Test 3: Maximum (20 Teams, 11 Games)", result, config);
    console.log(`  Laufzeit: ${dt.toFixed(1)}ms`);
    const errors = validateHardConstraints(result, config);
    if (errors.length > 0 || result.konflikte.length > 0) allPassed = false;
  }

  // 4. Ungerade: 17 Teams, 11 Games (Bye-Runden bei Duell)
  {
    const config = makeConfig(17, STANDARD_GAMES);
    const t0 = performance.now();
    const result = generateSchedule(config);
    const dt = performance.now() - t0;
    analyzeResult("Test 4: Ungerade (17 Teams, 11 Games)", result, config);
    console.log(`  Laufzeit: ${dt.toFixed(1)}ms`);
    const errors = validateHardConstraints(result, config);
    if (errors.length > 0 || result.konflikte.length > 0) allPassed = false;
  }

  // 5. Nur Solo: 16 Teams, 11 Solo-Games
  {
    const soloGames = STANDARD_GAMES.filter(g => g.teamsProSlot === 1).concat([
      { id: "gs1", name: "Solo Extra 1", teamsProSlot: 1 },
      { id: "gs2", name: "Solo Extra 2", teamsProSlot: 1 },
      { id: "gs3", name: "Solo Extra 3", teamsProSlot: 1 },
      { id: "gs4", name: "Solo Extra 4", teamsProSlot: 1 },
    ]);
    const config = makeConfig(16, soloGames);
    const t0 = performance.now();
    const result = generateSchedule(config);
    const dt = performance.now() - t0;
    analyzeResult("Test 5: Nur Solo (16 Teams, 11 Solo-Games)", result, config);
    console.log(`  Laufzeit: ${dt.toFixed(1)}ms`);
    const errors = validateHardConstraints(result, config);
    if (errors.length > 0 || result.konflikte.length > 0) allPassed = false;
  }

  // 6. Nur Duell: 16 Teams, 4 Duell-Games
  {
    const duellGames = STANDARD_GAMES.filter(g => g.teamsProSlot >= 2);
    const config = makeConfig(16, duellGames);
    const t0 = performance.now();
    const result = generateSchedule(config);
    const dt = performance.now() - t0;
    analyzeResult("Test 6: Nur Duell (16 Teams, 4 Duell-Games)", result, config);
    console.log(`  Laufzeit: ${dt.toFixed(1)}ms`);
    const errors = validateHardConstraints(result, config);
    if (errors.length > 0 || result.konflikte.length > 0) allPassed = false;
  }

  // 7. Edge Case: 11 Teams, 11 Games
  {
    const config = makeConfig(11, STANDARD_GAMES);
    const t0 = performance.now();
    const result = generateSchedule(config);
    const dt = performance.now() - t0;
    analyzeResult("Test 7: Edge Case (11 Teams, 11 Games)", result, config);
    console.log(`  Laufzeit: ${dt.toFixed(1)}ms`);
    const errors = validateHardConstraints(result, config);
    if (errors.length > 0 || result.konflikte.length > 0) allPassed = false;
  }

  // 8. Anti-Korrelation: 18 Teams, Standard-Games, Kisten Stappeln <-> Stack Attack
  {
    const config = makeConfig(18, STANDARD_GAMES, [{ gameXId: "g6", gameYId: "g5" }]);
    const t0 = performance.now();
    const result = generateSchedule(config);
    const dt = performance.now() - t0;

    const hardErrors = validateHardConstraints(result, config);
    const hartKonflikte = result.konflikte.filter(k => k.startsWith("HART:"));
    const warnKonflikte = result.konflikte.filter(k => k.startsWith("WARN:"));

    // Konformitaet: beide Games in unterschiedlichen Haelften der Gesamtrundenzahl
    const half = result.runden / 2;
    let konform = 0;
    let beideZugeteilt = 0;
    for (const team of config.teams) {
      const rundeX = result.slots.find(
        s => s.gameId === "g6" && s.teamIds.includes(team.id)
      )?.runde;
      const rundeY = result.slots.find(
        s => s.gameId === "g5" && s.teamIds.includes(team.id)
      )?.runde;
      if (rundeX === undefined || rundeY === undefined) continue;
      beideZugeteilt++;
      const xFrueh = rundeX - 1 < half;
      const yFrueh = rundeY - 1 < half;
      if (xFrueh !== yFrueh) konform++;
    }
    const quote = beideZugeteilt > 0 ? konform / beideZugeteilt : 0;

    console.log(`\n${"═".repeat(60)}`);
    console.log(`  Test 8: Anti-Korrelation (18 Teams, Kisten Stappeln <-> Stack Attack)`);
    console.log(`${"═".repeat(60)}`);
    console.log(`  Teams: ${config.teams.length} | Games: ${config.games.length} | Runden: ${result.runden}`);
    console.log(`  Konformitaet: ${konform}/${beideZugeteilt} Teams (${(quote * 100).toFixed(1)}%) spielen beide Games in unterschiedlichen Haelften`);
    console.log(`  WARN-Konflikte (beide frueh/spaet): ${warnKonflikte.length}`);
    const antiStats = result.statistiken?.antiKorrelation?.[0];
    if (antiStats) {
      console.log(`  Statistik antiKorrelation: konform=${antiStats.konformeTeams}, verletzend=${antiStats.verletzendeTeams} (${antiStats.gameXName} <-> ${antiStats.gameYName})`);
    }
    console.log(`  Harte Constraint-Verletzungen: ${hardErrors.length} | HART-Konflikte (Engine): ${hartKonflikte.length}`);
    console.log(`  Laufzeit: ${dt.toFixed(1)}ms`);

    const passed = hardErrors.length === 0 && hartKonflikte.length === 0 && quote >= 0.7;
    if (passed) {
      console.log(`\n  ✅ BESTANDEN (keine harten Konflikte, Konformitaet >= 70%)`);
    } else {
      console.log(`\n  ❌ FEHLGESCHLAGEN (hart=${hardErrors.length + hartKonflikte.length}, Konformitaet=${(quote * 100).toFixed(1)}%)`);
      allPassed = false;
    }
  }

  // Zusammenfassung
  console.log(`\n${"═".repeat(60)}`);
  if (allPassed) {
    console.log("  🎉 ALLE 8 TESTS BESTANDEN – 0 Constraint-Verletzungen");
  } else {
    console.log("  ⚠️  MINDESTENS EIN TEST HAT CONSTRAINT-VERLETZUNGEN");
  }
  console.log(`${"═".repeat(60)}\n`);
}

runAllTests();
