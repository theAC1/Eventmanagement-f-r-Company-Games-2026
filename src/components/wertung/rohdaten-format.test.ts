import { describe, it, expect } from "vitest";
import { formatRohdaten } from "./rohdaten-format";
import { formatSekundenMSS } from "./format";
import type { Wertungslogik } from "@/lib/wertungslogik-types";

describe("formatSekundenMSS", () => {
  it("formatiert Sekunden als m:ss", () => {
    expect(formatSekundenMSS(600)).toBe("10:00");
    expect(formatSekundenMSS(95)).toBe("1:35");
    expect(formatSekundenMSS(45)).toBe("0:45");
  });
});

describe("formatRohdaten", () => {
  it("zeit: m:ss, Maximalzeit bei nicht_geschafft, 99999 als DNF", () => {
    const wl: Wertungslogik = { typ: "zeit", maxSekunden: 600 };
    expect(formatRohdaten({ zeit_sekunden: 95 }, wl)).toEqual([
      { label: "Zeit", value: "1:35 min" },
    ]);
    expect(formatRohdaten({ nicht_geschafft: true }, wl)).toEqual([
      { label: "Zeit", value: "10:00 · nicht geschafft" },
    ]);
    expect(formatRohdaten({ zeit_sekunden: 99999 }, { typ: "zeit" })).toEqual([
      { label: "Zeit", value: "DNF" },
    ]);
  });

  it("duell_kleinbegegnungen: eine Zeile pro Begegnung", () => {
    const wl: Wertungslogik = { typ: "duell_kleinbegegnungen" };
    expect(
      formatRohdaten(
        { kleinbegegnungen: [{ eigene: 16, gegner: 13 }, { eigene: 8, gegner: 8 }] },
        wl,
      ),
    ).toEqual([
      { label: "Begegnung 1", value: "16 : 13" },
      { label: "Begegnung 2", value: "8 : 8" },
    ]);
  });

  it("runden_strafpunkte: Runden-Zeilen plus Total", () => {
    const wl: Wertungslogik = { typ: "runden_strafpunkte", runden: 2 };
    expect(
      formatRohdaten(
        {
          runden: [
            { baelle: 3, strafpunkte: 1 },
            { baelle: 0, strafpunkte: 2 },
          ],
        },
        wl,
      ),
    ).toEqual([
      { label: "Runde 1", value: "3 Bälle · 1 Strafpunkte" },
      { label: "Runde 2", value: "0 Bälle · 2 Strafpunkte" },
      { label: "Total", value: "6 Punkte" },
    ]);
  });

  it("tuerme_punkte: Teilpunkte inkl. 100%-Bonus und Total", () => {
    const wl: Wertungslogik = {
      typ: "tuerme_punkte",
      tuerme: [
        { name: "Turm 1", sektionen: 3, bonus: 0 },
        { name: "Turm 3", sektionen: 4, bonus: 3, bonusLabel: "Farbklötze" },
      ],
    };
    expect(
      formatRohdaten(
        {
          tuerme: [
            { sektionen: 3, bonus: 0 },
            { sektionen: 2, bonus: 1 },
          ],
        },
        wl,
      ),
    ).toEqual([
      { label: "Turm 1", value: "3/3 Sektionen → 4 P" },
      { label: "Turm 3", value: "2/4 Sektionen · 1/3 Farbklötze → 3 P" },
      { label: "Total", value: "7 / 12 P" },
    ]);
  });

  it("sieg_zuege: Werte über die Eingabefelder, auch 0", () => {
    const wl: Wertungslogik = {
      typ: "sieg_zuege",
      eingabefelder: [
        { name: "siege", typ: "number", label: "Gewonnene Partien" },
        { name: "zuege", typ: "number", label: "Züge (Summe)" },
      ],
    };
    expect(formatRohdaten({ siege: 0, zuege: 0 }, wl)).toEqual([
      { label: "Gewonnene Partien", value: "0" },
      { label: "Züge (Summe)", value: "0" },
    ]);
  });
});
