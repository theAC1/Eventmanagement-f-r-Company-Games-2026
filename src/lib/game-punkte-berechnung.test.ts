import { describe, it, expect } from "vitest";
import {
  berechneGamePunkteAusRohdaten,
  berechneKleinbegegnungenStatistik,
  berechneTurmPunkte,
  berechneTuermeMaximum,
  parseKleinbegegnungen,
  parseRunden,
  parseTuerme,
} from "./game-punkte-berechnung";
import type { Wertungslogik } from "./wertungslogik-types";

// ─── berechneGamePunkteAusRohdaten ───

describe("berechneGamePunkteAusRohdaten", () => {
  it("sollte 0 liefern ohne Wertungslogik", () => {
    expect(berechneGamePunkteAusRohdaten({ x: 5 }, null)).toBe(0);
  });

  it("sollte 0 liefern bei unbekanntem Typ", () => {
    expect(berechneGamePunkteAusRohdaten({ x: 5 }, { typ: "gibts_nicht" })).toBe(0);
  });

  // ─── max_value (Kisten stapeln, Stack Attack) ───

  it("sollte max_value 1:1 als Punkte werten (Anzahl Kisten = Punktzahl)", () => {
    const wl: Wertungslogik = { typ: "max_value", messung: "anzahl_kisten" };
    expect(berechneGamePunkteAusRohdaten({ anzahl_kisten: 11 }, wl)).toBe(11);
  });

  it("sollte max_value ohne messung 0 liefern", () => {
    expect(berechneGamePunkteAusRohdaten({ anzahl_kisten: 11 }, { typ: "max_value" })).toBe(0);
  });

  // ─── zeit (Schwebendes Labyrinth, Lavabecken, Menschenkugelbahn) ───

  it("sollte zeit direkt übernehmen", () => {
    const wl: Wertungslogik = { typ: "zeit", richtung: "niedrigster_gewinnt", maxSekunden: 600 };
    expect(berechneGamePunkteAusRohdaten({ zeit_sekunden: 274 }, wl)).toBe(274);
  });

  it("sollte bei nicht_geschafft die Maximalzeit eintragen (Protokoll: 10:00)", () => {
    const wl: Wertungslogik = { typ: "zeit", maxSekunden: 600 };
    expect(
      berechneGamePunkteAusRohdaten({ zeit_sekunden: 512, nicht_geschafft: true }, wl),
    ).toBe(600);
  });

  it("sollte zeit über maxSekunden auf die Maximalzeit kappen", () => {
    const wl: Wertungslogik = { typ: "zeit", maxSekunden: 600 };
    expect(berechneGamePunkteAusRohdaten({ zeit_sekunden: 660 }, wl)).toBe(600);
  });

  it("sollte ohne maxSekunden den Alt-Sentinel 99999 für DNF nutzen", () => {
    const wl: Wertungslogik = { typ: "zeit" };
    expect(berechneGamePunkteAusRohdaten({ nicht_geschafft: true }, wl)).toBe(99999);
  });

  it("sollte Strafzeiten addieren", () => {
    const wl: Wertungslogik = { typ: "zeit", strafen: { fehler: 5 } };
    // 100 + 3×5 = 115
    expect(berechneGamePunkteAusRohdaten({ zeit_sekunden: 100, fehler: 3 }, wl)).toBe(115);
  });

  // ─── punkte_duell (Human Soccer) ───

  it("sollte punkte_duell das gesetzte Team-Feld werten", () => {
    const wl: Wertungslogik = {
      typ: "punkte_duell",
      eingabefelder: [{ name: "tore_team_a" }, { name: "tore_team_b" }],
    };
    expect(berechneGamePunkteAusRohdaten({ tore_team_a: 4 }, wl)).toBe(4);
    expect(berechneGamePunkteAusRohdaten({ tore_team_b: 2 }, wl)).toBe(2);
  });

  // ─── duell_kleinbegegnungen (Cornhole) ───

  it("sollte Cornhole-Score als Siegquote × G + Mittelwert berechnen", () => {
    const wl: Wertungslogik = { typ: "duell_kleinbegegnungen", gewichtungG: 40 };
    const rohdaten = {
      kleinbegegnungen: [
        { eigene: 16, gegner: 13 }, // Sieg
        { eigene: 10, gegner: 12 }, // Niederlage
      ],
    };
    // Siegquote 0.5 × 40 = 20; Mittelwert (16+10)/2 = 13 → 33
    expect(berechneGamePunkteAusRohdaten(rohdaten, wl)).toBe(33);
  });

  it("sollte den Default G=40 nutzen, wenn keine Gewichtung konfiguriert ist", () => {
    const wl: Wertungslogik = { typ: "duell_kleinbegegnungen" };
    const rohdaten = { kleinbegegnungen: [{ eigene: 16, gegner: 13 }] };
    // 1.0 × 40 + 16 = 56
    expect(berechneGamePunkteAusRohdaten(rohdaten, wl)).toBe(56);
  });

  it("sollte ein Unentschieden als halben Sieg werten (vorläufige Stechen-Regel)", () => {
    const wl: Wertungslogik = { typ: "duell_kleinbegegnungen", gewichtungG: 40 };
    const rohdaten = { kleinbegegnungen: [{ eigene: 14, gegner: 14 }] };
    // 0.5 × 40 + 14 = 34
    expect(berechneGamePunkteAusRohdaten(rohdaten, wl)).toBe(34);
  });

  it("sollte ohne Kleinbegegnungen 0 liefern", () => {
    const wl: Wertungslogik = { typ: "duell_kleinbegegnungen", gewichtungG: 40 };
    expect(berechneGamePunkteAusRohdaten({}, wl)).toBe(0);
    expect(berechneGamePunkteAusRohdaten({ kleinbegegnungen: [] }, wl)).toBe(0);
  });

  it("sollte mit anderem G anders gewichten (Leitstand-Justierung)", () => {
    const rohdaten = { kleinbegegnungen: [{ eigene: 16, gegner: 13 }] };
    const mitG5: Wertungslogik = { typ: "duell_kleinbegegnungen", gewichtungG: 5 };
    // 1.0 × 5 + 16 = 21
    expect(berechneGamePunkteAusRohdaten(rohdaten, mitG5)).toBe(21);
  });

  // ─── runden_strafpunkte (ChaosQuadrant) ───

  it("sollte Bälle und Strafpunkte über alle Runden addieren", () => {
    const wl: Wertungslogik = {
      typ: "runden_strafpunkte",
      richtung: "niedrigster_gewinnt",
      runden: 3,
    };
    const rohdaten = {
      runden: [
        { baelle: 8, strafpunkte: 1 },
        { baelle: 12, strafpunkte: 0 },
        { baelle: 5, strafpunkte: 2 },
      ],
    };
    // 9 + 12 + 7 = 28
    expect(berechneGamePunkteAusRohdaten(rohdaten, wl)).toBe(28);
  });

  it("sollte die 3/20-Lesart abbilden: 0 Bälle + 3 Fouls = 3 Punkte", () => {
    const wl: Wertungslogik = { typ: "runden_strafpunkte", richtung: "niedrigster_gewinnt" };
    const rohdaten = { runden: [{ baelle: 0, strafpunkte: 3 }] };
    expect(berechneGamePunkteAusRohdaten(rohdaten, wl)).toBe(3);
  });

  it("sollte ohne Runden 0 liefern", () => {
    const wl: Wertungslogik = { typ: "runden_strafpunkte" };
    expect(berechneGamePunkteAusRohdaten({}, wl)).toBe(0);
  });

  // ─── tuerme_punkte (Robert Huber Radio) ───

  const radioLogik: Wertungslogik = {
    typ: "tuerme_punkte",
    tuerme: [
      { name: "Turm 1", sektionen: 3, bonus: 0 },
      { name: "Turm 2", sektionen: 4, bonus: 2 },
      { name: "Turm 3", sektionen: 4, bonus: 3, bonusLabel: "Farbklötze" },
    ],
  };

  it("sollte das Protokoll-Maximum von 19 Punkten erreichen", () => {
    const rohdaten = {
      tuerme: [
        { sektionen: 3, bonus: 0 },
        { sektionen: 4, bonus: 2 },
        { sektionen: 4, bonus: 3 },
      ],
    };
    // (3+0+1) + (4+2+1) + (4+3+1) = 4 + 7 + 8 = 19
    expect(berechneGamePunkteAusRohdaten(rohdaten, radioLogik)).toBe(19);
  });

  it("sollte den 100%-Bonus nur bei vollständigem Turm vergeben", () => {
    const rohdaten = {
      tuerme: [
        { sektionen: 3, bonus: 0 }, // vollständig → 3+1 = 4
        { sektionen: 4, bonus: 1 }, // 1 Bonusklotz fehlt → 5, kein Bonus
        { sektionen: 2, bonus: 3 }, // 2 Sektionen fehlen → 5, kein Bonus
      ],
    };
    // 4 + 5 + 5 = 14
    expect(berechneGamePunkteAusRohdaten(rohdaten, radioLogik)).toBe(14);
  });

  it("sollte Eingaben über dem Turm-Maximum kappen", () => {
    const rohdaten = { tuerme: [{ sektionen: 99, bonus: 99 }] };
    const wl: Wertungslogik = {
      typ: "tuerme_punkte",
      tuerme: [{ name: "Turm 1", sektionen: 3, bonus: 0 }],
    };
    // gekappt auf 3+0, vollständig → +1 = 4
    expect(berechneGamePunkteAusRohdaten(rohdaten, wl)).toBe(4);
  });

  it("sollte fehlende Türme als 0 werten", () => {
    const rohdaten = { tuerme: [{ sektionen: 3, bonus: 0 }] };
    // Turm 1 vollständig (4), Turm 2 und 3 nicht erfasst (0)
    expect(berechneGamePunkteAusRohdaten(rohdaten, radioLogik)).toBe(4);
  });

  // ─── sieg_zuege (XXL Viergewinnt) ───

  it("sollte Siege dominant und Züge als Abzug werten", () => {
    const wl: Wertungslogik = { typ: "sieg_zuege", gewichtungSieg: 100 };
    // 2 Siege mit 10+13 Zügen: 200 − 23 = 177
    expect(berechneGamePunkteAusRohdaten({ siege: 2, zuege: 23 }, wl)).toBe(177);
  });

  it("sollte einen Verlierer nie über einen Sieger stellen", () => {
    const wl: Wertungslogik = { typ: "sieg_zuege", gewichtungSieg: 100 };
    const sieger = berechneGamePunkteAusRohdaten({ siege: 1, zuege: 21 }, wl); // 79
    const verlierer = berechneGamePunkteAusRohdaten({ siege: 0, zuege: 0 }, wl); // 0
    expect(sieger).toBeGreaterThan(verlierer);
  });

  it("sollte sieg_zuege nie negativ werten", () => {
    const wl: Wertungslogik = { typ: "sieg_zuege", gewichtungSieg: 100 };
    expect(berechneGamePunkteAusRohdaten({ siege: 0, zuege: 7 }, wl)).toBe(0);
  });
});

