import { describe, expect, it } from "vitest";
import { generateActivationCode } from "./activation-code";

describe("generateActivationCode", () => {
  it("liefert 12 Zeichen", () => {
    expect(generateActivationCode()).toHaveLength(12);
  });

  it("lässt verwechselbare Zeichen weg (I, O, l, 0, 1)", () => {
    const codes = Array.from({ length: 200 }, generateActivationCode).join("");
    expect(codes).not.toMatch(/[IOl01]/);
  });

  it("besteht nur aus erlaubten Zeichen", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateActivationCode()).toMatch(
        /^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789]{12}$/,
      );
    }
  });

  it("wiederholt sich praktisch nie", () => {
    const codes = new Set(Array.from({ length: 500 }, generateActivationCode));
    expect(codes.size).toBe(500);
  });
});
