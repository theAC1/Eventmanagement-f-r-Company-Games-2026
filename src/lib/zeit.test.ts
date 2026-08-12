import { describe, expect, it } from "vitest";
import { formatDauer, formatZeit, parseZeit, ueberlappt } from "./zeit";

describe("parseZeit", () => {
  it("rechnet HH:MM in Minuten ab Mitternacht um", () => {
    expect(parseZeit("00:00")).toBe(0);
    expect(parseZeit("09:30")).toBe(570);
    expect(parseZeit("9:05")).toBe(545);
  });

  it("erlaubt Zeiten über Mitternacht hinaus", () => {
    expect(parseZeit("24:15")).toBe(1455);
  });

  it("liefert NaN statt still 0 bei Unsinn", () => {
    expect(parseZeit("halb zehn")).toBeNaN();
    expect(parseZeit("09:70")).toBeNaN();
    expect(parseZeit("")).toBeNaN();
  });
});

describe("formatZeit", () => {
  it("füllt auf zwei Stellen auf", () => {
    expect(formatZeit(570)).toBe("09:30");
    expect(formatZeit(0)).toBe("00:00");
  });

  it("läuft über 24 Uhr weiter statt umzubrechen", () => {
    expect(formatZeit(1455)).toBe("24:15");
  });

  it("klemmt negative Werte auf 00:00", () => {
    expect(formatZeit(-30)).toBe("00:00");
  });
});

describe("ueberlappt", () => {
  it("erkennt echte Überschneidungen", () => {
    expect(ueberlappt(600, 620, 610, 640)).toBe(true);
  });

  it("berührende Intervalle überlappen nicht", () => {
    expect(ueberlappt(600, 620, 620, 640)).toBe(false);
    expect(ueberlappt(620, 640, 600, 620)).toBe(false);
  });
});

describe("formatDauer", () => {
  it("schreibt Stunden und Minuten lesbar", () => {
    expect(formatDauer(45)).toBe("45 min");
    expect(formatDauer(60)).toBe("1 h");
    expect(formatDauer(105)).toBe("1 h 45 min");
  });
});
