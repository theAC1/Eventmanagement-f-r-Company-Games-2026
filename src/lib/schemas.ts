import { z } from "zod/v4";

// ─── Wertungslogik ───

// looseObject: unbekannte Zusatz-Keys (einheit, tiebreaker, …) bleiben beim
// Speichern erhalten — die Wertungslogik ist eine JSON-Config-Spalte.
const EingabefeldSchema = z.looseObject({
  name: z.string(),
  typ: z.string().optional(),
  label: z.string().optional(),
});

const RichtungSchema = z.enum(["hoechster_gewinnt", "niedrigster_gewinnt"]).optional();

const TurmConfigSchema = z.looseObject({
  name: z.string(),
  sektionen: z.number().int().min(0).max(20),
  bonus: z.number().int().min(0).max(20),
  bonusLabel: z.string().optional(),
});

export const WertungslogikSchema = z.union([
  z.looseObject({ typ: z.literal("max_value"), richtung: RichtungSchema, messung: z.string().optional() }),
  z.looseObject({ typ: z.literal("zeit"), richtung: RichtungSchema, strafen: z.record(z.string(), z.number()).optional(), eingabefelder: z.array(EingabefeldSchema).optional(), maxSekunden: z.number().int().min(1).optional() }),
  z.looseObject({ typ: z.literal("punkte_duell"), richtung: RichtungSchema, eingabefelder: z.array(EingabefeldSchema).optional() }),
  z.looseObject({ typ: z.literal("duell_kleinbegegnungen"), richtung: RichtungSchema, gewichtungG: z.number().min(0).optional() }),
  z.looseObject({ typ: z.literal("runden_strafpunkte"), richtung: RichtungSchema, runden: z.number().int().min(1).max(10).optional() }),
  z.looseObject({ typ: z.literal("tuerme_punkte"), richtung: RichtungSchema, tuerme: z.array(TurmConfigSchema).optional() }),
  z.looseObject({ typ: z.literal("sieg_zuege"), richtung: RichtungSchema, gewichtungSieg: z.number().min(0).optional() }),
  z.looseObject({ typ: z.literal("formel"), richtung: RichtungSchema, eingabefelder: z.array(EingabefeldSchema).optional() }),
  z.looseObject({ typ: z.literal("multi_level"), richtung: RichtungSchema, levels: z.array(z.looseObject({ name: z.string(), grundpunkte: z.number() })).optional() }),
  z.looseObject({ typ: z.literal("risiko_wahl"), richtung: RichtungSchema, optionen: z.array(z.looseObject({ name: z.string(), punkte_erfolg: z.number(), punkte_fail: z.number() })).optional() }),
]).nullable().optional();

// ─── Games ───

export const GameCreateSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(100, "Name max 100 Zeichen"),
  slug: z.string().optional(),
  typ: z.enum(["RETURNEE", "NEU"]),
  modus: z.enum(["SOLO", "DUELL"]),
  teamsProSlot: z.number().int().min(1).max(4).optional(),
  // Wie oft jedes Team diesen Posten absolviert (Human Soccer/ChaosQuadrant: 2)
  durchgaenge: z.number().int().min(1).max(5).optional(),
  teilnehmerProTeam: z.number().int().min(1).max(50).nullable().optional(),
  kurzbeschreibung: z.string().nullable().optional(),
  einfuehrungMin: z.number().int().min(0).optional(),
  playtimeMin: z.number().int().min(1).optional(),
  reserveMin: z.number().int().min(0).optional(),
  regeln: z.string().nullable().optional(),
  wertungstyp: z.string().nullable().optional(),
  wertungslogik: WertungslogikSchema,
  flaecheLaengeM: z.number().nullable().optional(),
  flaecheBreiteM: z.number().nullable().optional(),
  helferAnzahl: z.number().int().min(0).optional(),
  schiedsrichterAnzahl: z.number().int().min(1).max(10).optional(),
  stromNoetig: z.boolean().optional(),
  // Bonus-Game: findet statt, zählt aber nicht in die Gesamtwertung
  zaehltZurWertung: z.boolean().optional(),
});

