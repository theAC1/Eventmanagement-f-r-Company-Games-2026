import { describe, it, expect } from "vitest";
import { wrapLines, ellipsize, badgeHeight, CARD_W } from "./badge-canvas";

/** Einfache Messfunktion: jedes Zeichen 10 Einheiten breit. */
const measure = (s: string) => s.length * 10;

describe("ellipsize", () => {
  it("lässt passenden Text unverändert", () => {
    expect(ellipsize("kurz", 100, measure)).toBe("kurz");
  });

  it("kürzt zu langen Text mit Auslassungszeichen", () => {
    const result = ellipsize("viel zu langer text", 60, measure);
    expect(result.endsWith("…")).toBe(true);
    expect(measure(result)).toBeLessThanOrEqual(60);
  });
});

describe("wrapLines", () => {
  it("gibt für leeren Text keine Zeile zurück", () => {
    expect(wrapLines("", 200, 2, measure)).toEqual([]);
    expect(wrapLines("   ", 200, 2, measure)).toEqual([]);
  });

  it("lässt kurzen Text auf einer Zeile", () => {
    expect(wrapLines("Alesa AG", 200, 2, measure)).toEqual(["Alesa AG"]);
  });

  it("bricht auf mehrere Zeilen um", () => {
    const lines = wrapLines("aaa bbb ccc", 70, 2, measure);
    expect(lines.length).toBeGreaterThan(1);
  });

  it("überschreitet die Zeilenzahl nie", () => {
    const lines = wrapLines("eins zwei drei vier fünf sechs sieben acht", 80, 2, measure);
    expect(lines.length).toBeLessThanOrEqual(2);
  });

  it("deutet abgeschnittenen Rest in der letzten Zeile an", () => {
    const lines = wrapLines("eins zwei drei vier fünf sechs sieben acht", 80, 2, measure);
    expect(lines[lines.length - 1].endsWith("…")).toBe(true);
  });

  it("kürzt auch ein einzelnes überlanges Wort ohne Leerzeichen", () => {
    const lines = wrapLines("Donaudampfschifffahrtsgesellschaft", 100, 2, measure);
    expect(lines).toHaveLength(1);
    expect(lines[0].endsWith("…")).toBe(true);
  });

  it("hält jede Zeile innerhalb der Breite (ausser im Degenerationsfall)", () => {
    const lines = wrapLines("Die Aargauische Gebäudeversicherung", 200, 2, measure);
    for (const line of lines) {
      expect(measure(line)).toBeLessThanOrEqual(200);
    }
  });
});

describe("badgeHeight", () => {
  it("wächst mit zusätzlichen Namenszeilen", () => {
    expect(badgeHeight(2, 0)).toBeGreaterThan(badgeHeight(1, 0));
  });

  it("wächst mit einem Motto", () => {
    expect(badgeHeight(1, 1)).toBeGreaterThan(badgeHeight(1, 0));
  });

  it("liefert eine plausible Druckhöhe für die 380px-Vorlage", () => {
    const h = badgeHeight(1, 1);
    expect(h).toBeGreaterThan(CARD_W); // Badge ist hochformatig
    expect(h).toBeLessThan(900);
  });
});
