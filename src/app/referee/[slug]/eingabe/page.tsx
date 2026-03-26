"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type EingabeFeld = { name: string; typ: string; label: string };
type Level = { name: string; grundpunkte: number };
type Option = { name: string; punkte_erfolg: number; punkte_fail: number };

type Wertungslogik = {
  typ?: string;
  einheit?: string;
  richtung?: string;
  eingabefelder?: EingabeFeld[];
  levels?: Level[];
  optionen?: Option[];
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

export default function EingabePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const handleSave = async () => {
    if (game?.modus === "DUELL" && game.teamsProSlot >= 2) {
      // Duell: Beide Teams speichern
      if (!selectedTeamId || !selectedTeamId2) {
        setError("Beide Teams auswählen");
        return;
      }
      const ok1 = await handleSubmit(selectedTeamId, rohdaten);
      const ok2 = await handleSubmit(selectedTeamId2, rohdaten2);
      if (ok1 && ok2) {
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
        <Link href={`/referee/${slug}`} className="text-xs text-zinc-500 hover:text-white transition">
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
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}

// ─── Dynamisches Ergebnis-Formular ───

function ErgebnisFormular({
  label,
  wertungslogik,
  rohdaten,
  onChange,
  isDuellTeamA,
}: {
  label: string;
  wertungslogik: Wertungslogik | null;
  rohdaten: Record<string, unknown>;
  onChange: (r: Record<string, unknown>) => void;
  isDuellTeamA?: boolean;
}) {
  const wl = wertungslogik;
  if (!wl) {
    return (
      <div className="border border-zinc-800 rounded-lg p-4 text-zinc-500 text-sm">
        Keine Wertungslogik definiert
      </div>
    );
  }

  const update = (key: string, value: unknown) => {
    onChange({ ...rohdaten, [key]: value });
  };

  return (
    <section className="border border-zinc-800 rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-medium text-zinc-400">{label}</h3>

      {/* Eingabefelder */}
      {wl.eingabefelder?.map((f) => {
        // Für Duell: nur das relevante Feld zeigen
        if (isDuellTeamA !== undefined && wl.typ === "punkte_duell") {
          const felder = wl.eingabefelder ?? [];
          const idx = isDuellTeamA ? 0 : 1;
          if (felder.indexOf(f) !== idx) return null;
        }
        return (
          <div key={f.name} className="space-y-1">
            <label className="text-xs text-zinc-500">{f.label}</label>
            <input
              type={f.typ === "number" ? "number" : "text"}
              value={(rohdaten[f.name] as string) ?? ""}
              onChange={(e) =>
                update(f.name, f.typ === "number" ? Number(e.target.value) || 0 : e.target.value)
              }
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-lg font-mono focus:outline-none focus:border-zinc-500"
            />
          </div>
        );
      })}

      {/* Level-Auswahl (Multi-Level) */}
      {wl.typ === "multi_level" && wl.levels && (
        <div className="space-y-1">
          <label className="text-xs text-zinc-500">Schwierigkeit</label>
          <div className="flex gap-2">
            {wl.levels.map((l) => (
              <button
                key={l.name}
                onClick={() => update("level", l.name)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                  rohdaten.level === l.name
                    ? "bg-white text-black border-white"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                {l.name} ({l.grundpunkte}P)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Risiko-Wahl (Eierfall) */}
      {wl.typ === "risiko_wahl" && wl.optionen && (
        <>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Höhe</label>
            <div className="flex gap-2">
              {wl.optionen.map((o) => (
                <button
                  key={o.name}
                  onClick={() => update("option", o.name)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                    rohdaten.option === o.name
                      ? "bg-white text-black border-white"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                  }`}
                >
                  {o.name} ({o.punkte_erfolg}P)
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Überlebt?</label>
            <div className="flex gap-2">
              <button
                onClick={() => update("erfolg", true)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                  rohdaten.erfolg === true
                    ? "bg-emerald-900/60 border-emerald-700 text-emerald-300"
                    : "border-zinc-700 text-zinc-400"
                }`}
              >
                Ja
              </button>
              <button
                onClick={() => update("erfolg", false)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                  rohdaten.erfolg === false
                    ? "bg-red-900/60 border-red-700 text-red-300"
                    : "border-zinc-700 text-zinc-400"
                }`}
              >
                Nein
              </button>
            </div>
          </div>
        </>
      )}

      {/* Strafen (Lava Becken) */}
      {wl.strafen && (
        <>
          {Object.entries(wl.strafen).map(([key, sek]) => (
            <div key={key} className="space-y-1">
              <label className="text-xs text-zinc-500 capitalize">
                {key.replace(/_/g, " ")} (+{sek}s)
              </label>
              <input
                type="number"
                min={0}
                value={(rohdaten[key] as number) ?? 0}
                onChange={(e) => update(key, Number(e.target.value) || 0)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-lg font-mono focus:outline-none focus:border-zinc-500"
              />
            </div>
          ))}
          {wl.nicht_geschafft && (
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">Geschafft?</label>
              <div className="flex gap-2">
                <button
                  onClick={() => update("nicht_geschafft", false)}
                  className={`flex-1 py-2 rounded-lg text-sm border transition ${
                    rohdaten.nicht_geschafft === false || rohdaten.nicht_geschafft === undefined
                      ? "bg-emerald-900/60 border-emerald-700 text-emerald-300"
                      : "border-zinc-700 text-zinc-400"
                  }`}
                >
                  Ja
                </button>
                <button
                  onClick={() => update("nicht_geschafft", true)}
                  className={`flex-1 py-2 rounded-lg text-sm border transition ${
                    rohdaten.nicht_geschafft === true
                      ? "bg-red-900/60 border-red-700 text-red-300"
                      : "border-zinc-700 text-zinc-400"
                  }`}
                >
                  Nicht geschafft
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Zeit-Eingabe (wenn kein Eingabefeld definiert aber Typ=zeit) */}
      {wl.typ === "zeit" && !wl.eingabefelder?.length && (
        <div className="space-y-1">
          <label className="text-xs text-zinc-500">Zeit (Sekunden)</label>
          <input
            type="number"
            value={(rohdaten.zeit_sekunden as number) ?? ""}
            onChange={(e) => update("zeit_sekunden", Number(e.target.value) || 0)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-lg font-mono focus:outline-none focus:border-zinc-500"
          />
        </div>
      )}
    </section>
  );
}
