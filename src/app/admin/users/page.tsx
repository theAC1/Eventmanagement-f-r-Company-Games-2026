import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);

  // Welche Rollen dieser Account vergeben darf, entscheidet die Rechte-Logik —
  // die Seite reicht nur die eigene Rolle durch.
  return <UsersClient eigeneRolle={session?.user?.rolle ?? ""} eigeneId={session?.user?.id ?? ""} />;
}
