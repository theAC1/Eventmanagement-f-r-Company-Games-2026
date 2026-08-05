"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/pills";

type SeedResult = {
  users: { username: string; name: string; rolle: string; password: string }[];
  teams: { nummer: number; name: string; checkinCode: string; qrToken: string }[];
  games: string[];
  gamedayNote: string;
};

type DemoSeedProps = {
  onSeeded: () => void;
};

function CodeChip({ children }: { children: React.ReactNode }) {
  return (
    <code className="tnum rounded-[5px] bg-raised px-1.5 py-0.5 text-ink-2">
      {children}
    </code>
  );
}

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
    <div className="flex flex-col gap-3 border-b border-line px-4 py-2.5 sm:px-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium text-ink">Generalprobe vorbereiten</p>
          <p className="text-xs text-ink-3">
            Legt Demo-Logins, Teams und aktive Games für die Generalprobe an.
          </p>
        </div>
        <Button variant="ghost" onClick={runSeed} disabled={loading} className="shrink-0">
          {loading ? "Lege an…" : "Demo-Daten anlegen"}
        </Button>
      </div>

      {error && <p className="text-xs text-hot-tint">{error}</p>}

      {result && (
        <div className="anim-rise flex flex-col gap-3 rounded-[10px] border border-line bg-surface p-3.5 text-xs">
          <div className="flex items-center gap-2">
            <StatusPill tone="done">Demo-Daten angelegt</StatusPill>
            <span className="text-ink-3">{result.gamedayNote}</span>
          </div>

          <div className="flex flex-col gap-1">
            <p className="cg-label">Logins</p>
            {result.users.map((u) => (
              <div key={u.username} className="flex items-center gap-2 text-ink">
                <CodeChip>{u.username}</CodeChip>
                <span className="text-ink-3">/</span>
                <CodeChip>{u.password}</CodeChip>
                <span className="text-ink-3">({u.rolle})</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <p className="cg-label">Team Check-in-Codes</p>
            {result.teams.map((t) => (
              <div key={t.nummer} className="flex items-center gap-2 text-ink">
                <span className="text-ink-3">
                  <span className="tnum">#{t.nummer}</span> {t.name}:
                </span>
                <CodeChip>{t.checkinCode}</CodeChip>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <p className="cg-label">Aktive Games</p>
            <p className="text-ink">{result.games.join(", ")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
