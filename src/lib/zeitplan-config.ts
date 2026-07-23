import { prisma } from "@/lib/prisma";

/**
 * Aktiver Zeitplan; Fallback: zuletzt erstellter.
 * Wird von Einsatzplan- und Schiedsrichter-Endpoints geteilt.
 */
export async function getCurrentZeitplanConfig() {
  const aktiv = await prisma.zeitplanConfig.findFirst({
    where: { istAktiv: true },
    select: { id: true, name: true, istAktiv: true, createdAt: true },
  });
  if (aktiv) return aktiv;

  return prisma.zeitplanConfig.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, istAktiv: true, createdAt: true },
  });
}
