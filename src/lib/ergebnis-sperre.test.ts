import { describe, it, expect } from "vitest";
import { KORREKTUR_FENSTER_MS, istGesperrt } from "./ergebnis-sperre";

describe("istGesperrt", () => {
  const base = new Date("2026-09-05T10:00:00Z");

  it("ohne eingetragenUm ist nichts gesperrt", () => {
    expect(istGesperrt(null)).toBe(false);
  });

  it("innerhalb der Frist nicht gesperrt", () => {
    const now = base.getTime() + KORREKTUR_FENSTER_MS - 1000;
    expect(istGesperrt(base, now)).toBe(false);
  });

  it("exakt an der Grenze noch nicht gesperrt", () => {
    const now = base.getTime() + KORREKTUR_FENSTER_MS;
    expect(istGesperrt(base, now)).toBe(false);
  });

  it("nach Ablauf der Frist gesperrt", () => {
    const now = base.getTime() + KORREKTUR_FENSTER_MS + 1;
    expect(istGesperrt(base, now)).toBe(true);
  });

  it("Frist beträgt 10 Minuten", () => {
    expect(KORREKTUR_FENSTER_MS).toBe(600_000);
  });
});
