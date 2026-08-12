import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { getCurrentZeitplanConfig } from "@/lib/zeitplan-config";
import { personenGesamt, spitzenBelegung, type MittagsWelle } from "@/lib/mittagsplanung";

export type VerpflegungsPerson = {
  id: string;
  name: string;
  rolle: string;
  /** Posten, an dem die Person eingeteilt ist; null = kein Posten. */
  posten: string | null;
  isstMittag: boolean;
};

export type VerpflegungsUebersicht = {
  zeitplan: { id: string; name: string; istAktiv: boolean } | null;
  wellen: MittagsWelle[];
  /** Summe über alle Wellen. */
  personenTotal: number;
  /** Höchste gleichzeitige Belegung — die Zahl, an der die Küche hängt. */
  spitze: number;
  teams: { anzahl: number; teilnehmer: number; ohneAngabe: string[] };
  personal: {
    mitPosten: VerpflegungsPerson[];
    ohnePosten: VerpflegungsPerson[];
    essenTotal: number;
  };
};

/**
 * GET /api/verpflegung
 *
 * Wer isst wann, und wie viele sind es gleichzeitig? Die Wellen stammen aus
 * dem gespeicherten Zeitplan; Personal und Teamgrössen kommen live aus den
 * Stammdaten, damit die Kopfzahl nicht auf dem Stand der letzten Generierung
 * einfriert.
 */
export async function GET() {
  const { error } = await requireRole("ORGA");
  if (error) return error;

  try {
    const [config, teams, personen] = await Promise.all([
      getCurrentZeitplanConfig(),
      prisma.team.findMany({
        select: { id: true, name: true, teilnehmerAnzahl: true },
        orderBy: { nummer: "asc" },
      }),
      prisma.person.findMany({
        where: { istAktiv: true, rolle: { not: "OWNER" } },
        select: {
          id: true,
          name: true,
          rolle: true,
          isstMittag: true,
          postenCrew: { select: { game: { select: { name: true } } } },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    const alle: VerpflegungsPerson[] = personen.map((p) => ({
      id: p.id,
      name: p.name,
      rolle: p.rolle,
      posten: p.postenCrew.map((c) => c.game.name).join(", ") || null,
      // Wer einen Posten hat, isst in der Welle seines Postens mit.
      isstMittag: p.postenCrew.length > 0 ? true : p.isstMittag,
    }));

    const mitPosten = alle.filter((p) => p.posten !== null);
    const ohnePosten = alle.filter((p) => p.posten === null);

    const wellen = (config?.mittagswellen ?? []) as unknown as MittagsWelle[];

    const uebersicht: VerpflegungsUebersicht = {
      zeitplan: config ? { id: config.id, name: config.name, istAktiv: config.istAktiv } : null,
      wellen,
      personenTotal: personenGesamt(wellen),
      spitze: spitzenBelegung(wellen),
      teams: {
        anzahl: teams.length,
        teilnehmer: teams.reduce((s, t) => s + (t.teilnehmerAnzahl ?? 0), 0),
        ohneAngabe: teams.filter((t) => !t.teilnehmerAnzahl).map((t) => t.name),
      },
      personal: {
        mitPosten,
        ohnePosten,
        essenTotal: alle.filter((p) => p.isstMittag).length,
      },
    };

    return NextResponse.json(uebersicht);
  } catch (error) {
    console.error("GET /api/verpflegung error:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Verpflegungsübersicht" },
      { status: 500 },
    );
  }
}
