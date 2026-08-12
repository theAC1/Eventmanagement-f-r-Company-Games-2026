import { describe, expect, it } from "vitest";
import { loeschFolgen, pruefeLoeschen } from "./loesch-schutz";

describe("pruefeLoeschen", () => {
  it("erlaubt das Löschen ohne Hindernisse", () => {
    expect(pruefeLoeschen("Team Alpha", [])).toEqual({ erlaubt: true, grund: null });
    expect(
      pruefeLoeschen("Team Alpha", [{ was: "Ergebnisse", anzahl: 0 }]),
    ).toEqual({ erlaubt: true, grund: null });
  });

  it("benennt das Hindernis im Klartext", () => {
    const entscheid = pruefeLoeschen("Team Alpha", [
      { was: "Ergebnisse", anzahl: 3 },
    ]);
    expect(entscheid.erlaubt).toBe(false);
    expect(entscheid.grund).toContain("Team Alpha");
    expect(entscheid.grund).toContain("3 Ergebnisse");
  });

  it("fasst mehrere Hindernisse zusammen und lässt leere weg", () => {
    const entscheid = pruefeLoeschen("Cornhole", [
      { was: "Ergebnisse", anzahl: 2 },
      { was: "QR-Verifikationen", anzahl: 0 },
      { was: "Slot-Zuweisungen", anzahl: 5 },
    ]);
    expect(entscheid.grund).toContain("2 Ergebnisse und 5 Slot-Zuweisungen");
    expect(entscheid.grund).not.toContain("QR-Verifikationen");
  });

  it("übernimmt einen eigenen Hinweistext", () => {
    const entscheid = pruefeLoeschen(
      "Team Alpha",
      [{ was: "Ergebnisse", anzahl: 1 }],
      "Setze zuerst den Gameday zurück.",
    );
    expect(entscheid.grund).toContain("Setze zuerst den Gameday zurück.");
  });
});

describe("loeschFolgen", () => {
  it("listet nur, was tatsächlich mitgeht", () => {
    expect(
      loeschFolgen([
        { was: "Zeitplan-Einsätze", anzahl: 12 },
        { was: "Posten-Zuteilungen", anzahl: 0 },
      ]),
    ).toEqual(["12 Zeitplan-Einsätze werden mitgelöscht."]);
  });

  it("ist leer, wenn nichts verloren geht", () => {
    expect(loeschFolgen([{ was: "Einsätze", anzahl: 0 }])).toEqual([]);
  });
});
