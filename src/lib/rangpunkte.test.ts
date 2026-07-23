import { describe, it, expect } from "vitest";
import { berechneGameRang, berechneGesamtrangliste } from "./rangpunkte";

// ─── berechneGameRang ───

describe("berechneGameRang", () => {
  it("sollte leeres Array bei keinen Ergebnissen zurückgeben", () => {
    expect(berechneGameRang([], null)).toEqual([]);
  });

  it("sollte Ränge korrekt vergeben (höchster gewinnt)", () => {
    const ergebnisse = [
      { id: "e1", gameId: "g1", teamId: "t1", gamePunkte: 50, rohdaten: {} },
      { id: "e2", gameId: "g1", teamId: "t2", gamePunkte: 80, rohdaten: {} },
      { id: "e3", gameId: "g1", teamId: "t3", gamePunkte: 30, rohdaten: {} },
    ];

    const result = berechneGameRang(ergebnisse, { richtung: "hoechster_gewinnt" });

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ teamId: "t2", rangImGame: 1, gamePunkte: 80 });
    expect(result[1]).toMatchObject({ teamId: "t1", rangImGame: 2, gamePunkte: 50 });
    expect(result[2]).toMatchObject({ teamId: "t3", rangImGame: 3, gamePunkte: 30 });
  });

  it("sollte Ränge korrekt vergeben (niedrigster gewinnt)", () => {
    const ergebnisse = [
      { id: "e1", gameId: "g1", teamId: "t1", gamePunkte: 15, rohdaten: {} },
      { id: "e2", gameId: "g1", teamId: "t2", gamePunkte: 10, rohdaten: {} },
      { id: "e3", gameId: "g1", teamId: "t3", gamePunkte: 20, rohdaten: {} },
    ];

    const result = berechneGameRang(ergebnisse, { richtung: "niedrigster_gewinnt" });

    expect(result[0]).toMatchObject({ teamId: "t2", rangImGame: 1, gamePunkte: 10 });
    expect(result[1]).toMatchObject({ teamId: "t1", rangImGame: 2, gamePunkte: 15 });
    expect(result[2]).toMatchObject({ teamId: "t3", rangImGame: 3, gamePunkte: 20 });
  });

  it("sollte gleiche Ränge bei Gleichstand vergeben", () => {
    const ergebnisse = [
      { id: "e1", gameId: "g1", teamId: "t1", gamePunkte: 50, rohdaten: {} },
      { id: "e2", gameId: "g1", teamId: "t2", gamePunkte: 50, rohdaten: {} },
      { id: "e3", gameId: "g1", teamId: "t3", gamePunkte: 30, rohdaten: {} },
    ];

    const result = berechneGameRang(ergebnisse, null);

    expect(result[0].rangImGame).toBe(1);
    expect(result[1].rangImGame).toBe(1);
    expect(result[2].rangImGame).toBe(3); // Springt auf 3, nicht 2
  });

  it("sollte Ergebnisse mit null gamePunkte ignorieren", () => {
    const ergebnisse = [
      { id: "e1", gameId: "g1", teamId: "t1", gamePunkte: 50, rohdaten: {} },
      { id: "e2", gameId: "g1", teamId: "t2", gamePunkte: null, rohdaten: {} },
    ];

    const result = berechneGameRang(ergebnisse, null);

    expect(result).toHaveLength(1);
    expect(result[0].teamId).toBe("t1");
  });

  it("sollte Default-Richtung hoechster_gewinnt verwenden bei null Config", () => {
    const ergebnisse = [
      { id: "e1", gameId: "g1", teamId: "t1", gamePunkte: 10, rohdaten: {} },
      { id: "e2", gameId: "g1", teamId: "t2", gamePunkte: 20, rohdaten: {} },
    ];

    const result = berechneGameRang(ergebnisse, null);

    expect(result[0]).toMatchObject({ teamId: "t2", rangImGame: 1 });
    expect(result[1]).toMatchObject({ teamId: "t1", rangImGame: 2 });
  });
});

// ─── berechneGesamtrangliste ───

