import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimits } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("erlaubt Versuche unterhalb des Limits", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("ip:1", { max: 5, windowMs: 1000, now: 100 + i })).toBe(true);
    }
  });

  it("blockiert nach Erreichen des Limits", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit("ip:2", { max: 3, windowMs: 1000, now: 100 + i });
    }
    expect(checkRateLimit("ip:2", { max: 3, windowMs: 1000, now: 200 })).toBe(false);
  });

  it("gibt Versuche nach Ablauf des Fensters wieder frei", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit("ip:3", { max: 3, windowMs: 1000, now: 100 + i });
    }
    expect(checkRateLimit("ip:3", { max: 3, windowMs: 1000, now: 200 })).toBe(false);
    expect(checkRateLimit("ip:3", { max: 3, windowMs: 1000, now: 1500 })).toBe(true);
  });

  it("zählt Keys unabhängig voneinander", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit("ip:4", { max: 3, windowMs: 1000, now: 100 + i });
    }
    expect(checkRateLimit("ip:4", { max: 3, windowMs: 1000, now: 200 })).toBe(false);
    expect(checkRateLimit("ip:5", { max: 3, windowMs: 1000, now: 200 })).toBe(true);
  });
});
