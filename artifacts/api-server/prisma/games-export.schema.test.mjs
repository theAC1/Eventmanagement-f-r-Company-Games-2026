import { describe, it, expect } from "vitest";
import { GamesExport, findeKaputteReferenzen } from "./games-export.schema.mjs";

/** Realistischer Export, wie ihn scripts/export-games.sql (Homelab) erzeugt. */
function gueltigerExport() {
  return {
    schemaVersion: 1,
    exportedAt: "2026-08-06T10:00:00Z",
    games: [
      {
        name: "Präzisionswurf", slug: "praezisionswurf", typ: "RETURNEE", status: "BEREIT",
        kurzbeschreibung: "Wurf auf Ziele", modus: "SOLO", teamsProSlot: 1,
        einfuehrungMin: 3, playtimeMin: 10, reserveMin: 2,
        regeln: "Drei Würfe.", wertungstyp: "PUNKTE",
        wertungslogik: { max: 30, richtung: "hoch" },
        flaecheLaengeM: 12.5, flaecheBreiteM: 8, helferAnzahl: 2,
        schiedsrichterAnzahl: 1, stromNoetig: false,
        varianten: [{ name: "Kurz", beschreibung: null, istAktiv: true }],
      },
      {
        name: "Zeitparcours", slug: "zeitparcours", typ: "NEU", status: "ENTWURF",
        kurzbeschreibung: null, modus: "DUELL", teamsProSlot: 2,
        einfuehrungMin: 5, playtimeMin: 15, reserveMin: 3,
        regeln: null, wertungstyp: null, wertungslogik: null,
        flaecheLaengeM: null, flaecheBreiteM: null, helferAnzahl: 1,
        schiedsrichterAnzahl: 1, stromNoetig: true,
        varianten: [],
      },
    ],
    material: [
      {
        gameSlug: "praezisionswurf", name: "Wurfringe", kategorie: "KAUF", menge: "20 Stk",
        beschreibung: null, status: "BESTAETIGT", sponsor: null,
        kostenGeschaetzt: 149.5, kostenEffektiv: null,
      },
    ],
    plaene: [
      {
        name: "Hauptplan", hintergrundbildUrl: "/uploads/plan.png", massstab: 1.5, istAktiv: true,
        gamePositionen: [
          { gameSlug: "praezisionswurf", x: 100.5, y: 200, rotation: 0, nummer: "1", oeffentlich: true },
        ],
        customFelder: [
          {
            label: "Festzelt", nummer: "", farbe: "#ff0000", breiteM: 20, laengeM: 10,
            x: 5, y: 5, rotation: 45, oeffentlich: true,
          },
        ],
      },
    ],
  };
}

describe("GamesExport", () => {
  it("akzeptiert einen vollständigen Export", () => {
    const result = GamesExport.safeParse(gueltigerExport());
    expect(result.success).toBe(true);
  });

  it("erhält wertungslogik als beliebiges JSON", () => {
    const data = GamesExport.parse(gueltigerExport());
    expect(data.games[0].wertungslogik).toEqual({ max: 30, richtung: "hoch" });
  });

  it("setzt Defaults, wenn optionale Felder fehlen", () => {
    const roh = gueltigerExport();
    delete roh.games[1].varianten;
    delete roh.material[0].sponsor;
    delete roh.plaene[0].customFelder;

    const data = GamesExport.parse(roh);
    expect(data.games[1].varianten).toEqual([]);
    expect(data.material[0].sponsor).toBeNull();
    expect(data.plaene[0].customFelder).toEqual([]);
  });

  it("akzeptiert einen leeren Export", () => {
    const result = GamesExport.safeParse({
      schemaVersion: 1, exportedAt: "2026-08-06T10:00:00Z",
      games: [], material: [], plaene: [],
    });
    expect(result.success).toBe(true);
  });

  it("lehnt Enum-Werte ab, die das Ziel-Schema nicht kennt", () => {
    const roh = gueltigerExport();
    roh.games[0].status = "LAEUFT";
    expect(GamesExport.safeParse(roh).success).toBe(false);
  });

  it("lehnt eine fremde schemaVersion ab", () => {
    const roh = gueltigerExport();
    roh.schemaVersion = 2;
    expect(GamesExport.safeParse(roh).success).toBe(false);
  });

  it("lehnt Kommazahlen in Int-Feldern ab", () => {
    const roh = gueltigerExport();
    roh.games[0].playtimeMin = 10.5;
    expect(GamesExport.safeParse(roh).success).toBe(false);
  });
});

describe("findeKaputteReferenzen", () => {
  it("meldet nichts bei einem schlüssigen Export", () => {
    expect(findeKaputteReferenzen(GamesExport.parse(gueltigerExport()))).toEqual([]);
  });

  it("meldet Material mit unbekanntem gameSlug", () => {
    const data = GamesExport.parse(gueltigerExport());
    data.material[0].gameSlug = "gibts-nicht";
    expect(findeKaputteReferenzen(data)).toContainEqual(expect.stringContaining("gibts-nicht"));
  });

  it("meldet Game-Positionen mit unbekanntem gameSlug", () => {
    const data = GamesExport.parse(gueltigerExport());
    data.plaene[0].gamePositionen[0].gameSlug = "weg";
    expect(findeKaputteReferenzen(data)).toContainEqual(expect.stringContaining("weg"));
  });

  it("meldet doppelte Slugs", () => {
    const data = GamesExport.parse(gueltigerExport());
    data.games[1].slug = "praezisionswurf";
    expect(findeKaputteReferenzen(data)).toContainEqual(expect.stringContaining("mehrfach"));
  });
});
