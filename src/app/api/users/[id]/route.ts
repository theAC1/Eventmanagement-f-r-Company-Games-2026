import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

// PUT /api/users/[id] — Benutzer bearbeiten (nur ADMIN)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { name, email, username, password, rolle, istAktiv } = body;

  const existing = await prisma.person.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  // Username-Duplikat prüfen (falls geändert)
  if (username && username !== existing.username) {
    const dup = await prisma.person.findUnique({ where: { username } });
    if (dup) {
      return NextResponse.json({ error: "Benutzername ist bereits vergeben." }, { status: 409 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email || null;
  if (username !== undefined) updateData.username = username;
  if (rolle !== undefined) updateData.rolle = rolle;
  if (istAktiv !== undefined) updateData.istAktiv = istAktiv;
  if (password) {
    if (password.length < 6) {
      return NextResponse.json({ error: "Passwort muss mindestens 6 Zeichen lang sein." }, { status: 400 });
    }
    updateData.passwordHash = await bcrypt.hash(password, 12);
  }

  const user = await prisma.person.update({
    where: { id },
    data: updateData,
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

  return NextResponse.json(user);
}

// DELETE /api/users/[id] — Benutzer löschen (nur ADMIN)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireRole("ADMIN");
  if (error) return error;

  const { id } = await params;

  // Sich selbst löschen verhindern
  if (session?.user?.id === id) {
    return NextResponse.json(
      { error: "Du kannst dich nicht selbst löschen." },
      { status: 400 }
    );
  }

  await prisma.person.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
