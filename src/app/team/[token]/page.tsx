"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type TeamInfo = {
  id: string;
  name: string;
  nummer: number;
};

type Ergebnis = {
  id: string;
  gamePunkte: number | null;
  rangImGame: number | null;
  rangPunkte: number | null;
  status: string;
  game: { name: string };
};

type RanglisteEntry = {
  teamId: string;
  teamName: string;
  rangPunkteSumme: number;
  gamesGespielt: number;
  gamesTotal: number;
  gesamtRang: number;
};

export default function TeamPortalPage() {
  const params = useParams();
  const token = params.token as string;

  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [ergebnisse, setErgebnisse] = useState<Ergebnis[]>([]);
  const [rangliste, setRangliste] = useState<RanglisteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // QR-Token verifizieren und Team laden
    fetch("/api/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrToken: token }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Ungültiger QR-Code");
        return r.json();
      })
      .then((data) => {
        setTeam({ id: data.teamId, name: data.teamName, nummer: data.teamNummer });
        return Promise.all([
          fetch(`/api/ergebnisse?teamId=${data.teamId}`).then((r) => r.json()),
          fetch("/api/rangliste").then((r) => r.json()),
        ]);
      })
      .then(([erg, rang]) => {
        setErgebnisse(erg);
        setRangliste(rang.rangliste ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  // Auto-refresh
  useEffect(() => {
    if (!team) return;
    const interval = setInterval(() => {
      Promise.all([
        fetch(`/api/ergebnisse?teamId=${team.id}`).then((r) => r.json()),
        fetch("/api/rangliste").then((r) => r.json()),
      ]).then(([erg, rang]) => {
        setErgebnisse(erg);
        setRangliste(rang.rangliste ?? []);
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [team]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-zinc-500">Lade Team-Portal...</p>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error ?? "Team nicht gefunden"}</p>
        <Link href="/" className="text-sm text-zinc-500">Startseite</Link>
      </div>
    );
  }

  const myRang = rangliste.find((r) => r.teamId === team.id);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold">#{team.nummer} {team.name}</span>
          </div>
          <Link href="/scoreboard" className="text-xs text-zinc-500">Rangliste</Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Aktuelle Position */}
        {myRang && (
          <div className="border border-zinc-800 rounded-lg p-5 text-center space-y-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Aktuelle Position</p>
            <p className="text-5xl font-bold">{myRang.gesamtRang}.</p>
            <p className="text-sm text-zinc-400">
              {myRang.rangPunkteSumme} Rangpunkte &middot;{" "}
              {myRang.gamesGespielt}/{myRang.gamesTotal} Games
            </p>
          </div>
        )}

        {/* Ergebnisse */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            Deine Ergebnisse
          </h2>
          {ergebnisse.length === 0 ? (
            <p className="text-sm text-zinc-600">Noch keine Ergebnisse</p>
          ) : (
            <div className="space-y-2">
              {ergebnisse.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between border border-zinc-800 rounded-lg px-4 py-3"
                >
                  <div>
                    <span className="text-sm font-medium">{e.game.name}</span>
                    {e.gamePunkte !== null && (
                      <span className="ml-2 text-xs text-zinc-500">
                        {e.gamePunkte} Punkte
                      </span>
                    )}
                  </div>
                  {e.rangImGame !== null && (
                    <span
                      className={`text-sm font-bold ${
                        e.rangImGame <= 3 ? "text-amber-400" : "text-zinc-400"
                      }`}
                    >
                      #{e.rangImGame}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Rangliste (kompakt) */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            Rangliste
          </h2>
          <div className="space-y-1">
            {rangliste.slice(0, 10).map((r) => (
              <div
                key={r.teamId}
                className={`flex items-center justify-between text-sm px-3 py-2 rounded-lg ${
                  r.teamId === team.id
                    ? "bg-blue-950/30 border border-blue-800"
                    : "border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 text-right text-zinc-500 tabular-nums">
                    {r.gesamtRang}
                  </span>
                  <span className={r.teamId === team.id ? "font-bold" : ""}>
                    {r.teamName}
                  </span>
                </div>
                <span className="tabular-nums text-zinc-400">
                  {r.rangPunkteSumme}
                </span>
              </div>
            ))}
            {rangliste.length > 10 && (
              <Link
                href="/scoreboard"
                className="block text-center text-xs text-zinc-500 py-2"
              >
                Alle anzeigen
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
