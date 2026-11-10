/**
 * Schema der games-export.json (erzeugt von scripts/export-games.sql im
 * Homelab-Repo). Bewusst ohne DB-Abhängigkeit, damit ein Export validiert
 * werden kann, bevor irgendetwas geschrieben wird.
 *
 * Die Enums sind gegen das ZIEL-Schema (prisma/schema.prisma) formuliert:
 * weicht der Export ab, fliegt das hier auf statt als kryptischer DB-Fehler.
 */
import { z } from "zod";

export const SCHEMA_VERSION = 1;

const Variante = z.object({
  name: z.string().min(1),
  beschreibung: z.string().nullable().default(null),
  istAktiv: z.boolean().default(false),
});

const Game = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  typ: z.enum(["RETURNEE", "NEU"]),
  status: z.enum(["ENTWURF", "BEREIT", "AKTIV", "ABGESCHLOSSEN"]),
  kurzbeschreibung: z.string().nullable().default(null),
  modus: z.enum(["SOLO", "DUELL"]),
  teamsProSlot: z.number().int(),
  einfuehrungMin: z.number().int(),
  playtimeMin: z.number().int(),
  reserveMin: z.number().int(),
  regeln: z.string().nullable().default(null),
  wertungstyp: z.string().nullable().default(null),
  wertungslogik: z.unknown().nullable().default(null),
  flaecheLaengeM: z.number().nullable().default(null),
  flaecheBreiteM: z.number().nullable().default(null),
  helferAnzahl: z.number().int(),
  schiedsrichterAnzahl: z.number().int(),
  stromNoetig: z.boolean(),
  varianten: z.array(Variante).default([]),
});

const Material = z.object({
  gameSlug: z.string().min(1),
  name: z.string().min(1),
  kategorie: z.enum(["SPONSOR", "MIETE", "KAUF", "EIGENBAU", "VERBRAUCH", "INFRASTRUKTUR"]),
  menge: z.string().nullable().default(null),
  beschreibung: z.string().nullable().default(null),
  status: z.enum(["OFFEN", "ANGEFRAGT", "BESTAETIGT", "VORHANDEN", "GELIEFERT"]),
  sponsor: z.string().nullable().default(null),
  kostenGeschaetzt: z.number().nullable().default(null),
  kostenEffektiv: z.number().nullable().default(null),
});

const GamePosition = z.object({
  gameSlug: z.string().min(1),
  x: z.number(),
  y: z.number(),
  rotation: z.number().default(0),
  nummer: z.string().default(""),
  oeffentlich: z.boolean().default(true),
});

const CustomFeld = z.object({
  label: z.string().min(1),
  nummer: z.string().default(""),
  farbe: z.string().default("#6b7280"),
  breiteM: z.number().default(10),
  laengeM: z.number().default(10),
  x: z.number(),
  y: z.number(),
  rotation: z.number().default(0),
  oeffentlich: z.boolean().default(true),
});

const Plan = z.object({
  name: z.string().min(1),
  hintergrundbildUrl: z.string().nullable().default(null),
  massstab: z.number().nullable().default(null),
  istAktiv: z.boolean().default(false),
  gamePositionen: z.array(GamePosition).default([]),
  customFelder: z.array(CustomFeld).default([]),
});

export const GamesExport = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  exportedAt: z.string(),
  games: z.array(Game),
  material: z.array(Material).default([]),
  plaene: z.array(Plan).default([]),
});

/**
 * Prüft die referenzielle Integrität, die zod allein nicht abdeckt:
 * Verweisen alle gameSlugs auf ein Game im selben Export?
 * Gibt eine Liste von Fehlermeldungen zurück (leer = alles gut).
 */
export function findeKaputteReferenzen(data) {
  const slugs = new Set(data.games.map((g) => g.slug));
  const fehler = [];

  for (const m of data.material) {
    if (!slugs.has(m.gameSlug)) {
      fehler.push(`Material "${m.name}" verweist auf unbekanntes Game "${m.gameSlug}"`);
    }
  }
  for (const p of data.plaene) {
    for (const pos of p.gamePositionen) {
      if (!slugs.has(pos.gameSlug)) {
        fehler.push(`Position im Plan "${p.name}" verweist auf unbekanntes Game "${pos.gameSlug}"`);
      }
    }
  }

  const gesehen = new Set();
  for (const g of data.games) {
    if (gesehen.has(g.slug)) fehler.push(`Slug "${g.slug}" kommt mehrfach vor`);
    gesehen.add(g.slug);
  }

  return fehler;
}
