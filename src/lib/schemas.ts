import { z } from "zod/v4";

// ─── Games ───

export const GameCreateSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(100, "Name max 100 Zeichen"),
  slug: z.string().optional(),
  typ: z.enum(["RETURNEE", "NEU"]),
  modus: z.enum(["SOLO", "DUELL"]),
  teamsProSlot: z.number().int().min(1).max(4).optional(),
  kurzbeschreibung: z.string().nullable().optional(),
  einfuehrungMin: z.number().int().min(0).optional(),
  playtimeMin: z.number().int().min(1).optional(),
  reserveMin: z.number().int().min(0).optional(),
  regeln: z.string().nullable().optional(),
  wertungstyp: z.string().nullable().optional(),
  wertungslogik: z.any().optional(),
  flaecheLaengeM: z.number().nullable().optional(),
  flaecheBreiteM: z.number().nullable().optional(),
  helferAnzahl: z.number().int().min(0).optional(),
  stromNoetig: z.boolean().optional(),
});

export const GameUpdateSchema = GameCreateSchema.partial().extend({
  status: z.enum(["ENTWURF", "BEREIT", "AKTIV", "ABGESCHLOSSEN"]).optional(),
});

// ─── Teams ───

export const TeamCreateSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(100),
  nummer: z.number().int().min(1, "Nummer muss mindestens 1 sein"),
  captainName: z.string().nullable().optional(),
  captainEmail: z.string().email().nullable().optional(),
  farbe: z.string().optional(),
  logoUrl: z.string().url().nullable().optional(),
  motto: z.string().nullable().optional(),
  teilnehmerAnzahl: z.number().int().min(1).nullable().optional(),
  teilnehmerNamen: z.any().optional(),
});

export const TeamUpdateSchema = TeamCreateSchema.partial();

// ─── Materials ───

export const MaterialCreateSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(200),
  gameId: z.string().nullable().optional(),
  kategorie: z.enum(["SPONSOR", "MIETE", "KAUF", "EIGENBAU", "VERBRAUCH", "INFRASTRUKTUR"]),
  menge: z.string().nullable().optional(),
  beschreibung: z.string().nullable().optional(),
  status: z.enum(["OFFEN", "ANGEFRAGT", "BESTAETIGT", "VORHANDEN", "GELIEFERT"]).optional(),
  sponsor: z.string().nullable().optional(),
  kostenGeschaetzt: z.number().nullable().optional(),
  kostenEffektiv: z.number().nullable().optional(),
});

export const MaterialUpdateSchema = MaterialCreateSchema.partial();

// ─── Ergebnisse ───

export const ErgebnisCreateSchema = z.object({
  gameId: z.string().min(1, "gameId ist erforderlich"),
  teamId: z.string().min(1, "teamId ist erforderlich"),
  rohdaten: z.record(z.string(), z.unknown()),
  zeitplanSlotId: z.string().nullable().optional(),
  commitId: z.string().optional(),
});

export const ErgebnisUpdateSchema = z.object({
  rohdaten: z.record(z.string(), z.unknown()),
  grund: z.string().max(500).optional(),
});

// ─── Users ───

export const UserCreateSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(100),
  username: z.string().min(2, "Username mind. 2 Zeichen").max(50),
  password: z.string().min(6, "Passwort mind. 6 Zeichen"),
  rolle: z.enum(["ADMIN", "ORGA", "SCHIEDSRICHTER", "HELFER"]),
  email: z.string().email().nullable().optional(),
});

export const UserUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  username: z.string().min(2).max(50).optional(),
  password: z.string().min(6).optional(),
  rolle: z.enum(["ADMIN", "ORGA", "SCHIEDSRICHTER", "HELFER"]).optional(),
  email: z.string().email().nullable().optional(),
  istAktiv: z.boolean().optional(),
});

// ─── Helper ───

export function zodValidationError(error: z.ZodError) {
  return {
    error: "Validierungsfehler",
    details: error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  };
}