// ─── berechneKleinbegegnungenStatistik ───

describe("berechneKleinbegegnungenStatistik", () => {
  it("sollte leere Liste als Nullwerte liefern", () => {
    expect(berechneKleinbegegnungenStatistik([])).toEqual({
      gespielt: 0,
      siege: 0,
      siegquote: 0,
      mittelwert: 0,
    });
  });

  it("sollte Siege, Quote und Mittelwert berechnen", () => {
    const statistik = berechneKleinbegegnungenStatistik([
      { eigene: 16, gegner: 13 }, // Sieg
      { eigene: 10, gegner: 12 }, // Niederlage
      { eigene: 14, gegner: 14 }, // Unentschieden = 0.5
    ]);
    expect(statistik.gespielt).toBe(3);
    expect(statistik.siege).toBe(1.5);
    expect(statistik.siegquote).toBeCloseTo(0.5);
    // (16+10+14)/3 = 13.33…
    expect(statistik.mittelwert).toBeCloseTo(13.3333, 3);
  });
});

// ─── berechneTurmPunkte / berechneTuermeMaximum ───

describe("berechneTurmPunkte", () => {
  it("sollte Sektionen und Bonus addieren, 100%-Bonus nur bei Vollständigkeit", () => {
    const config = { sektionen: 4, bonus: 2 };
    expect(berechneTurmPunkte({ sektionen: 4, bonus: 2 }, config)).toBe(7); // voll: 4+2+1
    expect(berechneTurmPunkte({ sektionen: 4, bonus: 1 }, config)).toBe(5);
    expect(berechneTurmPunkte({ sektionen: 0, bonus: 0 }, config)).toBe(0);
  });
});

