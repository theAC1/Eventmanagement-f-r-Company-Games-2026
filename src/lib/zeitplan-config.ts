import { prisma } from "@/lib/prisma";
import { type ZeitplanAbhaengigkeiten } from "@/lib/zeitplan-sperre";

/** Felder, die jeder Konsument des aktuellen Zeitplans braucht. */
const CONFIG_SELECT = {
  id: true,
  name: true,
  istAktiv: true,
  anzahlTeams: true,
  blockDauerMin: true,
  wechselzeitMin: true,
  startZeit: true,
  endZeit: true,
  pausen: true,
  mittagspause: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Aktiver Zeitplan; Fallback: zuletzt erstellter.
 * Wird von Einsatzplan-, Leitstand- und Schiedsrichter-Endpoints geteilt.
 */
export async function getCurrentZeitplanConfig() {
  const aktiv = await prisma.zeitplanConfig.findFirst({
    where: { istAktiv: true },
    orderBy: { updatedAt: "desc" },
    select: CONFIG_SELECT,
  });
  if (aktiv) return aktiv;

  return prisma.zeitplanConfig.findFirst({
    orderBy: { createdAt: "desc" },
    select: CONFIG_SELECT,
  });
}

/**
 * Modus des laufenden Gamedays ("TEST" | "HOT") oder null.
 */
export async function getGamedayModus(): Promise<string | null> {
  const config = await prisma.gamedayConfig.findFirst({
    where: { modus: { not: "INAKTIV" } },
    orderBy: { createdAt: "desc" },
    select: { modus: true },
  });
  return config?.modus ?? null;
}

/**
 * Zählt, was an den Slots eines Zeitplans hängt — Grundlage für Sperren und
 * Warnungen vor einem Neuaufbau.
 */
export async function getZeitplanAbhaengigkeiten(
  configId: string,
): Promise<ZeitplanAbhaengigkeiten> {
  const [qrScans, ergebnisse, einsaetze] = await Promise.all([
    prisma.qRVerifikation.count({ where: { zeitplanSlot: { configId } } }),
    prisma.ergebnis.count({ where: { zeitplanSlot: { configId } } }),
    prisma.zeitplanSlotPerson.count({ where: { slot: { configId } } }),
  ]);
  return { qrScans, ergebnisse, einsaetze };
}
