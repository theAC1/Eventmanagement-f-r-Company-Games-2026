import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions, hasMinRole } from "./auth";

/**
 * Holt die aktuelle Session. Gibt null zurück wenn nicht eingeloggt.
 */
export async function getSession() {
  return getServerSession(authOptions);
}

/**
 * Prüft ob der User eingeloggt ist und die nötige Rolle hat.
 * Gibt die Session zurück oder eine 401/403 Response.
 */
export async function requireRole(minRole: string) {
  const session = await getSession();

  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 }),
      session: null,
    };
  }

  if (!hasMinRole(session.user.rolle, minRole)) {
    return {
      error: NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 }),
      session: null,
    };
  }

  return { error: null, session };
}

/**
 * Gibt die User-ID aus der Session zurück (für Audit-Trail).
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}
