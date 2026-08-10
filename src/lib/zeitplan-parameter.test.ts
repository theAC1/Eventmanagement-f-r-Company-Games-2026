import { describe, it, expect } from "vitest";
import {
  type ZeitplanParameter,
  istGeaendert,
  parameterDiff,
  taktMin,
} from "./zeitplan-parameter";

const basis: ZeitplanParameter = {
  blockDauerMin: 15,
  wechselzeitMin: 5,
  startZeit: "09:00",
  mittagspause: {
    nachRunde: 6,
    dauerMin: 45,
    maxTeamsGleichzeitig: 8,
    versatzMin: 5,
  },
};

describe("parameterDiff", () => {
  it("identische Parameter ergeben keine Änderung", () => {
    expect(parameterDiff(basis, { ...basis })).toEqual([]);
    expect(istGeaendert(basis, { ...basis })).toBe(false);
  });

  it("meldet Blockdauer mit alter und neuer Angabe", () => {
    const diff = parameterDiff(basis, { ...basis, blockDauerMin: 20 });
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({
      feld: "blockDauerMin",
      label: "Blockdauer",
      von: "15 min",
      nach: "20 min",
    });
  });

  it("meldet Wechselzeit und Startzeit gemeinsam", () => {
    const diff = parameterDiff(basis, {
      ...basis,
      wechselzeitMin: 10,
      startZeit: "08:30",
    });
    expect(diff.map((a) => a.feld)).toEqual(["wechselzeitMin", "startZeit"]);
    expect(diff[1].nach).toBe("08:30");
  });

  it("Mittagspause abgeschaltet ergibt genau eine Änderung", () => {
    const diff = parameterDiff(basis, { ...basis, mittagspause: null });
    expect(diff).toEqual([
      { feld: "mittagspause", label: "Mittagspause", von: "aktiv", nach: "aus" },
    ]);
  });

  it("Mittagspause eingeschaltet ergibt genau eine Änderung", () => {
    const ohne: ZeitplanParameter = { ...basis, mittagspause: null };
    const diff = parameterDiff(ohne, basis);
    expect(diff).toEqual([
      { feld: "mittagspause", label: "Mittagspause", von: "aus", nach: "aktiv" },
    ]);
  });

  it("beidseitig abgeschaltete Mittagspause ergibt keine Änderung", () => {
    const ohne: ZeitplanParameter = { ...basis, mittagspause: null };
    expect(parameterDiff(ohne, { ...ohne })).toEqual([]);
    expect(parameterDiff(ohne, { ...ohne, startZeit: "08:00" })).toHaveLength(1);
  });

  it("meldet einzelne Mittagspausen-Felder", () => {
    const diff = parameterDiff(basis, {
      ...basis,
      mittagspause: { ...basis.mittagspause!, dauerMin: 60, versatzMin: 10 },
    });
    expect(diff.map((a) => a.feld)).toEqual([
      "mittagspause.dauerMin",
      "mittagspause.versatzMin",
    ]);
    expect(diff[0].von).toBe("45 min");
    expect(diff[0].nach).toBe("60 min");
  });

  it("Feldschlüssel sind eindeutig", () => {
    const diff = parameterDiff(basis, {
      blockDauerMin: 20,
      wechselzeitMin: 10,
      startZeit: "08:00",
      mittagspause: {
        nachRunde: 5,
        dauerMin: 60,
        maxTeamsGleichzeitig: 10,
        versatzMin: 10,
      },
    });
    expect(new Set(diff.map((a) => a.feld)).size).toBe(diff.length);
    expect(diff).toHaveLength(7);
  });
});

describe("taktMin", () => {
  it("summiert Blockdauer und Wechselzeit", () => {
    expect(taktMin(basis)).toBe(20);
  });

  it("kommt mit Wechselzeit 0 klar", () => {
    expect(taktMin({ ...basis, wechselzeitMin: 0 })).toBe(15);
  });
});
