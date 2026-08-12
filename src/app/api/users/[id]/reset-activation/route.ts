import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { generateActivationCode } from "@/lib/activation-code";
import { BENUTZER_MIN_ROLLE, darfBenutzerVerwalten } from "@/lib/benutzer-rechte";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  username: true,
  rolle: true,
  istAktiv: true,
  mussPasswortAendern: true,
  createdAt: true,
} as const;

// POST /api/users/[id]/reset-activation — neuen Aktivierungscode generieren.
// Offen ab ADMIN, aber nur für Accounts unterhalb der eigenen Stufe: sonst
// könnte ein Admin den Zugang eines Owners übernehmen.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireRole(BENUTZER_MIN_ROLLE);
  if (error) return error;

  const { id } = await params;

  const existing = await prisma.person.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }
  if (existing.id === session!.user.id) {
    return NextResponse.json(
      { error: "Du kannst deinen eigenen Zugang nicht zurücksetzen." },
      { status: 400 }
    );
  }

  const eigeneRolle = session?.user.rolle ?? "";
  if (!darfBenutzerVerwalten(eigeneRolle, existing.rolle)) {
    return NextResponse.json(
      {
        error: `Als ${eigeneRolle} kannst du den Zugang eines ${existing.rolle}-Accounts nicht zurücksetzen.`,
      },
      { status: 403 }
    );
  }

  const aktivierungsCode = generateActivationCode();
  const codeHash = await bcrypt.hash(aktivierungsCode, 12);

  const updated = await prisma.person.update({
    where: { id },
    data: { aktivierungsCode: codeHash, mussPasswortAendern: true, passwordHash: null },
    select: USER_SELECT,
  });

  // Klartext-Code wird nur einmalig in dieser Antwort zurückgegeben
  return NextResponse.json({ ...updated, aktivierungsCode });
}
