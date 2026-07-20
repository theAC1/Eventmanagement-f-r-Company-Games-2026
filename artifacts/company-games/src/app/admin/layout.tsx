"use client";

import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { LogoutButton } from "./logout-button";
import { KvpFloatingButton } from "./kvp-button";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const isAdmin = user?.rolle === "ADMIN";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              to="/admin"
              className="flex items-center gap-2 hover:opacity-80 transition"
            >
              <img src="/images/logo.png" alt="CG26" className="h-8 w-auto" />
              <span className="text-sm font-semibold tracking-tight">Admin</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                to="/admin"
                className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
              >
                Games
              </Link>
              <Link
                to="/admin/teams"
                className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
              >
                Teams
              </Link>
              <Link
                to="/admin/materials"
                className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
              >
                Material
              </Link>
              <Link
                to="/admin/schedule"
                className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
              >
                Zeitplan
              </Link>
              <Link
                to="/admin/einsatzplan"
                className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
              >
                Einsatzplan
              </Link>
              <Link
                to="/admin/situationsplan"
                className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
              >
                Lageplan
              </Link>
              <Link
                to="/admin/gameday"
                className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
              >
                Gameday
              </Link>
              <Link
                to="/admin/ergebnisse"
                className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
              >
                Ergebnisse
              </Link>
              {isAdmin && (
                <Link
                  to="/admin/users"
                  className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
                >
                  Benutzer
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/admin/kvp"
                  className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
                >
                  KVP
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-xs text-zinc-500">
                {user.name}
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] uppercase tracking-wider">
                  {user.rolle}
                </span>
              </span>
            )}
            <LogoutButton />
            <Link
              to="/"
              className="text-xs text-zinc-500 hover:text-zinc-300 transition"
            >
              Startseite
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>

      {/* KVP Floating Button — auf allen Admin-Seiten */}
      <KvpFloatingButton />
    </div>
  );
}
