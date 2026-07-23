import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { generateActivationCode } from "@/lib/activation-code";
import { UserCreateSchema, zodValidationError } from "@/lib/schemas";

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

// GET /api/users
export async function GET() {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  const users = await prisma.person.findMany({
    select: USER_SELECT,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}

// POST /api/users — nur OWNER, erstellt Account mit einmaligem Aktivierungscode
export async function POST(req: Request) {
  const { error } = await requireRole("OWNER");
  if (error) return error;

  const body = await req.json();
  const parsed = UserCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
  }

  const { name, email, username, rolle } = parsed.data;

  if (rolle === "OWNER") {
    const ownerExists = await prisma.person.findFirst({ where: { rolle: "OWNER" } });
    if (ownerExists) {
      return NextResponse.json(
        { error: "Es kann nur einen OWNER-Account geben." },
        { status: 409 }
      );
    }
  }

  const existing = await prisma.person.findUnique({
    where: { username },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Benutzername ist bereits vergeben." },
      { status: 409 }
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