export const GameUpdateSchema = GameCreateSchema.partial().extend({
  status: z.enum(["ENTWURF", "BEREIT", "AKTIV", "ABGESCHLOSSEN"]).optional(),
});

// ─── Gemeinsame Felder ───

/**
 * E-Mail ist überall freiwillig — von Schiedsrichtern und Helfern kennt die
 * Orga oft keine Adresse. Ein leer gelassenes Formularfeld kommt als "" an und
 * wird hier zu null normalisiert; nur ein tatsächlich getippter Wert muss eine
 * gültige Adresse sein. `undefined` bleibt `undefined`, damit ein Teil-Update
 * ohne E-Mail-Feld die gespeicherte Adresse nicht löscht.
 */
export const OptionaleEmailSchema = z
  .union([z.literal(""), z.null(), z.string().email("Ungültige E-Mail-Adresse")], {
    error: "Ungültige E-Mail-Adresse",
  })
  .optional()
  .transform((wert) => (wert === "" ? null : wert));

// ─── Teams ───

export const TeamCreateSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(100),
  nummer: z.number().int().min(1, "Nummer muss mindestens 1 sein"),
  captainName: z.string().nullable().optional(),
  captainEmail: OptionaleEmailSchema,
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
  verantwortlichId: z.string().nullable().optional(),
  kostenGeschaetzt: z.number().nullable().optional(),
  kostenEffektiv: z.number().nullable().optional(),
});

export const MaterialUpdateSchema = MaterialCreateSchema.partial();

export const MaterialBulkUpdateSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Mindestens eine ID erforderlich"),
  patch: MaterialCreateSchema.partial(),
});

export const MaterialBulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Mindestens eine ID erforderlich"),
});

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

// Neue Accounts werden ohne Passwort angelegt — Erstanmeldung läuft über
// einen einmaligen Aktivierungscode (OWNER erhält ihn bei der Erstellung).
export const UserCreateSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(100),
  username: z.string().min(2, "Username mind. 2 Zeichen").max(50),
  rolle: z.enum(["OWNER", "ADMIN", "ORGA", "SCHIEDSRICHTER", "HELFER"]),
  email: OptionaleEmailSchema,
});

export const UserUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  username: z.string().min(2).max(50).optional(),
  password: z.string().min(10).optional(),
  rolle: z.enum(["OWNER", "ADMIN", "ORGA", "SCHIEDSRICHTER", "HELFER"]).optional(),
  email: OptionaleEmailSchema,
  istAktiv: z.boolean().optional(),
  // Verpflegung: isst diese Person am Turniertag mit?
  isstMittag: z.boolean().optional(),
});

// ─── Posten-Crew (Einsatzplan) ───

/** Schiedsrichter-/Helfer-Besetzung eines Postens, gesetzt im Games-Tab. */
export const GameCrewSchema = z.object({
  personIds: z.array(z.string().min(1), {
    message: "personIds (Array von IDs) erforderlich",
  }),
});

// ─── Zeitplan ───

// Stunden 00–47: Die Engine zählt bei spätem Start über Mitternacht hinaus
// weiter ("24:15"), solche Pläne müssen speicherbar bleiben.
const ZEIT_REGEX = /^([0-3]\d|4[0-7]):[0-5]\d$/;

const ZeitSchema = z
  .string()
  .regex(ZEIT_REGEX, "Zeit im Format HH:MM erwartet (auch über Mitternacht hinaus)");

/**
 * Küchenfenster statt fixer Pause: die Orga sagt nur, ab wann und bis wann
 * gegessen werden kann — die Engine verteilt die Wellen darin.
 */
export const MittagsfensterSchema = z
  .object({
    von: ZeitSchema,
    bis: ZeitSchema,
    dauerMin: z.number().int().min(5).max(240),
    teamsProWelle: z.number().int().min(1).max(50),
    versatzMin: z.number().int().min(0).max(120),
  })
  .refine((v) => v.bis > v.von, {
    message: "Das Mittagsfenster muss nach seinem Beginn enden",
    path: ["bis"],
  });

