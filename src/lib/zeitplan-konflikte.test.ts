import { describe, it, expect } from "vitest";
import { type KonfliktSlot, pruefeZeitplanKonflikte } from "./zeitplan-konflikte";

/** 2 Teams × 2 Games, sauber auf 2 Runden verteilt. */
const sauber: KonfliktSlot[] = [
  { runde: 1, gameId: "gA", gameName: "Turm", teamIds: ["t1"], teamNames: ["Alpha"] },
  { runde: 1, gameId: "gB", gameName: "Seil", teamIds: ["t2"], teamNames: ["Beta"] },
  { runde: 2, gameId: "gA", gameName: "Turm", teamIds: ["t2"], teamNames: ["Beta"] },
  { runde: 2, gameId: "gB", gameName: "Seil", teamIds: ["t1"], teamNames: ["Alpha"] },
];

describe("pruefeZeitplanKonflikte", () => {
  it("leerer Zeitplan hat keine Konflikte", () => {
    expect(pruefeZeitplanKonflikte([])).toEqual([]);
  });

  it("vollständiger Plan ist konfliktfrei", () => {
    expect(pruefeZeitplanKonflikte(sauber)).toEqual([]);
  });

  it("erkennt ein Team, das in einer Runde doppelt spielt", () => {
    const slots: KonfliktSlot[] = [
      { runde: 1, gameId: "gA", gameName: "Turm", teamIds: ["t1"], teamNames: ["Alpha"] },
      { runde: 1, gameId: "gB", gameName: "Seil", teamIds: ["t1"], teamNames: ["Alpha"] },
      { runde: 2, gameId: "gA", gameName: "Turm", teamIds: ["t2"], teamNames: ["Beta"] },
      { runde: 2, gameId: "gB", gameName: "Seil", teamIds: ["t2"], teamNames: ["Beta"] },
    ];
    const konflikte = pruefeZeitplanKonflikte(slots);
    expect(konflikte).toContain("HART: Alpha in Runde 1 doppelt");
  });

  it("erkennt eine Station, die in einer Runde doppelt belegt ist", () => {
    const slots: KonfliktSlot[] = [
      { runde: 1, gameId: "gA", gameName: "Turm", teamIds: ["t1"], teamNames: ["Alpha"] },
      { runde: 1, gameId: "gA", gameName: "Turm", teamIds: ["t2"], teamNames: ["Beta"] },
    ];
    expect(pruefeZeitplanKonflikte(slots)).toContain(
      'HART: "Turm" in Runde 1 doppelt',
    );
  });

  it("erkennt ein nicht zugeteiltes Game", () => {
    const slots: KonfliktSlot[] = [
      { runde: 1, gameId: "gA", gameName: "Turm", teamIds: ["t1"], teamNames: ["Alpha"] },
      { runde: 1, gameId: "gB", gameName: "Seil", teamIds: ["t2"], teamNames: ["Beta"] },
    ];
    const konflikte = pruefeZeitplanKonflikte(slots);
    expect(konflikte).toContain(
      'HART: Alpha hat "Seil" nicht zugeteilt bekommen',
    );
    expect(konflikte).toContain('HART: Beta hat "Turm" nicht zugeteilt bekommen');
    expect(konflikte).toHaveLength(2);
  });

  it("erkennt ein doppelt gespieltes Game", () => {
    const slots: KonfliktSlot[] = [
      ...sauber,
      { runde: 3, gameId: "gA", gameName: "Turm", teamIds: ["t1"], teamNames: ["Alpha"] },
    ];
    expect(pruefeZeitplanKonflikte(slots)).toContain(
      'HART: Alpha spielt "Turm" 2× statt 1×',
    );
  });

  it("akzeptiert mehrere Durchgänge, wenn das Game sie vorsieht", () => {
    const slots: KonfliktSlot[] = [
      ...sauber,
      { runde: 3, gameId: 'gA', gameName: 'Turm', teamIds: ['t1'], teamNames: ['Alpha'] },
      { runde: 4, gameId: 'gA', gameName: 'Turm', teamIds: ['t2'], teamNames: ['Beta'] },
    ];
    expect(pruefeZeitplanKonflikte(slots, { gA: 2 })).toEqual([]);
  });

  it('meldet fehlende Durchgänge mit Soll-Angabe', () => {
    const konflikte = pruefeZeitplanKonflikte(sauber, { gA: 2 });
    expect(konflikte).toContain(
      'HART: Alpha spielt "Turm" 1× (Soll: 2 Durchgänge)',
    );
  });

  it("Duell-Slots mit zwei Teams sind zulässig", () => {
    const slots: KonfliktSlot[] = [
      {
        runde: 1,
        gameId: "gA",
        gameName: "Duell",
        teamIds: ["t1", "t2"],
        teamNames: ["Alpha", "Beta"],
      },
    ];
    expect(pruefeZeitplanKonflikte(slots)).toEqual([]);
  });

  it("fällt ohne Namen auf die IDs zurück", () => {
    const slots: KonfliktSlot[] = [
      { runde: 1, gameId: "gA", teamIds: ["t1"] },
      { runde: 1, gameId: "gB", teamIds: ["t2"] },
    ];
    expect(pruefeZeitplanKonflikte(slots)).toContain(
      'HART: t1 hat "gB" nicht zugeteilt bekommen',
    );
  });
});
