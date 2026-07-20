"use client";

import { useEffect, useState } from "react";

type KvpEintrag = {
  id: string;
  typ: "BUG" | "WUNSCHFUNKTION" | "IDEE";
  titel: string;
  beschreibung: string;
  seite: string | null;
  status: "OFFEN" | "IN_BEARBEITUNG" | "ERLEDIGT";
  eingetragenVon: { id: string; name: string } | null;
  createdAt: string;
};

const TYP_CONFIG = {
  BUG: { label: "Bug", emoji: "🐛", badge: "bg-red-950/60 text-red-300 border-red-800" },
  WUNSCHFUNKTION: { label: "Wunsch", emoji: "✨", badge: "bg-blue-950/60 text-blue-300 border-blue-800" },
  IDEE: { label: "Idee", emoji: "💡", badge: "bg-amber-950/60 text-amber-300 border-amber-800" },
};

const STATUS_CONFIG = {
  OFFEN: { label: "Offen", color: "bg-zinc-800 text-zinc-300" },
  IN_BEARBEITUNG: { label: "In Bearbeitung", color: "bg-blue-900/60 text-blue-300" },
  ERLEDIGT: { label: "Erledigt", color: "bg-emerald-900/60 text-emerald-300" },
};

const STATUS_SEQUENCE: KvpEintrag["status"][] = ["OFFEN", "IN_BEARBEITUNG", "ERLEDIGT"];

export default function KvpPage() {
  const [eintraege, setEintraege] = useState<KvpEintrag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTyp, setFilterTyp] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const reload = () => {
    const params = new URLSearchParams();
    if (filterTyp) params.set("typ", filterTyp);
    if (filterStatus) params.set("status", filterStatus);
    setLoading(true);
    fetch(`/api/kvp?${params}`)
      .then((r) => r.json())
      .then(setEintraege)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTyp, filterStatus]);

  const cycleStatus = async (eintrag: KvpEintrag) => {
    const idx = STATUS_SEQUENCE.indexOf(eintrag.status);
    const nextStatus = STATUS_SEQUENCE[(idx + 1) % STATUS_SEQUENCE.length];
    setUpdatingId(eintrag.id);
    try {
      const res = await fetch(`/api/kvp/${eintrag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error();
      setEintraege((prev) =>
        prev.map((e) => (e.id === eintrag.id ? { ...e, status: nextStatus } : e))
      );
    } catch {
      alert("Fehler beim Aktualisieren");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (eintrag: KvpEintrag) => {
    if (!confirm(`"${eintrag.titel}" wirklich löschen?`)) return;
    try {
      const res = await fetch(`/api/kvp/${eintrag.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setEintraege((prev) => prev.filter((e) => e.id !== eintrag.id));
    } catch {
      alert("Fehler beim Löschen");
    }
  };

  const counts = {
    total: eintraege.length,
    offen: eintraege.filter((e) => e.status === "OFFEN").length,
    inBearbeitung: eintraege.filter((e) => e.status === "IN_BEARBEITUNG").length,
    erledigt: eintraege.filter((e) => e.status === "ERLEDIGT").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">KVP — Feedback & Verbesserungen</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {counts.total} Einträge · {counts.offen} offen · {counts.inBearbeitung} in Bearbeitung · {counts.erledigt} erledigt
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={filterTyp}
          onChange={(e) => setFilterTyp(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500"
        >
          <option value="">Alle Typen</option>
          {(Object.entries(TYP_CONFIG) as [keyof typeof TYP_CONFIG, typeof TYP_CONFIG[keyof typeof TYP_CONFIG]][]).map(([k, v]) => (
            <option key={k} value={k}>{v.emoji} {v.label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500"
        >
          <option value="">Alle Status</option>
          {(Object.entries(STATUS_CONFIG) as [keyof typeof STATUS_CONFIG, typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]][]).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Einträge */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-zinc-500">Lade…</div>
      ) : eintraege.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-zinc-500">
          Keine Einträge vorhanden.
        </div>
      ) : (
        <div className="space-y-3">
          {eintraege.map((e) => {
            const typ = TYP_CONFIG[e.typ];
            const status = STATUS_CONFIG[e.status];
            const isUpdating = updatingId === e.id;
            return (
              <div
                key={e.id}
                className="border border-zinc-800 rounded-xl p-4 space-y-3 hover:border-zinc-700 transition"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${typ.badge}`}
                    >
                      {typ.emoji} {typ.label}
                    </span>
                    <button
                      onClick={() => cycleStatus(e)}
                      disabled={isUpdating}
                      title="Status wechseln"
                      className={`text-xs px-2 py-0.5 rounded-full font-medium transition hover:opacity-80 disabled:opacity-50 cursor-pointer ${status.color}`}
                    >
                      {isUpdating ? "…" : status.label}
                    </button>
                  </div>
                  <button
                    onClick={() => handleDelete(e)}
                    className="text-zinc-600 hover:text-red-400 transition text-sm flex-shrink-0"
                    title="Löschen"
                    aria-label="Eintrag löschen"
                  >
                    ✕
                  </button>
                </div>

                {/* Titel */}
                <p className="font-medium text-sm">{e.titel}</p>

                {/* Beschreibung */}
                <p className="text-sm text-zinc-400 whitespace-pre-wrap leading-relaxed">
                  {e.beschreibung}
                </p>

                {/* Footer */}
                <div className="flex items-center gap-3 text-xs text-zinc-600 pt-1 border-t border-zinc-800/60">
                  {e.seite && (
                    <span className="font-mono truncate max-w-[200px]" title={e.seite}>
                      {e.seite}
                    </span>
                  )}
                  <span>·</span>
                  <span>{e.eingetragenVon?.name ?? "Unbekannt"}</span>
                  <span>·</span>
                  <span>
                    {new Date(e.createdAt).toLocaleDateString("de-CH", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
