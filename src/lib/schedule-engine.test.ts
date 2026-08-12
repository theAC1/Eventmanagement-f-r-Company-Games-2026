import { describe, expect, it } from "vitest";
import {
  generateSchedule,
  theoretischesMinimum,
  type GameInput,
  type ScheduleConfig,
  type ScheduleResult,
} from "./schedule-engine";
import { MITTAG_DEFAULT } from "./mittagsplanung";

// ─── Testdaten ───────────────────────────────────────────────────────

function makeTeams(anzahl: number, teilnehmerAnzahl = 6) {
  return Array.from({ length: anzahl }, (_, i) => ({
    id: `team-${i + 1}`,
    name: `Team ${i + 1}`,
    nummer: i + 1,
    teilnehmerAnzahl,
  }));
}

/**
 * Der reale Stand nach dem Protokoll: 10 Games, davon Human Soccer und
 * ChaosQuadrant zweimal ⇒ 12 Posten pro Team.
 */
const PROTOKOLL_GAMES: GameInput[] = [
  { id: "cornhole", name: "Cornhole", teamsProSlot: 2, crewGroesse: 2 },
  { id: "quadrant-chaos", name: "ChaosQuadrant", teamsProSlot: 2, durchgaenge: 2, crewGroesse: 2 },
  { id: "human-soccer", name: "Human Soccer", teamsProSlot: 2, durchgaenge: 2, crewGroesse: 3 },
  { id: "xxl-viergewinnt", name: "XXL Viergewinnt", teamsProSlot: 2, crewGroesse: 2 },
  { id: "radio-runner", name: "Robert Huber Radio", teamsProSlot: 1, crewGroesse: 2 },
  { id: "kisten-stappeln", name: "Kisten stapeln", teamsProSlot: 1, crewGroesse: 2 },
  { id: "schwebender-architekt", name: "Schwebendes Labyrinth", teamsProSlot: 1, crewGroesse: 2 },
  { id: "lava-becken", name: "Lavabecken", teamsProSlot: 1, crewGroesse: 2 },
  { id: "stack-attack", name: "Stack Attack", teamsProSlot: 1, crewGroesse: 2 },
  { id: "menschenkugelbahn", name: "Menschenkugelbahn", teamsProSlot: 1, crewGroesse: 2 },
];

function basisConfig(overrides: Partial<ScheduleConfig> = {}): ScheduleConfig {
  return {
    teams: makeTeams(17),
    games: PROTOKOLL_GAMES,
    blockDauerMin: 15,
    wechselzeitMin: 5,
    startZeit: "09:00",
    pausen: [],
    ...overrides,
  };
}

// ─── Prüf-Helfer ─────────────────────────────────────────────────────

function harteKonflikte(result: ScheduleResult): string[] {
  return result.konflikte.filter((k) => k.startsWith("HART"));
}

