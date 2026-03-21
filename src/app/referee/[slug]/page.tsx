"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type WertungslogikField = {
  name: string;
  typ: string;
  label: string;
};

type Wertungslogik = {
  typ?: string;
  einheit?: string;
  richtung?: string;
  messung?: string;
  tiebreaker?: string;
  eingabefelder?: WertungslogikField[];
  formel?: string;
  strafen?: Record<string, number>;
  nicht_geschafft?: string;
  levels?: { name: string; grundpunkte: number }[];
  zeit_bonus?: string;
  optionen?: { name: string; punkte_erfolg: number; punkte_fail: number }[];
  show_modus?: boolean;
};

type GameVariante = {
  id: string;
  name: string;
  beschreibung: string | null;
  istAktiv: boolean;
};

type MaterialItem = {
  id: string;
  name: string;
  menge: string | null;
  status: string;
};

type Game = {
  id: string;
  name: string;
  slug: string;
  typ: string;
  status: string;
  modus: string;
  teamsProSlot: number;
  kurzbeschreibung: string | null;
  einfuehrungMin: number;
  playtimeMin: number;
  reserveMin: number;
  regeln: string | null;
  wertungstyp: string | null;
  wertungslogik: Wertungslogik | null;
  flaecheLaengeM: number | null;
  flaecheBreiteM: number | null;
  helferAnzahl: number;
  stromNoetig: boolean;
  varianten: GameVariante[];
  materialItems: MaterialItem[];
};

