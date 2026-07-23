import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { validatePassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rate-limit";

// POST /api/auth/activate — Erstanmeldung: Aktivierungscode einlösen + Passwort setzen.
// Danach meldet sich der Client regulär via NextAuth mit dem neuen Passwort an.
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!checkRateLimit(`activate-ip:${ip}`)) {
      return NextResponse.json(
        { error: "Zu viele Versuche. Bitte später erneut versuchen." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { username, aktivierungsCode, neuesPasswort } = body as {
      username?: string;
      aktivierungsCode?: string;
      neuesPasswort?: string;
    };
    if (!username || !aktivierungsCode || !neuesPasswort) {
      return NextResponse.json(
        { error: "Username, Aktivierungscode und neues Passwort erforderlich" },
        { status: 400 },
      );
    }

    const person = await prisma.person.findUnique({ where: { username } });
    if (
      !person ||
      !person.istAktiv ||
      !person.aktivierungsCode ||
      !person.mussPasswortAendern
    ) {
      return NextResponse.json(
        { error: "Ungültiger Benutzername oder Aktivierungscode" },
        { status: 401 },
      );
    }

    const codeValid = await bcrypt.compare(aktivierungsCode, person.aktivierungsCode);
    if (!codeValid) {
      return NextResponse.json(
        { error: "Ungültiger Benutzername oder Aktivierungscode" },
        { status: 401 },
      );
    }

    const check = validatePassword(neuesPasswort);
    if (!check.ok) {
      return NextResponse.json(
        {
          error: `Passwort erfüllt die Anforderungen nicht: ${check.fehler.join(", ")}`,
          regeln: check.regeln,
        },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(neuesPasswort, 12);
    await prisma.person.update({
      where: { id: person.id },
      data: { passwordHash, aktivierungsCode: null, mussPasswortAendern: false },
    });

    return NextResponse.json({ ok: true, username: person.username });
  } catch (error) {
    console.error("POST /api/auth/activate error:", error);
    return NextResponse.json({ error: "Fehler bei der Aktivierung" }, { status: 500 });
  }
}
