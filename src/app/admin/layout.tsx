import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasMinRole } from "@/lib/roles";
import { KvpFloatingButton } from "./kvp-button";
import { AdminShell } from "./admin-shell";
import type { AdminCounts } from "@/app/api/admin/counts/route";

/**
 * Startwerte für die Navigation. Aktuell gehalten werden sie danach im Client
 * über `/api/admin/counts` — eine Server-Komponente rendert bei einer Mutation
 * nicht neu, ihre Zahlen blieben sonst bis zum nächsten Reload stehen.
 */
async function startCounts(): Promise<AdminCounts> {
  const [games, teams, materials, personen] = await Promise.all([
    prisma.game.count().catch(() => 0),
    prisma.team.count().catch(() => 0),
    prisma.materialItem.count().catch(() => 0),
    prisma.person.count({ where: { istAktiv: true } }).catch(() => 0),
  ]);
  return {
    games,
    teams,
    materials,
    personen,
    posten: games,
    zeitplan: { vorhanden: false, aktuell: true, abweichungen: 0 },
  };
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const isAdmin = hasMinRole(session?.user?.rolle ?? "", "ADMIN");

  return (
    <AdminShell
      userName={session?.user?.name ?? "Unbekannt"}
      userRolle={session?.user?.rolle ?? ""}
      isAdmin={isAdmin}
      version={process.env.BUILD_VERSION ?? "dev"}
      counts={await startCounts()}
    >
      {children}
      <KvpFloatingButton />
    </AdminShell>
  );
}
