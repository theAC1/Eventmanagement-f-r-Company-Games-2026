"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type MaterialItem = {
  id: string;
  name: string;
  kategorie: string;
  menge: string | null;
  status: string;
  sponsor: string | null;
  kostenGeschaetzt: string | null;
  kostenEffektiv: string | null;
  game: { id: string; name: string; slug: string } | null;
  verantwortlich: { id: string; name: string } | null;
  _count: { kommentare: number };
};

const STATUS_COLORS: Record<string, string> = {
  OFFEN: "bg-zinc-700 text-zinc-300",
  ANGEFRAGT: "bg-blue-900/60 text-blue-300",
  BESTAETIGT: "bg-amber-900/60 text-amber-300",
  VORHANDEN: "bg-emerald-900/60 text-emerald-300",
  GELIEFERT: "bg-emerald-800/80 text-emerald-200",
};

const STATUS_LABELS: Record<string, string> = {
  OFFEN: "Offen",
  ANGEFRAGT: "Angefragt",
  BESTAETIGT: "Bestätigt",
  VORHANDEN: "Vorhanden",
  GELIEFERT: "Geliefert",
};

const KAT_LABELS: Record<string, string> = {
  SPONSOR: "Sponsor",
  MIETE: "Miete",
  KAUF: "Kauf",
  EIGENBAU: "Eigenbau",
  VERBRAUCH: "Verbrauch",
  INFRASTRUKTUR: "Infrastruktur",
};

export default function MaterialsPage() {
  const [items, setItems] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterGame, setFilterGame] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterKat, setFilterKat] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterGame) params.set("gameId", filterGame);
    if (filterStatus) params.set("status", filterStatus);
    if (filterKat) params.set("kategorie", filterKat);

    fetch(`/api/materials?${params}`)
      .then((res) => res.json())
      .then(setItems)
      .finally(() => setLoading(false));
  }, [filterGame, filterStatus, filterKat]);

  // Unique games for filter
  const games = Array.from(
    new Map(
      items
        .filter((i) => i.game)
        .map((i) => [i.game!.id, i.game!])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Stats
  const stats = {
    total: items.length,
    offen: items.filter((i) => i.status === "OFFEN").length,
    bestaetigt: items.filter(
      (i) => i.status === "BESTAETIGT" || i.status === "VORHANDEN" || i.status === "GELIEFERT"
    ).length,
  };

  const progressPct = stats.total > 0 ? Math.round((stats.bestaetigt / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Material-Manager</h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-sm text-zinc-500">
              {stats.total} Items &middot; {stats.offen} offen &middot;{" "}
              {stats.bestaetigt} gesichert
            </p>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs text-zinc-500">{progressPct}%</span>
            </div>
          </div>
        </div>
        <Link
          href="/admin/materials/new"
          className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition"
        >
          + Neues Material
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={filterGame}
          onChange={(e) => { setFilterGame(e.target.value); setLoading(true); }}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500"
        >
          <option value="">Alle Games</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <select
          value={filterKat}
          onChange={(e) => { setFilterKat(e.target.value); setLoading(true); }}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500"
        >
          <option value="">Alle Kategorien</option>
          {Object.entries(KAT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setLoading(true); }}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500"
        >
          <option value="">Alle Status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-zinc-500">Lade...</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-zinc-500 gap-2">
          <p>Keine Materialien vorhanden</p>
          <Link href="/admin/materials/new" className="text-sm text-blue-400 hover:text-blue-300">
            Erstes Material anlegen
          </Link>
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 text-left">
                <th className="px-4 py-3 font-medium">Material</th>
                <th className="px-4 py-3 font-medium">Game</th>
                <th className="px-4 py-3 font-medium">Kategorie</th>
                <th className="px-4 py-3 font-medium">Menge</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Verantwortlich</th>
                <th className="px-4 py-3 font-medium text-right">Kosten</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/materials/${item.id}`}
                      className="font-medium text-white hover:text-blue-400 transition"
                    >
                      {item.name}
                    </Link>
                    {item.sponsor && (
                      <span className="ml-2 text-xs text-zinc-500">via {item.sponsor}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {item.game ? (
                      <Link
                        href={`/admin/games/${item.game.id}`}
                        className="hover:text-white transition"
                      >
                        {item.game.name}
                      </Link>
                    ) : (
                      <span className="text-zinc-600">Allgemein</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {KAT_LABELS[item.kategorie] ?? item.kategorie}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{item.menge ?? "–"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        STATUS_COLORS[item.status] ?? "bg-zinc-700 text-zinc-300"
                      }`}
                    >
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {item.verantwortlich?.name ?? (
                      <span className="text-zinc-600">–</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-400 tabular-nums">
                    {item.kostenGeschaetzt
                      ? `~CHF ${parseFloat(item.kostenGeschaetzt).toFixed(0)}`
                      : "–"}
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
