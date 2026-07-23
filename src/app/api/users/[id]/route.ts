import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { validatePassword } from "@/lib/password";
import { UserUpdateSchema, zodValidationError } from "@/lib/schemas";

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

// PUT /api/users/[id] — nur OWNER
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole("OWNER");
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = UserUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
  }

  const { name, email, username, password, rolle, istAktiv } = parsed.data;

  const existing = await prisma.person.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  // OWNER-Account-Integrität schützen: nicht deaktivieren, nicht wegrollen
  if (existing.rolle === "OWNER") {
    if (istAktiv === false) {
      return NextResponse.json(
        { error: "Der OWNER-Account kann nicht deaktiviert werden." },
        { status: 400 }
      );
    }
    if (rolle !== undefined && rolle !== "OWNER") {
      return NextResponse.json(
        { error: "Die OWNER-Rolle kann nicht entzogen werden." },
        { status: 400 }
      );
    }
  }

  if (password) {
    const check = validatePassword(password);
    if (!check.ok) {
      return NextResponse.json(
        {
          error: `Passwort erfüllt die Anforderungen nicht: ${check.fehler.join(", ")}`,
          regeln: check.regeln,
        },
        { status: 400 }
      );
    }
  }

  if (rolle === "OWNER" && existing.rolle !== "OWNER") {
    const ownerExists = await prisma.person.findFirst({ where: { rolle: "OWNER" } });
    if (ownerExists) {
      return NextResponse.json(
        { error: "Es kann nur einen OWNER-Account geben." },
        { status: 409 }
      );
    }
  }

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
    updateData.passwordHash = await bcrypt.hash(password, 12);
  }

  const user = await prisma.person.update({
    where: { id },
    data: updateData,
    select: USER_SELECT,
  });

  return NextResponse.json(user);
}

// DELETE /api/users/[id] — nur OWNER
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireRole("OWNER");
  if (error) return error;

  const { id } = await params;

  if (session?.user?.id === id) {
    return NextResponse.json(
      { error: "Du kannst dich nicht selbst löschen." },
      { status: 400 }
    );
  }

  const target = await prisma.person.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }
  if (target.rolle === "OWNER") {
    return NextResponse.json(
      { error: "Der OWNER-Account kann nicht gelöscht werden." },
      { status: 400 }
    );
  }

  await prisma.person.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
