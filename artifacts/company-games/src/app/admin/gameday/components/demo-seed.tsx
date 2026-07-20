"use client";

import { useState } from "react";

type SeedResult = {
  users: { username: string; name: string; rolle: string; password: string }[];
  teams: { nummer: number; name: string; checkinCode: string; qrToken: string }[];
  games: string[];
  gamedayNote: string;
};

type DemoSeedProps = {
  onSeeded: () => void;
};

export function DemoSeed({ onSeeded }: DemoSeedProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SeedResult | null>(null);

  const runSeed = async () => {
    if (
      !window.confirm(
        "Demo-/Generalproben-Daten anlegen? Legt Demo-Logins, Teams und aktive Games an (idempotent, mehrfach ausführbar).",
      )
    )
      return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gameday/seed-demo", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setResult(data as SeedResult);
      onSeeded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-zinc-200">Generalprobe vorbereiten</p>
          <p className="text-xs text-zinc-500">
            Legt Demo-Logins, Teams und aktive Games für die Generalprobe an.
          </p>
        </div>
        <button
          onClick={runSeed}
          disabled={loading}
          className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-md border border-zinc-600 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition disabled:opacity-50"
        >
          {loading ? "Lege an…" : "Demo-Daten anlegen"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {result && (
        <div className="space-y-3 rounded-md border border-emerald-800/60 bg-emerald-900/20 px-3 py-3 text-xs">
          <p className="text-emerald-300 font-medium">
            Demo-Daten angelegt · {result.gamedayNote}
          </p>

          <div className="space-y-1">
            <p className="text-zinc-400 uppercase tracking-wide text-[10px]">Logins</p>
            {result.users.map((u) => (
              <div key={u.username} className="flex items-center gap-2 text-zinc-200">
                <code className="rounded bg-zinc-800 px-1.5 py-0.5">{u.username}</code>
                <span className="text-zinc-500">/</span>
                <code className="rounded bg-zinc-800 px-1.5 py-0.5">{u.password}</code>
                <span className="text-zinc-500">({u.rolle})</span>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <p className="text-zinc-400 uppercase tracking-wide text-[10px]">Team Check-in-Codes</p>
            {result.teams.map((t) => (
              <div key={t.nummer} className="flex items-center gap-2 text-zinc-200">
                <span className="text-zinc-400">
                  #{t.nummer} {t.name}:
                </span>
                <code className="rounded bg-zinc-800 px-1.5 py-0.5">{t.checkinCode}</code>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <p className="text-zinc-400 uppercase tracking-wide text-[10px]">Aktive Games</p>
            <p className="text-zinc-200">{result.games.join(", ")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
