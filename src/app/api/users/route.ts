import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

// GET /api/users — Alle Benutzer auflisten (nur ADMIN)
export async function GET() {
  const { error, session } = await requireRole("ADMIN");
  if (error) return error;

  const users = await prisma.person.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      rolle: true,
      istAktiv: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}

// POST /api/users — Neuen Benutzer erstellen (nur ADMIN)
export async function POST(req: Request) {
  const { error, session } = await requireRole("ADMIN");
  if (error) return error;

  const body = await req.json();
  const { name, email, username, password, rolle } = body;

  if (!name || !username || !password || !rolle) {
    return NextResponse.json(
      { error: "Name, Benutzername, Passwort und Rolle sind Pflicht." },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Passwort muss mindestens 6 Zeichen lang sein." },
      { status: 400 }
    );
  }

  const validRoles = ["ADMIN", "ORGA", "SCHIEDSRICHTER", "HELFER"];
  if (!validRoles.includes(rolle)) {
    return NextResponse.json(
      { error: `Ungültige Rolle. Erlaubt: ${validRoles.join(", ")}` },
      { status: 400 }
    );
  }

  // Username-Duplikat prüfen
  const existing = await prisma.person.findUnique({
    where: { username },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Benutzername ist bereits vergeben." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.person.create({
    data: {
      name,
      email: email || null,
      username,
      passwordHash,
      rolle,
    },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      rolle: true,
      istAktiv: true,
      createdAt: true,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
