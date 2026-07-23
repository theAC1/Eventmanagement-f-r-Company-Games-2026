"use client";

import { useEffect, useState } from "react";
import { useParams } from 'wouter';
import { Link } from 'wouter';

type Slot = {
  slotId: string;
  startZeit: string;
  endZeit: string;
  runde: number;
  status: string;
  gameName: string;
  gameSlug: string;
};

type Ergebnis = {
  id: string;
  gameName: string;
  gameSlug: string;
  gamePunkte: number | null;
  rangPunkte: number | null;
  status: string;
};

type TeamPortal = {
  teamId: string;
  teamName: string;
  teamNummer: number;
  teamFarbe: string;
  teamLogo: string | null;
  slots: Slot[];
  ergebnisse: Ergebnis[];
  rangPunkteSumme: number;
  lageplanUrl: string | null;
};

export default function TeamPortalPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<TeamPortal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/team/${token}`)
        .then((r) => {
          if (!r.ok) throw new Error("Ungültiger QR-Code");
          return r.json();
        })
        .then((d) => setData(d))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-zinc-500">Lade Team-Portal...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error ?? "Team nicht gefunden"}</p>
        <Link to="/" className="text-sm text-zinc-500">Startseite</Link>
      </div>
    );
  }

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // Determine current/next slot: first slot not yet ended
  const nextSlotId = data.slots.find(
    (s) => s.status !== "ABGESCHLOSSEN" && toMin(s.endZeit) >= nowMin,
  )?.slotId;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ backgroundColor: data.teamFarbe }}
          >
            {data.teamNummer}
          </div>
          <span className="text-sm font-semibold truncate">{data.teamName}</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-8">
        {/* Spielplan */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            Spielplan
          </h2>
          {data.slots.length === 0 ? (
            <p className="text-sm text-zinc-600">Noch kein Zeitplan verfügbar</p>
          ) : (
            <div className="space-y-2">
              {data.slots.map((s) => {
                const done = s.status === "ABGESCHLOSSEN";
                const isNext = s.slotId === nextSlotId;
                return (
                  <div
                    key={s.slotId}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                      done
                        ? "border-zinc-800/50 opacity-40"
                        : isNext
                          ? "border-emerald-700 bg-emerald-950/20"
                          : "border-zinc-800"
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-medium truncate">{s.gameName}</p>
                      <p className="text-xs text-zinc-500">Runde {s.runde}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono tabular-nums">
                        {s.startZeit}–{s.endZeit}
                      </p>
                      {isNext && (
                        <p className="text-xs text-emerald-400">Als Nächstes</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Punkte */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
              Punkte
            </h2>
            <span className="text-sm text-zinc-300">
              <span className="font-bold text-white">{data.rangPunkteSumme}</span>{" "}
              Rangpunkte
            </span>
          </div>
          {data.ergebnisse.length === 0 ? (
            <p className="text-sm text-zinc-600">Noch keine Ergebnisse</p>
          ) : (
            <div className="space-y-2">
              {data.ergebnisse.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between border border-zinc-800 rounded-lg px-4 py-3"
                >
                  <span className="text-sm font-medium truncate min-w-0 pr-3">{e.gameName}</span>
                  <div className="text-right text-sm shrink-0">
                    {e.gamePunkte !== null && (
                      <span className="text-zinc-400">{e.gamePunkte} Pkt</span>
                    )}
                    {e.rangPunkte !== null && (
                      <span className="ml-3 font-bold text-white tabular-nums">
                        +{e.rangPunkte}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Lageplan */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            Lageplan
          </h2>
          {data.lageplanUrl ? (
            <a
              href={data.lageplanUrl}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg overflow-hidden border border-zinc-800"
            >
              <img
                src={data.lageplanUrl}
                alt="Lageplan"
                className="w-full h-auto"
              />
            </a>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-600">
              Lageplan noch nicht verfügbar
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
