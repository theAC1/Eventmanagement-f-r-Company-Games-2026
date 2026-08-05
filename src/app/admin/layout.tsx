import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasMinRole } from "@/lib/roles";
import { KvpFloatingButton } from "./kvp-button";
import { AdminShell } from "./admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const isAdmin = hasMinRole(session?.user?.rolle ?? "", "ADMIN");

  const [games, teams, materials] = await Promise.all([
    prisma.game.count().catch(() => 0),
    prisma.team.count().catch(() => 0),
    prisma.materialItem.count().catch(() => 0),
  ]);

  return (
    <AdminShell
      userName={session?.user?.name ?? "Unbekannt"}
      userRolle={session?.user?.rolle ?? ""}
      isAdmin={isAdmin}
      version={process.env.BUILD_VERSION ?? "dev"}
      counts={{ games, teams, materials }}
    >
      {children}
      <KvpFloatingButton />
    </AdminShell>
  );
}
