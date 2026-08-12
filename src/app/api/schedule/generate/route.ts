import { NextRequest, NextResponse } from "next/server";
import { generateSchedule } from "@/lib/schedule-engine";
import { requireRole } from "@/lib/auth-helpers";
import { ZeitplanParameterSchema, zodValidationError } from "@/lib/schemas";
import { ladeZeitplanEingaben } from "@/lib/zeitplan-eingaben";

// Die Preview war schon immer mit leerem Body aufrufbar — Defaults ergänzen
// die Pflichtfelder des Parameter-Schemas, ohne dessen Grenzen zu lockern.
const GenerateBodySchema = ZeitplanParameterSchema.extend({
  blockDauerMin: ZeitplanParameterSchema.shape.blockDauerMin.default(15),
  wechselzeitMin: ZeitplanParameterSchema.shape.wechselzeitMin.default(5),
  startZeit: ZeitplanParameterSchema.shape.startZeit.default("09:00"),
});

// POST /api/schedule/generate – Zeitplan generieren (Preview, ohne DB-Speicherung)
export async function POST(request: NextRequest) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  try {
    // Unvalidierte Werte (z. B. versatzMin = 0 bei zu kurzem Fenster) würden
    // die Engine in absurde Pläne treiben — deshalb Zod vor der Engine.
    const body = await request.json().catch(() => null);
    const parsed = GenerateBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
    }

    const {
      blockDauerMin,
      wechselzeitMin,
      startZeit,
      fensterEndeZeit,
      postenVormittag,
      pausen,
      mittagsfenster,
      antiKorrelationen,
    } = parsed.data;

    const { teams, games, freieHelfer } = await ladeZeitplanEingaben();

    if (games.length === 0) {
      return NextResponse.json(
        {
          error:
            "Keine Games mit Status BEREIT oder AKTIV gefunden. Setze Games auf 'Bereit' in der Game-Verwaltung.",
        },
        { status: 400 },
      );
    }

    if (teams.length === 0) {
      return NextResponse.json(
        { error: "Keine Teams vorhanden. Erstelle zuerst Teams." },
        { status: 400 },
      );
    }

    // Anti-Korrelations-Paare gegen die geladenen Games validieren
    const gameIds = new Set(games.map((g) => g.id));
    for (const paar of antiKorrelationen) {
      if (paar.gameXId === paar.gameYId) {
        return NextResponse.json(
          { error: "Anti-Korrelation: Game A und Game B müssen unterschiedlich sein." },
          { status: 400 },
        );
      }
      if (!gameIds.has(paar.gameXId) || !gameIds.has(paar.gameYId)) {
        return NextResponse.json(
          {
            error:
              "Anti-Korrelation verweist auf ein Game, das nicht den Status BEREIT oder AKTIV hat.",
          },
          { status: 400 },
        );
      }
    }

    const postenGesamt = games.reduce((s, g) => s + (g.durchgaenge ?? 1), 0);
    if (postenVormittag != null && postenVormittag >= postenGesamt) {
      return NextResponse.json(
        {
          error: `Vor dem Mittag können höchstens ${postenGesamt - 1} von ${postenGesamt} Posten liegen.`,
        },
        { status: 400 },
      );
    }

    const result = generateSchedule({
      teams,
      games,
      blockDauerMin,
      wechselzeitMin,
      startZeit,
      fensterEndeZeit,
      pausen,
      mittagsfenster,
      postenVormittag,
      freieHelfer,
      antiKorrelationen,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/schedule/generate error:", error);
    return NextResponse.json(
      { error: "Fehler bei der Zeitplan-Generierung" },
      { status: 500 },
    );
  }
}
