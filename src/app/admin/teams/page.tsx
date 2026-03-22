"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Team = {
  id: string; name: string; nummer: number; farbe: string;
  captainName: string | null; teilnehmerAnzahl: number | null;
  logoUrl: string | null; motto: string | null; qrToken: string;
};

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNummer, setNewNummer] = useState(1);

  const load = () => {
    fetch("/api/teams").then(r => r.json()).then(t => { setTeams(t); setLoading(false); });
  };

  useEffect(load, []);

  const createTeam = async () => {
    if (!newName.trim()) return;
    await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, nummer: newNummer }),
    });
    setNewName("");
    setNewNummer(teams.length + 2);
    setShowNew(false);
    load();
  };

  const deleteTeam = async (id: string) => {
    if (!confirm("Team wirklich löschen?")) return;
    await fetch(`/api/teams/${id}`, { method: "DELETE" });
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-zinc-500">Lade...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team-Verwaltung</h1>
          <p className="text-sm text-zinc-500 mt-1">{teams.length} Teams</p>
        </div>
        <button onClick={() => { setShowNew(true); setNewNummer(teams.length + 1); }}
          className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition">
          + Neues Team
        </button>
      </div>

      {/* Neues Team Inline */}
      {showNew && (
        <div className="border border-zinc-800 rounded-lg p-4 flex items-end gap-3">
          <div className="space-y-1 flex-1">
            <label className="text-xs text-zinc-500">Teamname</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} autoFocus
              placeholder="z.B. Die Löwen"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
          </div>
          <div className="space-y-1 w-20">
            <label className="text-xs text-zinc-500">Nr.</label>
            <input type="number" value={newNummer} onChange={e => setNewNummer(parseInt(e.target.value) || 1)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
          </div>
          <button onClick={createTeam}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition">
            Erstellen
          </button>
          <button onClick={() => setShowNew(false)}
            className="px-3 py-2 text-sm text-zinc-500 hover:text-white transition">
            Abbrechen
          </button>
        </div>
      )}

      {/* Team-Tabelle */}
      {teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-zinc-500 gap-2">
          <p>Noch keine Teams angelegt</p>
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 text-left">
                <th className="px-4 py-3 font-medium w-12">#</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Captain</th>
                <th className="px-4 py-3 font-medium text-right">Teilnehmer</th>
                <th className="px-4 py-3 font-medium">Motto</th>
                <th className="px-4 py-3 font-medium w-20">Farbe</th>
                <th className="px-4 py-3 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {teams.map(t => (
                <tr key={t.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="px-4 py-3 text-zinc-500 tabular-nums">{t.nummer}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/teams/${t.id}`}
                      className="flex items-center gap-2 font-medium text-white hover:text-blue-400 transition">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.farbe }} />
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{t.captainName ?? "–"}</td>
                  <td className="px-4 py-3 text-right text-zinc-400 tabular-nums">{t.teilnehmerAnzahl ?? "–"}</td>
                  <td className="px-4 py-3 text-zinc-500 truncate max-w-[200px]">{t.motto ?? "–"}</td>
                  <td className="px-4 py-3">
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: t.farbe }} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteTeam(t.id)}
                      className="text-xs text-zinc-600 hover:text-red-400 transition">
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