describe("berechneTuermeMaximum", () => {
  it("sollte für Robert Huber Radio 19 ergeben", () => {
    expect(
      berechneTuermeMaximum([
        { sektionen: 3, bonus: 0 },
        { sektionen: 4, bonus: 2 },
        { sektionen: 4, bonus: 3 },
      ]),
    ).toBe(19);
  });
});

// ─── Rohdaten-Parser ───

describe("parseKleinbegegnungen", () => {
  it("sollte fehlende oder kaputte Daten defensiv verwerfen", () => {
    expect(parseKleinbegegnungen({})).toEqual([]);
    expect(parseKleinbegegnungen({ kleinbegegnungen: "quatsch" })).toEqual([]);
    expect(
      parseKleinbegegnungen({ kleinbegegnungen: [{ eigene: "16", gegner: -2 }, null] }),
    ).toEqual([{ eigene: 16, gegner: 0 }]);
  });
});

describe("parseRunden", () => {
  it("sollte Zahlen koerzieren und Negatives auf 0 setzen", () => {
    expect(parseRunden({ runden: [{ baelle: "8", strafpunkte: -1 }] })).toEqual([
      { baelle: 8, strafpunkte: 0 },
    ]);
  });
});

describe("parseTuerme", () => {
  it("sollte Nicht-Objekte herausfiltern", () => {
    expect(parseTuerme({ tuerme: [{ sektionen: 2, bonus: 1 }, 7, null] })).toEqual([
      { sektionen: 2, bonus: 1 },
    ]);
  });
});
