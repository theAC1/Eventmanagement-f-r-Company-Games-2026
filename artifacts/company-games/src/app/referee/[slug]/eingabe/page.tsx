"use client";

import { useEffect, useState } from "react";
import { useParams } from 'wouter';
import { useLocation } from 'wouter';
import { Link } from 'wouter';
import { ErgebnisFormular } from "@/components/ergebnis-formular";

type Wertungslogik = {
  typ?: string;
  einheit?: string;
  richtung?: string;
  eingabefelder?: { name: string; typ: string; label: string }[];
  levels?: { name: string; grundpunkte: number }[];
  optionen?: { name: string; punkte_erfolg: number; punkte_fail: number }[];
  strafen?: Record<string, number>;
  nicht_geschafft?: string;
};

type Game = {
  id: string;
  name: string;
  slug: string;
  modus: string;
  teamsProSlot: number;
  wertungslogik: Wertungslogik | null;
};

type Team = { id: string; name: string; nummer: number };

type ConflictEntry = {
  id: string;
  gamePunkte: number;
  status: string;
  eingetragenUm: string;
  rohdaten: Record<string, unknown>;
  team?: { id: string; name: string; nummer: number };
  eingetragenVon?: { id: string; name: string } | null;
};

export default function EingabePage() {
  const params = useParams();
  const [, navigate] = useLocation();
  const slug = params.slug as string;

  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictEntry[] | null>(null);
  const [showConflict, setShowConflict] = useState(false);

  // Formular-State
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedTeamId2, setSelectedTeamId2] = useState(""); // Für Duell
  const [rohdaten, setRohdaten] = useState<Record<string, unknown>>({});
  const [rohdaten2, setRohdaten2] = useState<Record<string, unknown>>({}); // Für Duell Team B

  useEffect(() => {
    Promise.all([
      fetch(`/api/games/by-slug/${slug}`).then((r) => {
        if (!r.ok) throw new Error(`Game laden fehlgeschlagen (HTTP ${r.status})`);
        return r.json();
      }),
      fetch("/api/teams").then((r) => {
        if (!r.ok) throw new Error(`Teams laden fehlgeschlagen (HTTP ${r.status})`);
        return r.json();
      }),
    ]).then(([g, t]) => {
      setGame(g);
      setTeams(t);
      setLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Daten konnten nicht geladen werden");
      setLoading(false);
    });
  }, [slug]);

  const handleSubmit = async (teamId: string, daten: Record<string, unknown>) => {
    if (!game || !teamId) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/ergebnisse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, teamId, rohdaten: daten }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler");
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDuell = async (): Promise<boolean> => {
    if (!selectedTeamId || !selectedTeamId2) {
      setError("Beide Teams auswählen");
      return false;
    }
    setSaving(true);
    setError(null);
    setConflict(null);
    setShowConflict(false);
    try {
      const res = await fetch("/api/ergebnisse/duell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: game!.id,
          teamAId: selectedTeamId,
          rohdatenA: rohdaten,
          teamBId: selectedTeamId2,
          rohdatenB: rohdaten2,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409 && data.conflict) {
          setConflict(Array.isArray(data.existing) ? data.existing : []);
        }
        throw new Error(data.error || "Fehler");
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (game?.modus === "DUELL" && game.teamsProSlot >= 2) {
      const ok = await handleSaveDuell();
      if (ok) {
        setSuccess("Beide Ergebnisse gespeichert");
        setTimeout(() => {
          setSuccess(null);
          setRohdaten({});
          setRohdaten2({});
          setSelectedTeamId("");
          setSelectedTeamId2("");
        }, 1500);
      }
    } else {
      // Solo
      if (!selectedTeamId) {
        setError("Team auswählen");
        return;
      }
      const ok = await handleSubmit(selectedTeamId, rohdaten);
      if (ok) {
        setSuccess("Ergebnis gespeichert");
        setTimeout(() => {
          setSuccess(null);
          setRohdaten({});
          setSelectedTeamId("");
        }, 1500);
      }
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-zinc-500">Lade...</div>;
  if (error && !game) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 text-sm border border-zinc-700 rounded-lg hover:border-zinc-500 transition">
          Erneut versuchen
        </button>
      </div>
    );
  }
  if (!game) return <div className="text-red-400 text-center py-12">Game nicht gefunden</div>;

  const wl = game.wertungslogik;
  const isDuell = game.modus === "DUELL" && game.teamsProSlot >= 2;

  return (
    <div className="space-y-6 pb-12">
      <div>
        <Link to={`/referee/${slug}`} className="text-xs text-zinc-500 hover:text-white transition">
          &larr; {game.name}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mt-2">Ergebnis eintragen</h1>
        <p className="text-sm text-zinc-400">{game.name}</p>
      </div>

      {/* Team-Auswahl */}
      <section className="border border-zinc-800 rounded-lg p-4 space-y-4">
        <div className={isDuell ? "grid grid-cols-2 gap-4" : ""}>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              {isDuell ? "Team A" : "Team"}
            </label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-500"
            >
              <option value="">Team wählen...</option>
              {teams
                .filter((t) => t.id !== selectedTeamId2)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    #{t.nummer} {t.name}
                  </option>
                ))}
            </select>
          </div>
          {isDuell && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Team B
              </label>
              <select
                value={selectedTeamId2}
                onChange={(e) => setSelectedTeamId2(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-500"
              >
                <option value="">Team wählen...</option>
                {teams
                  .filter((t) => t.id !== selectedTeamId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      #{t.nummer} {t.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* Ergebnis-Formular */}
      {isDuell ? (
        <div className="grid grid-cols-2 gap-4">
          <ErgebnisFormular
            label={teams.find((t) => t.id === selectedTeamId)?.name ?? "Team A"}
            wertungslogik={wl}
            rohdaten={rohdaten}
            onChange={setRohdaten}
            isDuellTeamA
          />
          <ErgebnisFormular
            label={teams.find((t) => t.id === selectedTeamId2)?.name ?? "Team B"}
            wertungslogik={wl}
            rohdaten={rohdaten2}
            onChange={setRohdaten2}
            isDuellTeamA={false}
          />
        </div>
      ) : (
        <ErgebnisFormular
          label="Ergebnis"
          wertungslogik={wl}
          rohdaten={rohdaten}
          onChange={setRohdaten}
        />
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !selectedTeamId}
          className="px-6 py-3 bg-white text-black text-sm font-semibold rounded-lg hover:bg-zinc-200 transition disabled:opacity-50"
        >
          {saving ? "Speichert..." : "Ergebnis speichern"}
        </button>
        {success && <span className="text-sm text-emerald-400">{success}</span>}
        {error && !conflict && <span className="text-sm text-red-400">{error}</span>}
      </div>

      {conflict && (
        <section className="border border-amber-600/50 bg-amber-950/20 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-amber-400 text-lg leading-none">⚠</span>
            <div>
              <p className="text-sm font-semibold text-amber-300">{error}</p>
              <p className="text-xs text-amber-400/80 mt-1">
                Deine Eingabe wurde nicht gespeichert. Es besteht bereits ein Ergebnis für dieses Match.
              </p>
            </div>
          </div>

          {conflict.length > 0 && showConflict && (
            <div className="space-y-2 border-t border-amber-600/30 pt-3">
              {conflict.map((c) => (
                <div key={c.id} className="text-xs text-zinc-300 bg-zinc-900/60 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {c.team ? `#${c.team.nummer} ${c.team.name}` : "Team"}
                    </span>
                    <span className="text-zinc-500">{c.gamePunkte} Punkte · {c.status}</span>
                  </div>
                  <p className="text-zinc-500 mt-1">
                    Eingetragen von {c.eingetragenVon?.name ?? "unbekannt"}
                    {c.eingetragenUm ? ` am ${new Date(c.eingetragenUm).toLocaleString("de-DE")}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            {conflict.length > 0 && (
              <button
                onClick={() => setShowConflict((v) => !v)}
                className="px-4 py-2 text-xs border border-amber-600/50 rounded-lg text-amber-300 hover:bg-amber-950/40 transition"
              >
                {showConflict ? "Ausblenden" : "Vorhandenes Ergebnis anzeigen"}
              </button>
            )}
            <Link
              to={`/referee/${slug}/live`}
              className="px-4 py-2 text-xs border border-zinc-700 rounded-lg text-zinc-300 hover:border-zinc-500 transition"
            >
              Zu den Ergebnissen
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

