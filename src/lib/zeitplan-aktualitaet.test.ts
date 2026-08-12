import { describe, expect, it } from "vitest";
import {
  durchgaengeAusSlots,
  pruefeZeitplanAktualitaet,
  type AktuellerStand,
  type GeplanterStand,
} from "./zeitplan-aktualitaet";

const plan: GeplanterStand = {
  teamIds: ["t1", "t2", "t3"],
  durchgaengeProGame: { g1: 1, g2: 2 },
};

const aktuell: AktuellerStand = {
  teams: [
    { id: "t1", name: "Alpha" },
    { id: "t2", name: "Beta" },
    { id: "t3", name: "Gamma" },
  ],
  games: [
    { id: "g1", name: "Cornhole", durchgaenge: 1 },
    { id: "g2", name: "Human Soccer", durchgaenge: 2 },
  ],
};

describe("pruefeZeitplanAktualitaet", () => {
  it("meldet nichts, solange Plan und Stammdaten übereinstimmen", () => {
    expect(pruefeZeitplanAktualitaet(plan, aktuell)).toEqual({
      aktuell: true,
      abweichungen: [],
    });
  });

  it("erkennt neue Teams beim Namen", () => {
    const ergebnis = pruefeZeitplanAktualitaet(plan, {
      ...aktuell,
      teams: [...aktuell.teams, { id: "t4", name: "Delta" }],
    });
    expect(ergebnis.aktuell).toBe(false);
    expect(ergebnis.abweichungen[0]).toContain("Delta");
  });

  it("erkennt gelöschte Teams", () => {
    const ergebnis = pruefeZeitplanAktualitaet(plan, {
      ...aktuell,
      teams: aktuell.teams.slice(0, 2),
    });
    expect(ergebnis.abweichungen).toContain(
      "1 Team(s) aus dem Plan gibt es nicht mehr.",
    );
  });

  it("erkennt geänderte Durchgänge", () => {
    const ergebnis = pruefeZeitplanAktualitaet(plan, {
      ...aktuell,
      games: [
        { id: "g1", name: "Cornhole", durchgaenge: 2 },
        { id: "g2", name: "Human Soccer", durchgaenge: 2 },
      ],
    });
    expect(ergebnis.abweichungen[0]).toContain("Cornhole");
    expect(ergebnis.abweichungen[0]).toContain("im Plan sind es 1");
  });

  it("erkennt ein neu bereitgestelltes Game", () => {
    const ergebnis = pruefeZeitplanAktualitaet(plan, {
      ...aktuell,
      games: [...aktuell.games, { id: "g3", name: "Lavabecken", durchgaenge: 1 }],
    });
    expect(ergebnis.abweichungen[0]).toContain("Lavabecken");
  });

  it("erkennt Posten, die aus dem Programm gefallen sind", () => {
    const ergebnis = pruefeZeitplanAktualitaet(plan, {
      ...aktuell,
      games: [aktuell.games[0]],
    });
    expect(ergebnis.abweichungen.some((a) => a.includes("nicht mehr auf"))).toBe(true);
  });

  it("fasst lange Namenslisten zusammen", () => {
    const viele = Array.from({ length: 8 }, (_, i) => ({
      id: `neu${i}`,
      name: `Neu ${i}`,
    }));
    const ergebnis = pruefeZeitplanAktualitaet(plan, {
      ...aktuell,
      teams: [...aktuell.teams, ...viele],
    });
    expect(ergebnis.abweichungen[0]).toContain("und 3 weitere");
  });
});

describe("durchgaengeAusSlots", () => {
  it("zählt die Einsätze je Team und nimmt das Maximum", () => {
    const slots = [
      { gameId: "g1", teamIds: ["t1", "t2"] },
      { gameId: "g1", teamIds: ["t1", "t3"] },
      { gameId: "g2", teamIds: ["t1"] },
    ];
    expect(durchgaengeAusSlots(slots)).toEqual({ g1: 2, g2: 1 });
  });

  it("ignoriert Slots ohne Game (gelöschtes Game)", () => {
    expect(durchgaengeAusSlots([{ gameId: "", teamIds: ["t1"] }])).toEqual({});
  });
});
