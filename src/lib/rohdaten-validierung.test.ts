import { describe, it, expect } from "vitest";
import { validiereRohdaten } from "./rohdaten-validierung";
import type { Wertungslogik } from "./wertungslogik-types";

describe("validiereRohdaten", () => {
  // ─── Basisverhalten ───

  it("sollte ohne Wertungslogik alles akzeptieren", () => {
    expect(validiereRohdaten(null, {})).toEqual({ ok: true });
  });

  it("sollte unbekannte und flache Typen tolerant durchlassen", () => {
    expect(validiereRohdaten({ typ: "unbekannt" }, {})).toEqual({ ok: true });
    expect(validiereRohdaten({ typ: "max_value" }, {})).toEqual({ ok: true });
  });

  // ─── zeit ───

  it("sollte zeit ohne Daten ablehnen (0 Sekunden wären sonst Bestzeit)", () => {
    const wl: Wertungslogik = { typ: "zeit", maxSekunden: 600 };
    expect(validiereRohdaten(wl, {})).toEqual({
      ok: false,
      fehler: "Zeit erfassen oder «Nicht geschafft» wählen",
    });
    expect(validiereRohdaten(wl, { zeit_sekunden: 0 })).toEqual({
      ok: false,
      fehler: "Zeit erfassen oder «Nicht geschafft» wählen",
    });
  });

  it("sollte zeit mit erfasster Zeit akzeptieren", () => {
    const wl: Wertungslogik = { typ: "zeit", maxSekunden: 600 };
    expect(validiereRohdaten(wl, { zeit_sekunden: 95 })).toEqual({ ok: true });
    expect(validiereRohdaten(wl, { durchgang_1: 42 })).toEqual({ ok: true });
  });

  it("sollte zeit mit DNF akzeptieren", () => {
    const wl: Wertungslogik = { typ: "zeit", maxSekunden: 600 };
    expect(validiereRohdaten(wl, { nicht_geschafft: true })).toEqual({ ok: true });
    expect(validiereRohdaten(wl, { geschafft: false })).toEqual({ ok: true });
  });

  it("sollte Legacy-zeit mit eigenen Eingabefeldern ungeprüft durchlassen", () => {
    const wl: Wertungslogik = {
      typ: "zeit",
      eingabefelder: [{ name: "durchgang_1", typ: "number" }],
    };
    expect(validiereRohdaten(wl, {})).toEqual({ ok: true });
  });

  // ─── duell_kleinbegegnungen ───

  it("sollte duell_kleinbegegnungen mit mindestens einer Begegnung akzeptieren", () => {
    const wl: Wertungslogik = { typ: "duell_kleinbegegnungen" };
    expect(
      validiereRohdaten(wl, { kleinbegegnungen: [{ eigene: 16, gegner: 13 }] }),
    ).toEqual({ ok: true });
  });

  it("sollte duell_kleinbegegnungen ohne oder mit ungültigen Begegnungen ablehnen", () => {
    const wl: Wertungslogik = { typ: "duell_kleinbegegnungen" };
    expect(validiereRohdaten(wl, {}).ok).toBe(false);
    expect(validiereRohdaten(wl, { kleinbegegnungen: [] }).ok).toBe(false);
    expect(
      validiereRohdaten(wl, { kleinbegegnungen: [{ eigene: -1, gegner: 3 }] }).ok,
    ).toBe(false);
  });

  // ─── runden_strafpunkte ───

  it("sollte runden_strafpunkte mit genau konfigurierter Rundenzahl akzeptieren", () => {
    const wl: Wertungslogik = { typ: "runden_strafpunkte", runden: 3 };
    expect(
      validiereRohdaten(wl, {
        runden: [
          { baelle: 4, strafpunkte: 1 },
          { baelle: 2, strafpunkte: 0 },
          { baelle: 0, strafpunkte: 3 },
        ],
      }),
    ).toEqual({ ok: true });
  });

  it("sollte ein Null-Ergebnis (alle Werte 0) als gültig akzeptieren", () => {
    const wl: Wertungslogik = { typ: "runden_strafpunkte", runden: 3 };
    expect(
      validiereRohdaten(wl, {
        runden: [
          { baelle: 0, strafpunkte: 0 },
          { baelle: 0, strafpunkte: 0 },
          { baelle: 0, strafpunkte: 0 },
        ],
      }),
    ).toEqual({ ok: true });
  });

  it("sollte runden_strafpunkte mit abweichender Rundenzahl ablehnen", () => {
    const wl: Wertungslogik = { typ: "runden_strafpunkte", runden: 3 };
    expect(
      validiereRohdaten(wl, { runden: [{ baelle: 1, strafpunkte: 0 }] }),
    ).toEqual({ ok: false, fehler: "Genau 3 Runden erfassen" });
    expect(
      validiereRohdaten(wl, {
        runden: Array.from({ length: 4 }, () => ({ baelle: 0, strafpunkte: 0 })),
      }),
    ).toEqual({ ok: false, fehler: "Genau 3 Runden erfassen" });
  });

  it("sollte runden_strafpunkte mit negativen Werten ablehnen", () => {
    const wl: Wertungslogik = { typ: "runden_strafpunkte", runden: 3 };
    expect(
      validiereRohdaten(wl, {
        runden: [
          { baelle: -2, strafpunkte: 0 },
          { baelle: 0, strafpunkte: 0 },
          { baelle: 0, strafpunkte: 0 },
        ],
      }).ok,
    ).toBe(false);
  });

  it("sollte runden_strafpunkte ohne konfigurierte Rundenzahl mindestens eine Runde verlangen", () => {
    const wl: Wertungslogik = { typ: "runden_strafpunkte" };
    expect(
      validiereRohdaten(wl, { runden: [{ baelle: 1, strafpunkte: 0 }] }),
    ).toEqual({ ok: true });
    expect(validiereRohdaten(wl, { runden: [] }).ok).toBe(false);
  });

  // ─── tuerme_punkte ───

  it("sollte tuerme_punkte mit genau einem Eintrag pro konfiguriertem Turm akzeptieren", () => {
    const wl: Wertungslogik = {
      typ: "tuerme_punkte",
      tuerme: [
        { name: "Turm 1", sektionen: 3, bonus: 2 },
        { name: "Turm 2", sektionen: 4, bonus: 1 },
      ],
    };
    expect(
      validiereRohdaten(wl, {
        tuerme: [
          { sektionen: 3, bonus: 2 },
          { sektionen: 0, bonus: 0 },
        ],
      }),
    ).toEqual({ ok: true });
  });

  it("sollte tuerme_punkte mit abweichender Anzahl ablehnen", () => {
    const wl: Wertungslogik = {
      typ: "tuerme_punkte",
      tuerme: [
        { name: "Turm 1", sektionen: 3, bonus: 2 },
        { name: "Turm 2", sektionen: 4, bonus: 1 },
      ],
    };
    expect(
      validiereRohdaten(wl, { tuerme: [{ sektionen: 3, bonus: 2 }] }),
    ).toEqual({ ok: false, fehler: "Genau 2 Türme erfassen" });
    expect(validiereRohdaten(wl, {}).ok).toBe(false);
  });

  it("sollte tuerme_punkte mit negativen Werten ablehnen", () => {
    const wl: Wertungslogik = {
      typ: "tuerme_punkte",
      tuerme: [{ name: "Turm 1", sektionen: 3, bonus: 2 }],
    };
    expect(
      validiereRohdaten(wl, { tuerme: [{ sektionen: -1, bonus: 0 }] }).ok,
    ).toBe(false);
  });

  // ─── sieg_zuege ───

  it("sollte sieg_zuege mit beiden Schlüsseln akzeptieren (0 zählt)", () => {
    const wl: Wertungslogik = { typ: "sieg_zuege" };
    expect(validiereRohdaten(wl, { siege: 0, zuege: 0 })).toEqual({ ok: true });
    expect(validiereRohdaten(wl, { siege: 2, zuege: 17 })).toEqual({ ok: true });
  });

  it("sollte sieg_zuege mit fehlenden Schlüsseln ablehnen", () => {
    const wl: Wertungslogik = { typ: "sieg_zuege" };
    expect(validiereRohdaten(wl, {}).ok).toBe(false);
    expect(validiereRohdaten(wl, { siege: 2 }).ok).toBe(false);
  });
});
