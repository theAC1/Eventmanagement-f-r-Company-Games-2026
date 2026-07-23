import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { generateActivationCode } from "@/lib/activation-code";

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

// POST /api/users/[id]/reset-activation — nur OWNER, neuen Aktivierungscode generieren
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireRole("OWNER");
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