describe("berechneGesamtrangliste", () => {
  const teams = [
    { id: "t1", name: "Alpha" },
    { id: "t2", name: "Bravo" },
    { id: "t3", name: "Charlie" },
  ];

  it("sollte leere Rangliste bei keinen Rängen zurückgeben", () => {
    expect(berechneGesamtrangliste([], teams, 3)).toEqual([]);
  });

  it("sollte Gesamtrang nach Summe sortieren (niedrigste zuerst)", () => {
    const raenge = [
      // Game 1: t1=1., t2=2., t3=3.
      { teamId: "t1", gameId: "g1", ergebnisId: "e1", gamePunkte: 100, rangImGame: 1, rangPunkte: 1 },
      { teamId: "t2", gameId: "g1", ergebnisId: "e2", gamePunkte: 80, rangImGame: 2, rangPunkte: 2 },
      { teamId: "t3", gameId: "g1", ergebnisId: "e3", gamePunkte: 60, rangImGame: 3, rangPunkte: 3 },
      // Game 2: t1=2., t2=1., t3=3.
      { teamId: "t1", gameId: "g2", ergebnisId: "e4", gamePunkte: 50, rangImGame: 2, rangPunkte: 2 },
      { teamId: "t2", gameId: "g2", ergebnisId: "e5", gamePunkte: 90, rangImGame: 1, rangPunkte: 1 },
      { teamId: "t3", gameId: "g2", ergebnisId: "e6", gamePunkte: 30, rangImGame: 3, rangPunkte: 3 },
    ];

    const result = berechneGesamtrangliste(raenge, teams, 2);

    // t1: 1+2=3, t2: 2+1=3, t3: 3+3=6
    // Tiebreaker t1 vs t2: beide haben je 1x Rang 1 und 1x Rang 2 → gleich
    expect(result[0].rangPunkteSumme).toBe(3);
    expect(result[1].rangPunkteSumme).toBe(3);
    expect(result[2]).toMatchObject({ teamName: "Charlie", rangPunkteSumme: 6, gesamtRang: 3 });
  });

  it("sollte gleiche Gesamtränge bei identischem Tiebreaker vergeben", () => {
    const raenge = [
      // Beide Teams identisch: je 1x Rang 1
      { teamId: "t1", gameId: "g1", ergebnisId: "e1", gamePunkte: 100, rangImGame: 1, rangPunkte: 1 },
      { teamId: "t2", gameId: "g2", ergebnisId: "e2", gamePunkte: 100, rangImGame: 1, rangPunkte: 1 },
    ];

    const result = berechneGesamtrangliste(raenge, teams, 2);

    expect(result[0].gesamtRang).toBe(1);
    expect(result[1].gesamtRang).toBe(1); // Gleicher Rang, nicht 2!
  });

  it("sollte Tiebreaker nach Anzahl erster Plätze auflösen", () => {
    const raenge = [
      // Game 1: t1=1., t2=2.
      { teamId: "t1", gameId: "g1", ergebnisId: "e1", gamePunkte: 100, rangImGame: 1, rangPunkte: 1 },
      { teamId: "t2", gameId: "g1", ergebnisId: "e2", gamePunkte: 80, rangImGame: 2, rangPunkte: 2 },
      // Game 2: t1=1., t2=2.
      { teamId: "t1", gameId: "g2", ergebnisId: "e3", gamePunkte: 90, rangImGame: 1, rangPunkte: 1 },
      { teamId: "t2", gameId: "g2", ergebnisId: "e4", gamePunkte: 70, rangImGame: 2, rangPunkte: 2 },
      // Game 3: t1=3., t2=1.
      { teamId: "t1", gameId: "g3", ergebnisId: "e5", gamePunkte: 10, rangImGame: 3, rangPunkte: 3 },
      { teamId: "t2", gameId: "g3", ergebnisId: "e6", gamePunkte: 100, rangImGame: 1, rangPunkte: 1 },
    ];

    const result = berechneGesamtrangliste(raenge, teams, 3);

    // t1: 1+1+3=5, t2: 2+2+1=5 → Tiebreaker: t1 hat 2× Rang 1, t2 hat 1× Rang 1
    expect(result[0]).toMatchObject({ teamName: "Alpha", gesamtRang: 1 });
    expect(result[1]).toMatchObject({ teamName: "Bravo", gesamtRang: 2 });
  });

  it("sollte gamesGespielt und gamesTotal korrekt setzen", () => {
    const raenge = [
      { teamId: "t1", gameId: "g1", ergebnisId: "e1", gamePunkte: 100, rangImGame: 1, rangPunkte: 1 },
    ];

    const result = berechneGesamtrangliste(raenge, teams, 5);

    expect(result[0].gamesGespielt).toBe(1);
    expect(result[0].gamesTotal).toBe(5);
  });

  it("sollte Platzierungen korrekt zählen", () => {
    const raenge = [
      { teamId: "t1", gameId: "g1", ergebnisId: "e1", gamePunkte: 100, rangImGame: 1, rangPunkte: 1 },
      { teamId: "t1", gameId: "g2", ergebnisId: "e2", gamePunkte: 90, rangImGame: 1, rangPunkte: 1 },
      { teamId: "t1", gameId: "g3", ergebnisId: "e3", gamePunkte: 50, rangImGame: 3, rangPunkte: 3 },
    ];

    const result = berechneGesamtrangliste(raenge, teams, 3);

    expect(result[0].platzierungen).toEqual({ 1: 2, 3: 1 }); // 2× Rang 1, 1× Rang 3
  });
});
