import { describe, expect, it } from "vitest";
import { berechneGamePunkteAusRohdaten } from "./game-punkte";
import type { Wertungslogik } from "./wertungslogik-types";

describe("berechneGamePunkteAusRohdaten", () => {
  it("liest bei punkte_duell das tatsaechlich vorhandene Team-Feld", () => {
    const wertungslogik: Wertungslogik = {
      typ: "punkte_duell",
      richtung: "hoechster_gewinnt",
      eingabefelder: [
        { name: "punkte_team_a", label: "Punkte Team A" },
        { name: "punkte_team_b", label: "Punkte Team B" },
      ],
    };

    expect(
      berechneGamePunkteAusRohdaten({ punkte_team_a: 7 }, wertungslogik),
    ).toBe(7);
    expect(
      berechneGamePunkteAusRohdaten({ punkte_team_b: 11 }, wertungslogik),
    ).toBe(11);
  });
});
