import { describe, it, expect, vi, beforeEach } from "vitest";

const uebernehmenMock = vi.hoisted(() => vi.fn());
vi.mock("./logo-import", () => ({ logoUebernehmen: uebernehmenMock }));

import { logoAufloesen } from "./team-logo";

beforeEach(() => {
  uebernehmenMock.mockReset();
});

describe("logoAufloesen", () => {
  it("macht ohne Eingabe gar nichts", async () => {
    for (const leer of [null, undefined, "", "   "]) {
      expect(await logoAufloesen(leer)).toEqual({ logoUrl: null, warnung: null });
    }
    expect(uebernehmenMock).not.toHaveBeenCalled();
  });

  it("schreibt den lokalen Pfad, wenn das Logo geholt werden konnte", async () => {
    uebernehmenMock.mockResolvedValue({ pfad: "/api/uploads/logo-abc.png" });

    expect(await logoAufloesen("https://meinplatz.ch/logo.png")).toEqual({
      logoUrl: "/api/uploads/logo-abc.png",
      warnung: null,
    });
  });

  it("blockiert das Speichern nicht, sondern behält die Adresse und warnt", async () => {
    uebernehmenMock.mockResolvedValue({ fehler: "Server antwortete mit 404" });

    const ergebnis = await logoAufloesen("https://firma.ch/weg.png");

    expect(ergebnis.logoUrl).toBe("https://firma.ch/weg.png");
    expect(ergebnis.warnung).toContain("Server antwortete mit 404");
    expect(ergebnis.warnung).toContain("Startnummer");
  });

  it("entfernt umschliessende Leerzeichen vor dem Holen", async () => {
    uebernehmenMock.mockResolvedValue({ pfad: "/api/uploads/logo-abc.png" });

    await logoAufloesen("  https://firma.ch/logo.png  ");

    expect(uebernehmenMock).toHaveBeenCalledWith("https://firma.ch/logo.png");
  });
});
