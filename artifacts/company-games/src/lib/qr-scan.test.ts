import { describe, it, expect } from "vitest";
import {
  parseQrToken,
  resolveScanResult,
  applyScannedTeam,
  QR_NOT_FOUND_ERROR,
} from "./qr-scan";

describe("parseQrToken", () => {
  it("extrahiert Token aus Portal-URL …/team/<token>", () => {
    expect(parseQrToken("https://cg26.example.com/team/abc123")).toBe("abc123");
  });

  it("extrahiert Token aus URL mit ?token=", () => {
    expect(parseQrToken("https://cg26.example.com/checkin?token=xyz789")).toBe("xyz789");
  });

  it("nimmt letzten Pfad-Teil einer URL ohne token-Param", () => {
    expect(parseQrToken("https://cg26.example.com/portal/tok42")).toBe("tok42");
  });

  it("gibt Rohwert (getrimmt) zurück, wenn keine URL", () => {
    expect(parseQrToken("  rawtoken  ")).toBe("rawtoken");
  });
});

describe("resolveScanResult", () => {
  it("löst ein verifiziertes Team auf", () => {
    expect(resolveScanResult({ verified: true, teamId: "team-7" })).toEqual({
      ok: true,
      teamId: "team-7",
    });
  });

  it("meldet Fehler bei nicht verifiziertem QR-Code", () => {
    expect(resolveScanResult({ verified: false, teamId: "team-7" })).toEqual({
      ok: false,
      error: QR_NOT_FOUND_ERROR,
    });
  });

  it("meldet Fehler ohne teamId (unbekannter Code)", () => {
    expect(resolveScanResult({ verified: true })).toEqual({
      ok: false,
      error: QR_NOT_FOUND_ERROR,
    });
  });

  it("meldet Fehler bei null (HTTP-Fehler)", () => {
    expect(resolveScanResult(null)).toEqual({
      ok: false,
      error: QR_NOT_FOUND_ERROR,
    });
  });
});

describe("applyScannedTeam", () => {
  const empty = { selectedTeamId: "", selectedTeamId2: "" };

  it("setzt Team A beim Ziel A und lässt Team B unberührt", () => {
    const next = applyScannedTeam({ selectedTeamId: "", selectedTeamId2: "b" }, "A", "a-team");
    expect(next).toEqual({ selectedTeamId: "a-team", selectedTeamId2: "b" });
  });

  it("setzt Team B beim Ziel B und lässt Team A unberührt", () => {
    const next = applyScannedTeam({ selectedTeamId: "a", selectedTeamId2: "" }, "B", "b-team");
    expect(next).toEqual({ selectedTeamId: "a", selectedTeamId2: "b-team" });
  });

  it("behandelt null-Ziel als Team A (Solo-Modus)", () => {
    expect(applyScannedTeam(empty, null, "solo-team")).toEqual({
      selectedTeamId: "solo-team",
      selectedTeamId2: "",
    });
  });
});