/** Zählt, wie oft jedes Team jedes Game gespielt hat. */
function einsaetze(result: ScheduleResult): Map<string, number> {
  const zaehler = new Map<string, number>();
  for (const slot of result.slots) {
    for (const teamId of slot.teamIds) {
      const key = `${teamId}|${slot.gameId}`;
      zaehler.set(key, (zaehler.get(key) ?? 0) + 1);
    }
  }
  return zaehler;
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("theoretischesMinimum", () => {
  it("bindet an der stärksten Schranke — hier den Solo-Stationen", () => {
    // 6 Solo-Posten bedienen je ein Team pro Runde ⇒ 17 Teams = 17 Runden.
    expect(theoretischesMinimum(17, PROTOKOLL_GAMES)).toBe(17);
  });

  it("berücksichtigt Doppel-Durchgänge bei Duellen", () => {
    // Ein Duell-Game mit 2 Durchgängen für 8 Teams: 16 Besuche / 2 = 8 Runden.
    expect(
      theoretischesMinimum(8, [
        { id: "d", name: "Duell", teamsProSlot: 2, durchgaenge: 2 },
      ]),
    ).toBe(8);
  });

  it("ist 0 ohne Teams oder Games", () => {
    expect(theoretischesMinimum(0, PROTOKOLL_GAMES)).toBe(0);
    expect(theoretischesMinimum(17, [])).toBe(0);
  });
});

describe("generateSchedule — Grundregeln", () => {
  const result = generateSchedule(basisConfig());

  it("teilt jedem Team jeden Posten in der geforderten Anzahl zu", () => {
    const zaehler = einsaetze(result);
    for (const team of makeTeams(17)) {
      for (const game of PROTOKOLL_GAMES) {
        expect(zaehler.get(`${team.id}|${game.id}`) ?? 0).toBe(game.durchgaenge ?? 1);
      }
    }
  });

  it("erzeugt keine harten Konflikte", () => {
    expect(harteKonflikte(result)).toEqual([]);
  });

  it("setzt kein Team und kein Game zweimal in dieselbe Runde", () => {
    for (let runde = 1; runde <= result.runden; runde++) {
      const derRunde = result.slots.filter((s) => s.runde === runde);
      const teamIds = derRunde.flatMap((s) => s.teamIds);
      const gameIds = derRunde.map((s) => s.gameId);
      expect(new Set(teamIds).size).toBe(teamIds.length);
      expect(new Set(gameIds).size).toBe(gameIds.length);
    }
  });

  it("legt die beiden Durchgänge eines Doppel-Games auseinander", () => {
    for (const team of makeTeams(17)) {
      const runden = result.teamZeitplaene[team.id]
        .filter((s) => s.gameId === "human-soccer")
        .map((s) => s.runde);
      expect(runden).toHaveLength(2);
      expect(runden[1] - runden[0]).toBeGreaterThan(1);
    }
  });

  it("bleibt nah am theoretischen Minimum", () => {
    const minimum = result.statistiken!.theoretischesMinimum;
    expect(result.runden).toBeGreaterThanOrEqual(minimum);
    expect(result.runden).toBeLessThanOrEqual(minimum + 3);
  });

  it("rechnet 12 Posten pro Team", () => {
    expect(result.statistiken!.postenProTeam).toBe(12);
  });
});

describe("generateSchedule — Freirunden streuen", () => {
  it("bündelt Pausen nicht zu langen Blöcken am Stück", () => {
    const result = generateSchedule(basisConfig());
    const serien = Object.values(result.statistiken!.laengsteSerieProTeam);
    // Ohne Streuung spielen Teams 12 Runden am Stück durch und langweilen sich
    // danach; mit Streuung bleibt die längste Serie kurz.
    expect(Math.max(...serien)).toBeLessThanOrEqual(6);
  });

  it("gibt jedem Team mindestens eine Freirunde, wenn Runden übrig sind", () => {
    const result = generateSchedule(basisConfig());
    const frei = Object.values(result.statistiken!.freirundenProTeam);
    expect(Math.min(...frei)).toBeGreaterThan(0);
  });
});

describe("generateSchedule — Mittagsfenster", () => {
  const result = generateSchedule(
    basisConfig({
      mittagsfenster: MITTAG_DEFAULT,
      freieHelfer: [{ id: "h1", name: "Helfer 1" }],
    }),
  );

  it("liefert Mittagswellen mit Teams, Posten und freien Helfern", () => {
    expect(result.mittagsWellen).toBeDefined();
    const wellen = result.mittagsWellen!;
    expect(wellen.length).toBeGreaterThan(1);
    expect(new Set(wellen.flatMap((w) => w.teamIds)).size).toBe(17);
    expect(new Set(wellen.flatMap((w) => w.postenIds)).size).toBe(PROTOKOLL_GAMES.length);
    expect(wellen.flatMap((w) => w.helferIds)).toEqual(["h1"]);
  });

  it("setzt kein Team ein, während es isst", () => {
    const wellen = result.mittagsWellen!;
    const welleVonTeam = new Map<string, (typeof wellen)[number]>();
    for (const welle of wellen) {
      for (const id of welle.teamIds) welleVonTeam.set(id, welle);
    }

    for (const slot of result.slots) {
      for (const teamId of slot.teamIds) {
        const welle = welleVonTeam.get(teamId);
        if (!welle) continue;
        const start = Number(slot.startZeit.slice(0, 2)) * 60 + Number(slot.startZeit.slice(3));
        const ende = Number(slot.endZeit.slice(0, 2)) * 60 + Number(slot.endZeit.slice(3));
        expect(start < welle.endeMin && welle.startMin < ende).toBe(false);
      }
    }
  });

  it("lässt den Posten pausieren, während seine Crew isst", () => {
    const wellen = result.mittagsWellen!;
    const welleVonPosten = new Map<string, (typeof wellen)[number]>();
    for (const welle of wellen) {
      for (const id of welle.postenIds) welleVonPosten.set(id, welle);
    }

    for (const slot of result.slots) {
      const welle = welleVonPosten.get(slot.gameId);
      if (!welle) continue;
      const start = Number(slot.startZeit.slice(0, 2)) * 60 + Number(slot.startZeit.slice(3));
      const ende = Number(slot.endZeit.slice(0, 2)) * 60 + Number(slot.endZeit.slice(3));
      expect(start < welle.endeMin && welle.startMin < ende).toBe(false);
    }
  });

  it("kommt trotz Mittagssperren ohne harte Konflikte durch", () => {
    expect(harteKonflikte(result)).toEqual([]);
  });

  it("verteilt die Posten grob nach Ziel auf Vor- und Nachmittag", () => {
    const vormittag = Object.values(result.statistiken!.postenVormittagProTeam);
    // Ziel sind 7 von 12; Streuung von ±2 ist der Preis für die Machbarkeit.
    for (const anzahl of vormittag) {
      expect(anzahl).toBeGreaterThanOrEqual(5);
      expect(anzahl).toBeLessThanOrEqual(9);
    }
  });
});

describe("generateSchedule — Turnierfenster", () => {
  it("meldet, wenn der Plan über das Fenster hinausläuft", () => {
    const result = generateSchedule(
      basisConfig({ fensterEndeZeit: "12:00" }),
    );
    expect(result.fenster!.passt).toBe(false);
    expect(result.fenster!.ueberzugMin).toBeGreaterThan(0);
    expect(result.konflikte.some((k) => k.includes("Turnierfenster"))).toBe(true);
  });

  it("bestätigt ein Fenster, das reicht", () => {
    const result = generateSchedule(basisConfig({ fensterEndeZeit: "18:00" }));
    expect(result.fenster!.passt).toBe(true);
    expect(result.fenster!.ueberzugMin).toBe(0);
  });

  it("ohne Fenster gibt es nichts zu beanstanden", () => {
    const result = generateSchedule(basisConfig());
    expect(result.fenster!.endeSoll).toBeNull();
    expect(result.fenster!.passt).toBe(true);
  });
});

describe("generateSchedule — Randfälle", () => {
  it("meldet fehlende Teams statt zu rechnen", () => {
    const result = generateSchedule(basisConfig({ teams: [] }));
    expect(result.konflikte).toEqual(["Keine Teams vorhanden"]);
    expect(result.slots).toEqual([]);
  });

  it("meldet fehlende Games statt zu rechnen", () => {
    const result = generateSchedule(basisConfig({ games: [] }));
    expect(result.konflikte).toEqual(["Keine Games vorhanden"]);
  });

  it("kommt mit ungerader Teamzahl an Duellen klar (Bye)", () => {
    const result = generateSchedule(
      basisConfig({
        teams: makeTeams(5),
        games: [{ id: "d", name: "Duell", teamsProSlot: 2 }],
      }),
    );
    expect(harteKonflikte(result)).toEqual([]);
    const zaehler = einsaetze(result);
    for (let i = 1; i <= 5; i++) expect(zaehler.get(`team-${i}|d`)).toBe(1);
  });

  it("liefert dasselbe Ergebnis bei gleicher Eingabe", () => {
    const a = generateSchedule(basisConfig({ mittagsfenster: MITTAG_DEFAULT }));
    const b = generateSchedule(basisConfig({ mittagsfenster: MITTAG_DEFAULT }));
    expect(a.slots).toEqual(b.slots);
    expect(a.endZeit).toBe(b.endZeit);
  });

  it("schiebt feste Pausen ins Zeitraster", () => {
    const ohne = generateSchedule(
      basisConfig({ teams: makeTeams(4), games: [{ id: "s", name: "Solo", teamsProSlot: 1 }] }),
    );
    const mit = generateSchedule(
      basisConfig({
        teams: makeTeams(4),
        games: [{ id: "s", name: "Solo", teamsProSlot: 1 }],
        pausen: [{ nachRunde: 2, dauerMin: 30, name: "Kaffee" }],
      }),
    );
    expect(ohne.runden).toBe(mit.runden);
    const endeOhne = Number(ohne.endZeit.slice(0, 2)) * 60 + Number(ohne.endZeit.slice(3));
    const endeMit = Number(mit.endZeit.slice(0, 2)) * 60 + Number(mit.endZeit.slice(3));
    expect(endeMit - endeOhne).toBe(30);
  });
});

describe("generateSchedule — Anti-Korrelation", () => {
  it("meldet unbekannte Game-IDs, statt sie stillschweigend zu schlucken", () => {
    const result = generateSchedule(
      basisConfig({ antiKorrelationen: [{ gameXId: "gibts-nicht", gameYId: "cornhole" }] }),
    );
    expect(result.konflikte.some((k) => k.includes("unbekannte Game-ID"))).toBe(true);
  });

  it("liefert eine Statistik je Paar", () => {
    const result = generateSchedule(
      basisConfig({
        antiKorrelationen: [{ gameXId: "kisten-stappeln", gameYId: "stack-attack" }],
      }),
    );
    const stat = result.statistiken!.antiKorrelation!;
    expect(stat).toHaveLength(1);
    expect(stat[0].konformeTeams + stat[0].verletzendeTeams).toBe(17);
  });
});
