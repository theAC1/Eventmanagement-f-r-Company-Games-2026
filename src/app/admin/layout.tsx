import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className="text-sm font-semibold tracking-tight hover:text-white transition"
            >
              CG26 Admin
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
              >
                Games
              </Link>
              <Link
                href="/admin/teams"
                className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
              >
                Teams
              </Link>
              <Link
                href="/admin/materials"
                className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
              >
                Material
              </Link>
              <Link
                href="/admin/schedule"
                className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
              >
                Zeitplan
              </Link>
              <Link
                href="/admin/situationsplan"
                className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
              >
                Lageplan
              </Link>
              <Link
                href="/admin/gameday"
                className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
              >
                Gameday
              </Link>
            </nav>
          </div>
          <Link
            href="/"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition"
          >
            Startseite
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}
