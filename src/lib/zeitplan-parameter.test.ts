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
  fensterEndeZeit: "16:30",
  postenVormittag: 7,
  mittagsfenster: {
    von: "11:30",
    bis: "13:30",
    dauerMin: 30,
    teamsProWelle: 3,
    versatzMin: 10,
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

  it("meldet das Turnierfenster und das Vormittags-Ziel", () => {
    const diff = parameterDiff(basis, {
      ...basis,
      fensterEndeZeit: "17:00",
      postenVormittag: 8,
    });
    expect(diff.map((a) => a.feld)).toEqual(["fensterEndeZeit", "postenVormittag"]);
    expect(diff[1].von).toBe("7");
    expect(diff[1].nach).toBe("8");
  });

  it("zeigt nicht gesetzte Werte als solche an", () => {
    const diff = parameterDiff(basis, { ...basis, fensterEndeZeit: null });
    expect(diff[0].nach).toBe("nicht gesetzt");
  });

  it("Mittagsfenster abgeschaltet ergibt genau eine Änderung", () => {
    const diff = parameterDiff(basis, { ...basis, mittagsfenster: null });
    expect(diff).toEqual([
      { feld: "mittagsfenster", label: "Mittagsfenster", von: "aktiv", nach: "aus" },
    ]);
  });

  it("Mittagsfenster eingeschaltet ergibt genau eine Änderung", () => {
    const ohne: ZeitplanParameter = { ...basis, mittagsfenster: null };
    const diff = parameterDiff(ohne, basis);
    expect(diff).toEqual([
      { feld: "mittagsfenster", label: "Mittagsfenster", von: "aus", nach: "aktiv" },
    ]);
  });

  it("beidseitig abgeschaltetes Mittagsfenster ergibt keine Änderung", () => {
    const ohne: ZeitplanParameter = { ...basis, mittagsfenster: null };
    expect(parameterDiff(ohne, { ...ohne })).toEqual([]);
    expect(parameterDiff(ohne, { ...ohne, startZeit: "08:00" })).toHaveLength(1);
  });

  it("meldet einzelne Felder des Mittagsfensters", () => {
    const diff = parameterDiff(basis, {
      ...basis,
      mittagsfenster: { ...basis.mittagsfenster!, dauerMin: 45, versatzMin: 15 },
    });
    expect(diff.map((a) => a.feld)).toEqual([
      "mittagsfenster.dauerMin",
      "mittagsfenster.versatzMin",
    ]);
    expect(diff[0].von).toBe("30 min");
    expect(diff[0].nach).toBe("45 min");
  });

  it("Feldschlüssel sind eindeutig", () => {
    const diff = parameterDiff(basis, {
      blockDauerMin: 20,
      wechselzeitMin: 10,
      startZeit: "08:00",
      fensterEndeZeit: "17:30",
      postenVormittag: 8,
      mittagsfenster: {
        von: "11:00",
        bis: "14:00",
        dauerMin: 45,
        teamsProWelle: 2,
        versatzMin: 15,
      },
    });
    expect(new Set(diff.map((a) => a.feld)).size).toBe(diff.length);
    expect(diff).toHaveLength(10);
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