export default function RefereeGamePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/games/by-slug/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error("Game nicht gefunden");
        return r.json();
      })
      .then(setGame)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="flex items-center justify-center h-64 text-zinc-500">Lade...</div>;
  if (error || !game) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-red-400">{error ?? "Nicht gefunden"}</p>
      <Link href="/referee" className="text-sm text-zinc-400 hover:text-white">Zurück</Link>
    </div>
  );

  const totalMin = game.einfuehrungMin + game.playtimeMin + game.reserveMin;
  const wl = game.wertungslogik;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <Link href="/referee" className="text-xs text-zinc-500 hover:text-white transition">
          &larr; Alle Stationen
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mt-2">{game.name}</h1>
        {game.kurzbeschreibung && (
          <p className="text-zinc-400 mt-1">{game.kurzbeschreibung}</p>
        )}
      </div>

      {/* Ergebnis eintragen Button */}
      <Link
        href={`/referee/${slug}/eingabe`}
        className="block w-full py-3 bg-white text-black text-center text-sm font-semibold rounded-lg hover:bg-zinc-200 transition"
      >
        Ergebnis eintragen
      </Link>

      {/* Quick Info Bar */}
      <div className="flex flex-wrap gap-3">
        <InfoChip label="Modus" value={game.modus === "DUELL" ? `Duell (${game.teamsProSlot} Teams)` : "Solo"} />
        <InfoChip label="Spielzeit" value={`${game.playtimeMin} min`} />
        <InfoChip label="Slot Total" value={`${totalMin} min`} />
        <InfoChip
          label="Zeitablauf"
          value={`${game.einfuehrungMin}' Einführung → ${game.playtimeMin}' Spiel → ${game.reserveMin}' Reserve`}
        />
        {game.flaecheLaengeM && game.flaecheBreiteM && (
          <InfoChip label="Fläche" value={`${game.flaecheLaengeM} × ${game.flaecheBreiteM} m`} />
        )}
        <InfoChip label="Helfer" value={`${game.helferAnzahl}`} />
        {game.stromNoetig && <InfoChip label="Strom" value="Ja" highlight />}
      </div>

      {/* Aktive Variante */}
      {game.varianten.length > 0 && (
        <section className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4">
          <p className="text-xs text-amber-400 uppercase tracking-wider font-medium mb-1">
            Aktive Variante
          </p>
          <p className="font-medium">{game.varianten[0].name}</p>
          {game.varianten[0].beschreibung && (
            <p className="text-sm text-zinc-400 mt-1">{game.varianten[0].beschreibung}</p>
          )}
        </section>
      )}

      {/* Regeln */}
      {game.regeln && (
        <section className="border border-zinc-800 rounded-lg p-5 space-y-3">
          <h2 className="text-lg font-semibold">Regeln</h2>
          <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {game.regeln}
          </div>
        </section>
      )}

      {/* Wertung */}
      {wl && (
        <section className="border border-zinc-800 rounded-lg p-5 space-y-4">
          <h2 className="text-lg font-semibold">Wertung</h2>

          <div className="flex flex-wrap gap-3 text-sm">
            {wl.typ && <InfoChip label="Typ" value={wl.typ} />}
            {wl.einheit && <InfoChip label="Einheit" value={wl.einheit} />}
            {wl.richtung && (
              <InfoChip
                label="Richtung"
                value={wl.richtung === "hoechster_gewinnt" ? "Höchster gewinnt" : "Niedrigster gewinnt"}
              />
            )}
            {wl.tiebreaker && <InfoChip label="Tiebreaker" value={wl.tiebreaker} />}
          </div>

          {/* Eingabefelder */}
          {wl.eingabefelder && wl.eingabefelder.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-2">
                Einzutragende Werte
              </p>
              <div className="space-y-2">
                {wl.eingabefelder.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 border border-zinc-800 rounded-lg px-4 py-2.5"
                  >
                    <span className="text-sm font-medium">{f.label}</span>
                    <span className="text-xs text-zinc-600">({f.typ})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Levels (Radio Runner) */}
          {wl.levels && (
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-2">
                Schwierigkeitsstufen
              </p>
              <div className="space-y-1">
                {wl.levels.map((l, i) => (
                  <div key={i} className="flex items-center justify-between border border-zinc-800 rounded-lg px-4 py-2">
                    <span className="text-sm font-medium capitalize">{l.name}</span>
                    <span className="text-sm text-zinc-400">{l.grundpunkte} Grundpunkte</span>
                  </div>
                ))}
              </div>
              {wl.zeit_bonus && (
                <p className="text-xs text-zinc-500 mt-2">Zeitbonus: {wl.zeit_bonus}</p>
              )}
            </div>
          )}

          {/* Optionen (Eierfall) */}
          {wl.optionen && (
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-2">
                Risikowahl
              </p>
              <div className="space-y-1">
                {wl.optionen.map((o, i) => (
                  <div key={i} className="flex items-center justify-between border border-zinc-800 rounded-lg px-4 py-2">
                    <span className="text-sm font-medium">{o.name}</span>
                    <span className="text-sm text-emerald-400">{o.punkte_erfolg} Punkte</span>
                  </div>
                ))}
              </div>
              {wl.show_modus && (
                <p className="text-xs text-amber-400 mt-2">Show-Modus aktiv</p>
              )}
            </div>
          )}

          {/* Strafen (Lava Becken) */}
          {wl.strafen && (
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-2">
                Strafen
              </p>
              <div className="space-y-1">
                {Object.entries(wl.strafen).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between border border-zinc-800 rounded-lg px-4 py-2">
                    <span className="text-sm capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="text-sm text-red-400">+{val} Sek.</span>
                  </div>
                ))}
              </div>
              {wl.nicht_geschafft && (
                <p className="text-xs text-red-400 mt-2">
                  Nicht geschafft: {wl.nicht_geschafft}
                </p>
              )}
            </div>
          )}

          {/* Formel (Kisten Stappeln) */}
          {wl.formel && (
            <div className="bg-zinc-900 rounded-lg px-4 py-3">
              <p className="text-xs text-zinc-500 mb-1">Formel</p>
              <code className="text-sm font-mono text-zinc-200">{wl.formel}</code>
            </div>
          )}
        </section>
      )}

      {/* Material */}
      {game.materialItems.length > 0 && (
        <section className="border border-zinc-800 rounded-lg p-5 space-y-3">
          <h2 className="text-lg font-semibold">Material</h2>
          <div className="space-y-1">
            {game.materialItems.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between text-sm border border-zinc-800/50 rounded px-3 py-2"
              >
                <span>{m.name}</span>
                <span className="text-zinc-500">{m.menge ?? "–"}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function InfoChip({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`px-3 py-1.5 rounded-lg border text-sm ${
        highlight
          ? "border-amber-700 bg-amber-950/30 text-amber-300"
          : "border-zinc-800 bg-zinc-900/50"
      }`}
    >
      <span className="text-zinc-500 text-xs">{label}: </span>
      <span className={highlight ? "" : "text-zinc-200"}>{value}</span>
    </div>
  );
}
