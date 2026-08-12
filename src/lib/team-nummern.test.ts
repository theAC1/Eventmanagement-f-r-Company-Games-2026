import { describe, expect, it } from "vitest";
import { hatLuecken, naechsteFreieNummer, neueNummern } from "./team-nummern";

describe("hatLuecken", () => {
  it("erkennt eine lückenlose Reihe ab 1", () => {
    expect(hatLuecken([{ id: "a", nummer: 1 }, { id: "b", nummer: 2 }])).toBe(false);
  });

  it("erkennt die Lücke nach dem Löschen mittendrin", () => {
    // 17 Teams, 15 und 16 gelöscht — 17 bleibt stehen
    expect(
      hatLuecken([
        { id: "a", nummer: 1 },
        { id: "b", nummer: 2 },
        { id: "c", nummer: 17 },
      ]),
    ).toBe(true);
  });

  it("erkennt eine Reihe, die nicht bei 1 beginnt", () => {
    expect(hatLuecken([{ id: "a", nummer: 2 }, { id: "b", nummer: 3 }])).toBe(true);
  });

  it("ist bei leerer Liste ohne Befund", () => {
    expect(hatLuecken([])).toBe(false);
  });
});

describe("neueNummern", () => {
  it("schliesst Lücken und behält die Reihenfolge", () => {
    expect(
      neueNummern([
        { id: "c", nummer: 17 },
        { id: "a", nummer: 1 },
        { id: "b", nummer: 5 },
      ]),
    ).toEqual([
      { id: "b", nummer: 2 },
      { id: "c", nummer: 3 },
    ]);
  });

  it("meldet nichts, wenn die Reihe schon stimmt", () => {
    expect(
      neueNummern([{ id: "a", nummer: 1 }, { id: "b", nummer: 2 }]),
    ).toEqual([]);
  });

  it("verschiebt eine komplett verschobene Reihe", () => {
    expect(
      neueNummern([{ id: "a", nummer: 10 }, { id: "b", nummer: 11 }]),
    ).toEqual([
      { id: "a", nummer: 1 },
      { id: "b", nummer: 2 },
    ]);
  });

  it("kommt mit leerer Liste klar", () => {
    expect(neueNummern([])).toEqual([]);
  });
});

describe("naechsteFreieNummer", () => {
  it("füllt die kleinste Lücke", () => {
    expect(naechsteFreieNummer([1, 2, 4, 17])).toBe(3);
  });

  it("hängt hinten an, wenn es keine Lücke gibt", () => {
    expect(naechsteFreieNummer([1, 2, 3])).toBe(4);
  });

  it("beginnt bei 1", () => {
    expect(naechsteFreieNummer([])).toBe(1);
    expect(naechsteFreieNummer([2, 3])).toBe(1);
  });
});
