import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentZeitplanConfig } from "@/lib/zeitplan-config";

// GET /api/team/[token] – öffentliches Team-Portal (read-only, kein Auth)
// Zeigt nur eigene Daten des Teams: Spielplan, eigene Ergebnisse, Lageplan.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  try {
    const team = await prisma.team.findUnique({
      where: { qrToken: token },
      select: { id: true, name: true, nummer: true, farbe: true, logoUrl: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team nicht gefunden" }, { status: 404 });
    }

    // Aktiver Situationsplan: Lageplan-Bild + Feld-Nummern (nur öffentliche Positionen)
    const aktivPlan = await prisma.situationsplan.findFirst({
      where: { istAktiv: true },
      select: {
        hintergrundbildUrl: true,
        gamePositionen: {
          where: { oeffentlich: true, nummer: { not: "" } },
          select: { gameId: true, nummer: true },
        },
      },
    });
    const feldNummern = new Map(
      (aktivPlan?.gamePositionen ?? []).map((p) => [p.gameId, p.nummer]),
    );

    // Spielplan des Teams aus dem aktuellen Zeitplan
    const config = await getCurrentZeitplanConfig();
    let slots: Array<{
      slotId: string;
      startZeit: string;
      endZeit: string;
      runde: number;
      status: string;
      gameName: string;
      gameSlug: string;
      gegner: string[];
      feld: string | null;
    }> = [];

    if (config) {
      const slotTeams = await prisma.zeitplanSlotTeam.findMany({
        where: { teamId: team.id, slot: { configId: config.id } },
        include: {
          slot: {
            select: {
              id: true,
              startZeit: true,
              endZeit: true,
              runde: true,
              status: true,
              game: { select: { id: true, name: true, slug: true } },
              teams: {
                where: { teamId: { not: team.id } },
                select: { team: { select: { name: true } } },
              },
            },
          },
        },
      });
      slots = slotTeams
        .map((st) => ({
          slotId: st.slot.id,
          startZeit: st.slot.startZeit,
          endZeit: st.slot.endZeit,
          runde: st.slot.runde,
          status: st.slot.status,
          gameName: st.slot.game?.name ?? "–",
          gameSlug: st.slot.game?.slug ?? "",
          gegner: st.slot.teams.map((t) => t.team.name),
          feld: st.slot.game ? (feldNummern.get(st.slot.game.id) ?? null) : null,
        }))
        .sort((a, b) => a.startZeit.localeCompare(b.startZeit));
    }

    // Nur eigene Ergebnisse — keine Rangliste relativ zu anderen Teams
    const ergebnisse = await prisma.ergebnis.findMany({
      where: { teamId: team.id, istTest: false },
      select: {
        id: true,
        gamePunkte: true,
        rangPunkte: true,
        status: true,
        game: { select: { name: true, slug: true, zaehltZurWertung: true } },
      },
      orderBy: { game: { name: "asc" } },
    });
    // Eierfall-Opt-out: Bonus-Games (zaehltZurWertung=false) werden angezeigt,
    // fliessen aber nicht in die Rangpunkte-Summe ein
    const rangPunkteSumme = ergebnisse.reduce(
      (sum, e) => (e.game.zaehltZurWertung ? sum + (e.rangPunkte ?? 0) : sum),
      0,
    );

    return NextResponse.json({
      teamId: team.id,
      teamName: team.name,
      teamNummer: team.nummer,
      teamFarbe: team.farbe,
      teamLogo: team.logoUrl,
      slots,
      ergebnisse: ergebnisse.map((e) => ({
        id: e.id,
        gameName: e.game.name,
        gameSlug: e.game.slug,
        gamePunkte: e.gamePunkte,
        rangPunkte: e.rangPunkte,
        status: e.status,
        zaehltZurWertung: e.game.zaehltZurWertung,
      })),
      rangPunkteSumme,
      lageplanUrl: aktivPlan?.hintergrundbildUrl ?? null,
    });
  } catch (error) {
    console.error(`GET /api/team/${token} error:`, error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
