"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { StatusPill } from "@/components/ui/pills";
import { ProgressBar } from "@/components/ui/progress";

type RanglisteEntry = {
  teamId: string;
  teamName: string;
  rangPunkteSumme: number;
  gamesGespielt: number;
  gamesTotal: number;
  gesamtRang: number;
  platzierungen: Record<number, number>;
  rangGesperrt?: boolean;
};

type RanglisteResponse = {
  rangliste: RanglisteEntry[];
  totalGames: number;
  totalTeams: number;
  ergebnisseEingetragen: number;
  offeneKorrekturen?: number;
  modus?: "INAKTIV" | "TEST" | "HOT";
  enthaeltTestErgebnisse?: boolean;
};

function rangColor(rang: number): string {
  if (rang === 1) return "var(--warn)";
  if (rang === 2) return "var(--ink-2)";
  if (rang === 3) return "var(--bronze)";
  return "var(--ink-3)";
}

function rangTextClass(rang: number): string {
  if (rang === 1) return "text-warn";
  if (rang === 2) return "text-ink-2";
  if (rang === 3) return "text-bronze";
  return "text-ink-3";
}

export default function ScoreboardPage() {
  const [data, setData] = useState<RanglisteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadData = () => {
    fetch("/api/rangliste")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLastUpdate(new Date());
        setFetchError(null);
      })
      .catch((err) => {
        setFetchError(`Verbindung verloren: ${err.message}`);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    // Auto-refresh alle 10 Sekunden (bis Socket.io kommt)
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-ink">
        <p className="text-sm text-ink-3">Lade Rangliste...</p>
      </div>
    );
  }

  if (!data || data.rangliste.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg text-ink">
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">Company Games 2026</h1>
        <p className="text-sm text-ink-3">Noch keine Ergebnisse eingetragen</p>
        <Link
          href="/"
          className="text-xs text-ink-3 transition-colors duration-150 hover:text-ink"
        >
          Startseite
        </Link>
      </div>
    );
  }

  const totalErgebnisse = data.totalGames * data.totalTeams;
  const progressPct =
    totalErgebnisse > 0 ? (data.ergebnisseEingetragen / totalErgebnisse) * 100 : 0;

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur-sm">
        <div className="mx-auto flex h-[52px] max-w-4xl items-center gap-3 px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="CG26" className="h-[26px] w-auto" />
          <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
            Live-Rangliste
          </h1>
          <span className="flex-1" />
          <div className="flex items-center gap-2.5">
            <span className="tnum text-[11px] text-label">
              {data.ergebnisseEingetragen}/{totalErgebnisse}
            </span>
            <ProgressBar pct={progressPct} height={5} className="w-16" />
          </div>
          {lastUpdate && (
            <span className="tnum text-[11px] text-label">
              {lastUpdate.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {fetchError && <StatusPill tone="hot">OFFLINE</StatusPill>}
          <ThemeToggle />
        </div>
      </header>

      {/* Test-Modus Hinweis */}
      {data.enthaeltTestErgebnisse && (
        <div className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-4xl items-center justify-center gap-2.5 px-4 py-2">
            <StatusPill tone="action">TEST-MODUS</StatusPill>
            <span className="text-xs text-ink-3">
              Angezeigte Ergebnisse sind Probelauf-Daten
            </span>
          </div>
        </div>
      )}

      {/* Rangliste */}
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="flex flex-col gap-2">
          {data.rangliste.map((entry) => {
            const isTop3 = entry.gesamtRang <= 3;
            return (
              <div
                key={entry.teamId}
                className="relative flex h-14 items-center gap-4 overflow-hidden rounded-xl border border-line bg-surface px-4"
              >
                <span
                  className={`tnum w-7 shrink-0 text-right text-[15px] font-bold ${rangTextClass(entry.gesamtRang)}`}
                >
                  {entry.gesamtRang}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-[550] text-ink">
                  {entry.teamName}
                </span>
                {entry.rangGesperrt === false && (
                  <span
                    title="Korrekturfrist läuft noch — Rang kann sich ändern"
                    className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-warn"
                  >
                    provisorisch
                  </span>
                )}
                <span className="tnum shrink-0 text-xs text-ink-3">
                  {entry.gamesGespielt}/{entry.gamesTotal} Games
                </span>
                <span className="tnum shrink-0 text-base font-semibold text-ink">
                  {entry.rangPunkteSumme}
                </span>
                {isTop3 && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-[3px]"
                    style={{ background: rangColor(entry.gesamtRang), opacity: 0.75 }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
