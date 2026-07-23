import { describe, it, expect } from "vitest";
import { upsertEntry, isRetryableStatus, type PendingErgebnis } from "./offline-queue";

function entry(overrides: Partial<PendingErgebnis>): PendingErgebnis {
  return {
    commitId: "c1",
    gameId: "g1",
    teamId: "t1",
    zeitplanSlotId: null,
    gameName: "Game",
    teamName: "Team",
    rohdaten: {},
    createdAt: 1,
    attempts: 0,
    ...overrides,
  };
}

describe("upsertEntry", () => {
  it("hängt neue Einträge an", () => {
    const q = upsertEntry([], entry({ commitId: "a" }));
    expect(q).toHaveLength(1);
  });

  it("ersetzt bestehenden Eintrag für dasselbe Game/Team (der neuste gewinnt)", () => {
    const q1 = upsertEntry([], entry({ commitId: "a", rohdaten: { wert: 1 } }));
    const q2 = upsertEntry(q1, entry({ commitId: "b", rohdaten: { wert: 2 } }));
    expect(q2).toHaveLength(1);
    expect(q2[0].commitId).toBe("b");
    expect(q2[0].rohdaten).toEqual({ wert: 2 });
  });

  it("lässt Einträge anderer Games/Teams unangetastet", () => {
    const q1 = upsertEntry([], entry({ commitId: "a", teamId: "t1" }));
    const q2 = upsertEntry(q1, entry({ commitId: "b", teamId: "t2" }));
    expect(q2).toHaveLength(2);
  });
});

describe("isRetryableStatus", () => {
  it("Timeout, Rate-Limit und Serverfehler sind retry-sicher", () => {
    expect(isRetryableStatus(408)).toBe(true);
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
  });

  it("Client-Fehler sind endgültig", () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(403)).toBe(false);
    expect(isRetryableStatus(409)).toBe(false);
  });
});