export const PauseSchema = z.object({
  nachRunde: z.number().int().min(1),
  dauerMin: z.number().int().min(1).max(240),
  name: z.string().max(100),
});

/** Ungerichtetes Anti-Korrelations-Paar: Game A früh ⇒ Game B spät (und umgekehrt). */
export const AntiKorrelationSchema = z.object({
  gameXId: z.string().min(1, "gameXId ist erforderlich"),
  gameYId: z.string().min(1, "gameYId ist erforderlich"),
});

/** Parameter, aus denen die Engine einen Zeitplan baut. */
export const ZeitplanParameterSchema = z.object({
  blockDauerMin: z.number().int().min(1, "Blockdauer mind. 1 min").max(240),
  wechselzeitMin: z.number().int().min(0).max(120),
  startZeit: ZeitSchema,
  /** Spätestes Turnierende; die Engine meldet einen Überzug, blockt aber nicht. */
  fensterEndeZeit: ZeitSchema.nullish(),
  /** Ziel-Posten vor der eigenen Mittagswelle (Standard: ~60 % aller Posten). */
  postenVormittag: z.number().int().min(1).max(40).nullish(),
  pausen: z.array(PauseSchema).default([]),
  mittagsfenster: MittagsfensterSchema.nullish(),
  antiKorrelationen: z.array(AntiKorrelationSchema).default([]),
});

const ZeitplanSlotSchema = z.object({
  runde: z.number().int().min(1),
  startZeit: ZeitSchema,
  endZeit: ZeitSchema,
  gameId: z.string().min(1, "gameId ist erforderlich"),
  teamIds: z.array(z.string().min(1)).min(1, "Slot ohne Teams"),
});

/** Eine berechnete Mittagswelle, wie die Engine sie liefert. */
export const MittagsWelleSchema = z.object({
  welle: z.number().int().min(1),
  startZeit: ZeitSchema,
  endZeit: ZeitSchema,
  startMin: z.number().int().min(0),
  endeMin: z.number().int().min(0),
  teamIds: z.array(z.string()).default([]),
  teamNamen: z.array(z.string()).default([]),
  postenIds: z.array(z.string()).default([]),
  postenNamen: z.array(z.string()).default([]),
  helferIds: z.array(z.string()).default([]),
  helferNamen: z.array(z.string()).default([]),
  personenTotal: z.number().int().min(0),
});

/** Zeitplan neu anlegen oder vollständig ersetzen (Parameter + Slots). */
export const ZeitplanSaveSchema = ZeitplanParameterSchema.extend({
  name: z.string().min(1, "Name ist erforderlich").max(100),
  endZeit: ZeitSchema,
  slots: z.array(ZeitplanSlotSchema).min(1, "Zeitplan ohne Slots"),
  mittagswellen: z.array(MittagsWelleSchema).default([]),
  istAktiv: z.boolean().optional(),
});

/** Nur Metadaten ändern (umbenennen / aktiv setzen), ohne Slots anzufassen. */
export const ZeitplanPatchSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    istAktiv: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.istAktiv !== undefined, {
    message: "Mindestens name oder istAktiv erforderlich",
  });

// ─── Einsatzplan ───

export const EinsatzplanPersonenSchema = z.object({
  personIds: z.array(z.string().min(1), {
    message: "personIds (Array von IDs) erforderlich",
  }),
});

// ─── KVP ───

export const KvpCreateSchema = z.object({
  typ: z.enum(["BUG", "WUNSCHFUNKTION", "IDEE"]),
  titel: z.string().min(1, "Titel ist erforderlich").max(100),
  beschreibung: z.string().min(1, "Beschreibung ist erforderlich").max(500),
  seite: z.string().max(200).optional(),
});

export const KvpStatusUpdateSchema = z.object({
  status: z.enum(["OFFEN", "IN_BEARBEITUNG", "ERLEDIGT"]),
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
