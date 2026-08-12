import { describe, expect, it } from "vitest";
import {
  generateErgebnisseCSV,
  generateRanglisteCSV,
  generateTeamsCSV,
} from "./export";

const BOM = "﻿";

/** Zeilen ohne BOM — erleichtert das Prüfen einzelner Zeilen. */
function zeilen(csv: string): string[] {
  return csv.replace(BOM, "").split("\n");
}

describe("generateRanglisteCSV", () => {
  const rangliste = [
    {
      gesamtRang: 1,
      teamName: "Die Löwen",
      teamNummer: 3,
      rangPunkteSumme: 42,
      gamesGespielt: 12,
      gamesTotal: 12,
      platzierungen: { 1: 5, 2: 3, 3: 1 },
    },
    {
      gesamtRang: 2,
      teamName: "Team ohne Nummer",
      rangPunkteSumme: 31,
      gamesGespielt: 11,
      gamesTotal: 12,
      platzierungen: {},
    },
  ];
  const metadata = { totalGames: 12, totalTeams: 17, ergebnisseEingetragen: 200 };

  it("beginnt mit dem BOM, damit Excel Umlaute richtig liest", () => {
    expect(generateRanglisteCSV(rangliste, metadata).startsWith(BOM)).toBe(true);
  });

  it("schreibt Kopfzeile und Datenzeilen mit Semikolon", () => {
    const [kopf, erste] = zeilen(generateRanglisteCSV(rangliste, metadata));
    expect(kopf).toBe("Rang;Team;Nr.;Spiele;Rangpunkte;1. Plätze;2. Plätze;3. Plätze");
    expect(erste).toBe("1;Die Löwen;3;12/12;42;5;3;1");
  });

  it("füllt fehlende Nummer und Platzierungen auf", () => {
    expect(zeilen(generateRanglisteCSV(rangliste, metadata))[2]).toBe(
      "2;Team ohne Nummer;;11/12;31;0;0;0",
    );
  });

  it("hängt die Kennzahlen als Fussnote an", () => {
    const csv = generateRanglisteCSV(rangliste, metadata);
    expect(csv).toContain("Company Games 2026 — Rangliste");
    expect(csv).toContain("200 von 204 Ergebnisse eingetragen");
  });

  it("kommt mit leerer Rangliste klar", () => {
    const csv = generateRanglisteCSV([], metadata);
    expect(zeilen(csv)[0]).toContain("Rang;Team");
  });
});

describe("generateErgebnisseCSV", () => {
  const ergebnisse = [
    {
      gameName: "Cornhole",
      teamName: "Die Löwen",
      teamNummer: 3,
      gamePunkte: 12.5,
      rangImGame: 2,
      status: "VERIFIZIERT",
      eingetragenUm: "2026-09-05T10:15:00.000Z",
      istTest: false,
      zaehltZurWertung: true,
    },
    {
      gameName: "Human Soccer",
      teamName: "Team B",
      teamNummer: 4,
      gamePunkte: null,
      rangImGame: null,
      status: "AUSSTEHEND",
      eingetragenUm: null,
      istTest: true,
      zaehltZurWertung: false,
    },
  ];

  it("übersetzt Booleans in Ja/Nein", () => {
    const [, erste, zweite] = zeilen(generateErgebnisseCSV(ergebnisse));
    expect(erste).toContain(";Nein;Ja;");
    expect(zweite).toContain(";Ja;Nein;");
  });

  it("lässt fehlende Punkte und Ränge leer statt null zu schreiben", () => {
    const zweite = zeilen(generateErgebnisseCSV(ergebnisse))[2];
    expect(zweite.startsWith("Human Soccer;Team B;4;;;AUSSTEHEND;")).toBe(true);
    expect(zweite).not.toContain("null");
  });

  it("lässt die Zeitspalte leer, wenn nichts eingetragen wurde", () => {
    expect(zeilen(generateErgebnisseCSV(ergebnisse))[2].endsWith(";")).toBe(true);
  });
});

describe("generateTeamsCSV", () => {
  const teams = [
    {
      nummer: 1,
      name: "Die Löwen",
      captainName: "Anna Meier",
      captainEmail: "anna@example.com",
      farbe: "#ff0000",
      teilnehmerAnzahl: 6,
      motto: "Immer vorwärts",
    },
    {
      nummer: 2,
      name: 'Team "Anführungszeichen"',
      captainName: null,
      captainEmail: null,
      farbe: "#00ff00",
      teilnehmerAnzahl: null,
      motto: "Motto; mit Semikolon",
    },
  ];

  it("schreibt alle Spalten", () => {
    expect(zeilen(generateTeamsCSV(teams))[1]).toBe(
      "1;Die Löwen;Anna Meier;anna@example.com;#ff0000;6;Immer vorwärts",
    );
  });

  it("maskiert Semikolon und Anführungszeichen CSV-konform", () => {
    const zweite = zeilen(generateTeamsCSV(teams))[2];
    expect(zweite).toContain('"Team ""Anführungszeichen"""');
    expect(zweite).toContain('"Motto; mit Semikolon"');
  });

  it("lässt fehlende Angaben leer", () => {
    expect(zeilen(generateTeamsCSV(teams))[2]).toContain(";;;#00ff00;;");
  });

  it("maskiert Zeilenumbrüche im Text", () => {
    const csv = generateTeamsCSV([{ ...teams[0], motto: "Zeile 1\nZeile 2" }]);
    expect(csv).toContain('"Zeile 1\nZeile 2"');
  });
});
