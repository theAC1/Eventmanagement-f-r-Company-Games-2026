import { describe, it, expect } from "vitest";
import { generateUniqueCheckinCode } from "./checkin-code";

describe("generateUniqueCheckinCode", () => {
  it("sollte 3-Zeichen Code im Format BZB generieren", () => {
    const code = generateUniqueCheckinCode(new Set());
    expect(code).toMatch(/^[A-Z][2-9][A-Z]$/);
    expect(code).toHaveLength(3);
  });

  it("sollte keine verwechselbaren Zeichen enthalten (I, O, 0, 1)", () => {
    // Generiere viele Codes und prüfe
    for (let i = 0; i < 100; i++) {
      const code = generateUniqueCheckinCode(new Set());
      expect(code).not.toMatch(/[IO01]/);
    }
  });

  it("sollte einzigartige Codes generieren", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const code = generateUniqueCheckinCode(codes);
      expect(codes.has(code)).toBe(false);
      codes.add(code);
    }
    expect(codes.size).toBe(50);
  });

  it("sollte bestehende Codes vermeiden", () => {
    const existing = new Set(["A2B", "C3D", "E4F"]);
    const code = generateUniqueCheckinCode(existing);
    expect(existing.has(code)).toBe(false);
  });

  it("sollte Error werfen wenn zu viele Versuche", () => {
    // Alle möglichen Codes als "belegt" markieren (simuliert)
    const allCodes = new Set<string>();
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const digits = "23456789";
    for (const l1 of letters) {
      for (const d of digits) {
        for (const l2 of letters) {
          allCodes.add(`${l1}${d}${l2}`);
        }
      }
    }

    expect(() => generateUniqueCheckinCode(allCodes)).toThrow("Zu viele Versuche");
  });
});
