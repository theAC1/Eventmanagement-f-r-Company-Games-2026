"use client";

import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import { TopBar, TopBarSpacer } from "@/components/ui/top-bar";
import { StatusPill, type PillTone } from "@/components/ui/pills";
import { useViewState } from "@/hooks/use-view-state";
import { useScrollRestore } from "@/hooks/use-scroll-restore";

const VIEW_ID = "admin:kvp";

/** Ansicht, die sich die Seite fuer die Dauer der Browser-Sitzung merkt. */
const DEFAULT_VIEW = { filterTyp: "", filterStatus: "" };

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

const TYP_CONFIG: Record<KvpEintrag["typ"], { label: string; tone: PillTone }> = {
  BUG: { label: "Bug", tone: "hot" },
  WUNSCHFUNKTION: { label: "Wunsch", tone: "action" },
  IDEE: { label: "Idee", tone: "warn" },
};

const STATUS_CONFIG: Record<
  KvpEintrag["status"],
  { label: string; style: { color: string; background: string } }
> = {
  OFFEN: {
    label: "Offen",
    style: { color: "var(--ink-3)", background: "var(--neutral-dim)" },
  },
  IN_BEARBEITUNG: {
    label: "In Bearbeitung",
    style: { color: "var(--action-tint)", background: "var(--action-dim)" },
  },
  ERLEDIGT: {
    label: "Erledigt",
    style: { color: "var(--done-tint)", background: "var(--done-dim)" },
  },
};

const STATUS_SEQUENCE: KvpEintrag["status"][] = ["OFFEN", "IN_BEARBEITUNG", "ERLEDIGT"];

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-[30px] rounded-full px-3 text-xs transition-colors duration-150 ${
        active
          ? "border border-ink bg-ink font-semibold text-bg"
          : "border border-line-strong font-medium text-ink-3 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export default function KvpPage() {
  const [eintraege, setEintraege] = useState<KvpEintrag[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { view, setView, ready } = useViewState(VIEW_ID, DEFAULT_VIEW);
  const { filterTyp, filterStatus } = view;

  useScrollRestore(VIEW_ID, ready && !loading);

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

  // Erst laden, wenn die gemerkten Filter stehen — sonst holt der erste Fetch
  // die ungefilterte Liste, die gleich darauf wieder verworfen wird.
  useEffect(() => {
    if (!ready) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, filterTyp, filterStatus]);

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
    <div className="flex flex-col">
      <TopBar title="KVP">
        <span className="tnum text-xs text-ink-3">
          {counts.total} Einträge · {counts.offen} offen · {counts.inBearbeitung} in Bearbeitung · {counts.erledigt} erledigt
        </span>
        <TopBarSpacer />
      </TopBar>

      {/* Filter-Chips */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3.5 sm:px-[22px]">
        <FilterChip active={filterTyp === ""} onClick={() => setView({ filterTyp: "" })}>
          Alle Typen
        </FilterChip>
        {(Object.keys(TYP_CONFIG) as KvpEintrag["typ"][]).map((typ) => (
          <FilterChip key={typ} active={filterTyp === typ} onClick={() => setView({ filterTyp: typ })}>
            {TYP_CONFIG[typ].label}
          </FilterChip>
        ))}
        <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden />
        <FilterChip active={filterStatus === ""} onClick={() => setView({ filterStatus: "" })}>
          Alle Status
        </FilterChip>
        {(Object.keys(STATUS_CONFIG) as KvpEintrag["status"][]).map((status) => (
          <FilterChip
            key={status}
            active={filterStatus === status}
            onClick={() => setView({ filterStatus: status })}
          >
            {STATUS_CONFIG[status].label}
          </FilterChip>
        ))}
      </div>

      {/* Einträge */}
      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-ink-3">Lade…</div>
      ) : eintraege.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-ink-3">
          Keine Einträge vorhanden.
        </div>
      ) : (
        <div className="space-y-3 px-4 py-4 sm:px-[22px]">
          {eintraege.map((e) => {
            const typ = TYP_CONFIG[e.typ];
            const status = STATUS_CONFIG[e.status];
            const isUpdating = updatingId === e.id;
            return (
              <div
                key={e.id}
                className="space-y-3 rounded-[10px] border border-line bg-surface p-4 transition-colors duration-150 hover:border-line-strong"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={typ.tone}>{typ.label}</StatusPill>
                    <button
                      onClick={() => cycleStatus(e)}
                      disabled={isUpdating}
                      title="Status wechseln"
                      className="inline-flex cursor-pointer items-center rounded-full px-[9px] py-1 text-[11px] font-semibold tracking-[0.04em] transition-opacity duration-150 hover:opacity-80 disabled:opacity-50"
                      style={status.style}
                    >
                      {isUpdating ? "…" : status.label}
                    </button>
                  </div>
                  <button
                    onClick={() => handleDelete(e)}
                    className="flex-shrink-0 rounded-[7px] border border-[var(--hot-border)] p-1 text-hot-tint transition-colors duration-150 hover:bg-hot-dim"
                    title="Löschen"
                    aria-label="Eintrag löschen"
                  >
                    <X size={12} weight="bold" />
                  </button>
                </div>

                {/* Titel */}
                <p className="text-sm font-medium text-ink">{e.titel}</p>

                {/* Beschreibung */}
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-3">
                  {e.beschreibung}
                </p>

                {/* Footer */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-soft pt-2 text-[11px] text-label">
                  {e.seite && (
                    <>
                      <span className="tnum max-w-[200px] truncate" title={e.seite}>
                        {e.seite}
                      </span>
                      <span>·</span>
                    </>
                  )}
                  <span>{e.eingetragenVon?.name ?? "Unbekannt"}</span>
                  <span>·</span>
                  <span className="tnum">
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
