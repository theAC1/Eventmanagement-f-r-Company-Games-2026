import { describe, it, expect } from "vitest";
import { hatMinimumDaten } from "./minimum-daten";
import type { Wertungslogik } from "@/lib/wertungslogik-types";

describe("hatMinimumDaten", () => {
  it("punkte_duell: ein gesetztes Team-Feld genügt (auch Team B)", () => {
    const wl: Wertungslogik = {
      typ: "punkte_duell",
      eingabefelder: [{ name: "tore_team_a" }, { name: "tore_team_b" }],
    };
    expect(hatMinimumDaten(wl, {})).toBe(false);
    expect(hatMinimumDaten(wl, { tore_team_a: 3 })).toBe(true);
    expect(hatMinimumDaten(wl, { tore_team_b: 2 })).toBe(true);
    expect(hatMinimumDaten({ typ: "punkte_duell" }, {})).toBe(true);
  });

  it("duell_kleinbegegnungen: mindestens ein Eintrag nötig", () => {
    const wl: Wertungslogik = { typ: "duell_kleinbegegnungen" };
    expect(hatMinimumDaten(wl, {})).toBe(false);
    expect(hatMinimumDaten(wl, { kleinbegegnungen: [] })).toBe(false);
    expect(
      hatMinimumDaten(wl, { kleinbegegnungen: [{ eigene: 16, gegner: 13 }] }),
    ).toBe(true);
  });

  it("runden_strafpunkte: Runden-Array in exakt konfigurierter Länge nötig", () => {
    const wl: Wertungslogik = { typ: "runden_strafpunkte", runden: 3 };
    expect(hatMinimumDaten(wl, {})).toBe(false);
    expect(
      hatMinimumDaten(wl, { runden: [{ baelle: 1, strafpunkte: 0 }] }),
    ).toBe(false);
    expect(
      hatMinimumDaten(wl, {
        runden: [
          { baelle: 0, strafpunkte: 0 },
          { baelle: 2, strafpunkte: 1 },
          { baelle: 3, strafpunkte: 0 },
        ],
      }),
    ).toBe(true);
    expect(
      hatMinimumDaten(wl, {
        runden: Array.from({ length: 4 }, () => ({ baelle: 0, strafpunkte: 0 })),
      }),
    ).toBe(false);
  });

  it("tuerme_punkte: genau ein Eintrag pro konfiguriertem Turm nötig", () => {
    const wl: Wertungslogik = {
      typ: "tuerme_punkte",
      tuerme: [{ name: "Turm 1", sektionen: 3, bonus: 0 }],
    };
    expect(hatMinimumDaten(wl, {})).toBe(false);
    expect(hatMinimumDaten(wl, { tuerme: [] })).toBe(false);
    expect(hatMinimumDaten(wl, { tuerme: [{ sektionen: 0, bonus: 0 }] })).toBe(true);
    // Ohne Turm-Config bleibt das Bestandsverhalten (Array genügt)
    expect(hatMinimumDaten({ typ: "tuerme_punkte" }, { tuerme: [] })).toBe(true);
    expect(hatMinimumDaten({ typ: "tuerme_punkte" }, {})).toBe(false);
  });

  it("sieg_zuege: beide Schlüssel müssen vorhanden sein (0 zählt)", () => {
    const wl: Wertungslogik = { typ: "sieg_zuege" };
    expect(hatMinimumDaten(wl, {})).toBe(false);
    expect(hatMinimumDaten(wl, { siege: 1 })).toBe(false);
    expect(hatMinimumDaten(wl, { siege: 0, zuege: 0 })).toBe(true);
  });

  it("zeit: Zeit > 0 oder nicht_geschafft nötig", () => {
    const wl: Wertungslogik = { typ: "zeit", maxSekunden: 600 };
    expect(hatMinimumDaten(wl, {})).toBe(false);
    expect(hatMinimumDaten(wl, { zeit_sekunden: 0 })).toBe(false);
    expect(hatMinimumDaten(wl, { zeit_sekunden: 95 })).toBe(true);
    expect(hatMinimumDaten(wl, { nicht_geschafft: true })).toBe(true);
  });

  it("bestehende Typen bleiben unverändert prüfbar", () => {
    expect(hatMinimumDaten({ typ: "multi_level" }, {})).toBe(false);
    expect(hatMinimumDaten({ typ: "multi_level" }, { level: "leicht" })).toBe(true);
    expect(
      hatMinimumDaten({ typ: "risiko_wahl" }, { option: "2m", erfolg: false }),
    ).toBe(true);
    expect(hatMinimumDaten({ typ: "unbekannt" }, {})).toBe(true);
  });
});
