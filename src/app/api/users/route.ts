import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { generateActivationCode } from "@/lib/activation-code";
import { UserCreateSchema, zodValidationError } from "@/lib/schemas";
import {
  BENUTZER_MIN_ROLLE,
  darfRolleVergeben,
  rollenAblehnung,
} from "@/lib/benutzer-rechte";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  username: true,
  rolle: true,
  istAktiv: true,
  isstMittag: true,
  mussPasswortAendern: true,
  createdAt: true,
} as const;

// GET /api/users
export async function GET() {
  const { error } = await requireRole(BENUTZER_MIN_ROLLE);
  if (error) return error;

  const users = await prisma.person.findMany({
    select: {
      ...USER_SELECT,
      postenCrew: { select: { game: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    users.map(({ postenCrew, ...user }) => ({
      ...user,
      posten: postenCrew.map((c) => c.game),
    })),
  );
}

/**
 * POST /api/users — Account mit einmaligem Aktivierungscode anlegen.
 *
 * Offen ab ADMIN, damit die Orga ihre Schiedsrichter selbst erfassen kann.
 * Vergeben werden dürfen nur Rollen unterhalb der eigenen Stufe.
 */
export async function POST(req: Request) {
  const { error, session } = await requireRole(BENUTZER_MIN_ROLLE);
  if (error) return error;

  const body = await req.json();
  const parsed = UserCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
  }

  const { name, email, username, rolle } = parsed.data;
  const eigeneRolle = session?.user.rolle ?? "";

  if (!darfRolleVergeben(eigeneRolle, rolle)) {
    return NextResponse.json(
      { error: rollenAblehnung(eigeneRolle, rolle) },
      { status: 403 },
    );
  }

  const existing = await prisma.person.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json(
      { error: "Benutzername ist bereits vergeben." },
      { status: 409 },
    );
  }

  const aktivierungsCode = generateActivationCode();
  const codeHash = await bcrypt.hash(aktivierungsCode, 12);

  const user = await prisma.person.create({
    data: {
      name,
      email: email || null,
      username,
      rolle,
      aktivierungsCode: codeHash,
      mussPasswortAendern: true,
    },
    select: USER_SELECT,
  });

  // Klartext-Code wird nur einmalig in dieser Antwort zurückgegeben
  return NextResponse.json({ ...user, aktivierungsCode }, { status: 201 });
}
