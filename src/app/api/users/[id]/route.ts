import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { validatePassword } from "@/lib/password";
import { UserUpdateSchema, zodValidationError } from "@/lib/schemas";
import {
  BENUTZER_MIN_ROLLE,
  darfBenutzerVerwalten,
  darfRolleVergeben,
  rollenAblehnung,
} from "@/lib/benutzer-rechte";
import { loeschFolgen, pruefeLoeschen } from "@/lib/loesch-schutz";

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

/**
 * PUT /api/users/[id] — offen ab ADMIN, aber nur für Accounts unterhalb der
 * eigenen Stufe. Der eigene Account bleibt änderbar (Name, Passwort, Mittag),
 * die eigene Rolle nicht.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireRole(BENUTZER_MIN_ROLLE);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = UserUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
  }

  const { name, email, username, password, rolle, istAktiv, isstMittag } = parsed.data;

  const existing = await prisma.person.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  const eigeneRolle = session?.user.rolle ?? "";
  const istSelbst = session?.user?.id === id;

  if (!istSelbst && !darfBenutzerVerwalten(eigeneRolle, existing.rolle)) {
    return NextResponse.json(
      {
        error: `Als ${eigeneRolle} kannst du keine Accounts mit der Rolle ${existing.rolle} bearbeiten.`,
      },
      { status: 403 }
    );
  }

  if (rolle !== undefined && rolle !== existing.rolle) {
    if (istSelbst) {
      return NextResponse.json(
        { error: "Die eigene Rolle kann nicht geändert werden." },
        { status: 403 }
      );
    }
    if (!darfRolleVergeben(eigeneRolle, rolle)) {
      return NextResponse.json(
        { error: rollenAblehnung(eigeneRolle, rolle) },
        { status: 403 }
      );
    }
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
  if (isstMittag !== undefined) updateData.isstMittag = isstMittag;
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

/**
 * DELETE /api/users/[id] — offen ab ADMIN für Accounts unterhalb der eigenen
 * Stufe. Posten-Zuteilungen gehen per Cascade mit; erfasste Ergebnisse und
 * QR-Scans hängen am Namen der Person und blockieren das Löschen.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireRole(BENUTZER_MIN_ROLLE);
  if (error) return error;

  const { id } = await params;

  if (session?.user?.id === id) {
    return NextResponse.json(
      { error: "Du kannst dich nicht selbst löschen." },
      { status: 400 }
    );
  }

  const target = await prisma.person.findUnique({
    where: { id },
    select: {
      name: true,
      rolle: true,
      _count: {
        select: {
          ergebnisseEingetragen: true,
          qrScans: true,
          postenCrew: true,
          slotEinsaetze: true,
        },
      },
    },
  });
  if (!target) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }
  if (target.rolle === "OWNER") {
    return NextResponse.json(
      { error: "Der OWNER-Account kann nicht gelöscht werden." },
      { status: 400 }
    );
  }

  const eigeneRolle = session?.user.rolle ?? "";
  if (!darfBenutzerVerwalten(eigeneRolle, target.rolle)) {
    return NextResponse.json(
      {
        error: `Als ${eigeneRolle} kannst du keine Accounts mit der Rolle ${target.rolle} löschen.`,
      },
      { status: 403 }
    );
  }

  const entscheid = pruefeLoeschen(
    `Der Account "${target.name}"`,
    [
      { was: "eingetragene Ergebnisse", anzahl: target._count.ergebnisseEingetragen },
      { was: "QR-Verifikationen", anzahl: target._count.qrScans },
    ],
    "Deaktiviere den Account stattdessen — die Zuordnung der Ergebnisse bleibt so erhalten.",
  );
  if (!entscheid.erlaubt) {
    return NextResponse.json({ error: entscheid.grund }, { status: 409 });
  }

  await prisma.person.delete({ where: { id } });
  return NextResponse.json({
    ok: true,
    folgen: loeschFolgen([
      { was: "Posten-Zuteilungen", anzahl: target._count.postenCrew },
      { was: "Slot-Einsätze", anzahl: target._count.slotEinsaetze },
    ]),
  });
}
