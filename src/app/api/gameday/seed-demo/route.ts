import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { seedDemo, hasHotGameday } from "@/lib/seed-demo";

// POST /api/gameday/seed-demo — ADMIN-only: legt Demo-/Generalproben-Daten an
export async function POST() {
  const { error: authError, session } = await requireRole("ADMIN");
  if (authError) return authError;

  try {
    if (await hasHotGameday(prisma)) {
      return NextResponse.json(
        {
          error:
            "Ein HOT-Gameday ist aktiv. Demo-Daten können nicht angelegt werden, solange der produktive Gameday läuft.",
        },
        { status: 400 },
      );
    }
    const result = await seedDemo(prisma, session!.user.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/gameday/seed-demo error:", error);
    return NextResponse.json(
      { error: "Fehler beim Anlegen der Demo-Daten" },
      { status: 500 },
    );
  }
}
