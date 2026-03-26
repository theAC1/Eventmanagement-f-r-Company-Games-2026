/**
 * CSV-Export Utilities für Company Games 2026
 * Generiert CSV-Strings mit BOM für korrekte Umlaute in Excel.
 */

const BOM = "\uFEFF"; // UTF-8 BOM für Excel-Kompatibilität
const SEP = ";"; // Semikolon als Separator (europäischer Standard)

function escapeCsv(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(SEP) || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(values: unknown[]): string {
  return values.map(escapeCsv).join(SEP);
}

// ─── Rangliste CSV ───

type RanglisteEntry = {
  gesamtRang: number;
  teamName: string;
  teamNummer?: number;
  rangPunkteSumme: number;
  gamesGespielt: number;
  gamesTotal: number;
  platzierungen: Record<number, number>;
};

type RanglisteMetadata = {
  totalGames: number;
  totalTeams: number;
  ergebnisseEingetragen: number;
};

export function generateRanglisteCSV(
  rangliste: RanglisteEntry[],
  metadata: RanglisteMetadata,
): string {
  const header = csvRow([
    "Rang",
    "Team",
    "Nr.",
    "Spiele",
    "Rangpunkte",
    "1. Plätze",
    "2. Plätze",
    "3. Plätze",
  ]);

  const rows = rangliste.map((r) =>
    csvRow([
      r.gesamtRang,
      r.teamName,
      r.teamNummer ?? "",
      `${r.gamesGespielt}/${r.gamesTotal}`,
      r.rangPunkteSumme,
      r.platzierungen[1] ?? 0,
      r.platzierungen[2] ?? 0,
      r.platzierungen[3] ?? 0,
    ]),
  );

  const meta = [
    "",
    csvRow(["Company Games 2026 — Rangliste"]),
    csvRow([
      `Exportiert: ${new Date().toLocaleString("de-CH")}`,
    ]),
    csvRow([
      `${metadata.ergebnisseEingetragen} von ${metadata.totalGames * metadata.totalTeams} Ergebnisse eingetragen`,
    ]),
  ];

  return BOM + [header, ...rows, ...meta].join("\n");
}

// ─── Ergebnisse CSV ───

type ErgebnisEntry = {
  gameName: string;
  teamName: string;
  teamNummer: number;
  gamePunkte: number | null;
  rangImGame: number | null;
  status: string;
  eingetragenUm: string | null;
};

export function generateErgebnisseCSV(ergebnisse: ErgebnisEntry[]): string {
  const header = csvRow([
    "Game",
    "Team",
    "Nr.",
    "Punkte",
    "Rang",
    "Status",
    "Eingetragen",
  ]);

  const rows = ergebnisse.map((e) =>
    csvRow([
      e.gameName,
      e.teamName,
      e.teamNummer,
      e.gamePunkte ?? "",
      e.rangImGame ?? "",
      e.status,
      e.eingetragenUm
        ? new Date(e.eingetragenUm).toLocaleString("de-CH")
        : "",
    ]),
  );

  return BOM + [header, ...rows].join("\n");
}

// ─── Teams CSV ───

type TeamEntry = {
  nummer: number;
  name: string;
  captainName: string | null;
  captainEmail: string | null;
  farbe: string;
  teilnehmerAnzahl: number | null;
  motto: string | null;
};

export function generateTeamsCSV(teams: TeamEntry[]): string {
  const header = csvRow([
    "Nr.",
    "Team",
    "Captain",
    "Email",
    "Farbe",
    "Teilnehmer",
    "Motto",
  ]);

  const rows = teams.map((t) =>
    csvRow([
      t.nummer,
      t.name,
      t.captainName ?? "",
      t.captainEmail ?? "",
      t.farbe,
      t.teilnehmerAnzahl ?? "",
      t.motto ?? "",
    ]),
  );

  return BOM + [header, ...rows].join("\n");
}
