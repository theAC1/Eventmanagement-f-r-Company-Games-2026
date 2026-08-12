"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Warning, X } from "@phosphor-icons/react";
import { TopBar, TopBarSpacer } from "@/components/ui/top-bar";
import { StatusPill } from "@/components/ui/pills";
import { apiFetch, apiSend } from "@/lib/api-client";
import { meldung } from "@/lib/api-fehler";

type Person = { id: string; name: string; rolle: string };

/** Aus der Posten-Crew abgeleitete Besetzung eines Games. */
type Posten = {
  gameId: string;
  gameName: string;
  gameSlug: string;
  durchgaenge: number;
  slots: number;
  bedarfSchiedsrichter: number;
  bedarfHelfer: number;
  crew: Person[];
  unterbesetzt: boolean;
  mittag: { startZeit: string; endZeit: string } | null;
};

type Slot = {
  id: string;
  runde: number;
  startZeit: string;
  endZeit: string;
  status: string;
  game: { id: string; name: string; slug: string; schiedsrichterAnzahl: number; helferAnzahl: number } | null;
  teams: Array<{ team: { id: string; name: string; nummer: number } }>;
  personen: Array<{ id: string; personId: string; rolle: string; person: Person }>;
  config: { id: string; name: string; createdAt: string };
};

type PlanConfig = { id: string; name: string; istAktiv: boolean; createdAt: string };

type EinsatzplanAntwort = {
  config: PlanConfig | null;
  slots: Slot[];
  posten: Posten[];
};

export default function EinsatzplanPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [posten, setPosten] = useState<Posten[]>([]);
  const [planConfig, setPlanConfig] = useState<PlanConfig | null>(null);
  const [personen, setPersonen] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSlot, setSavingSlot] = useState<string | null>(null);
  const [zeigeSlots, setZeigeSlots] = useState(false);

  const load = useCallback(async () => {
    try {
      const [plan, p] = await Promise.all([
        apiFetch<EinsatzplanAntwort>("/api/einsatzplan", {
          fehlerText: "Fehler beim Laden des Einsatzplans",
        }),
        apiFetch<Person[]>("/api/persons?rolle=SCHIEDSRICHTER,HELFER", {
          fehlerText: "Fehler beim Laden der Personen",
        }),
      ]);
      setSlots(plan.slots ?? []);
      setPosten(plan.posten ?? []);
      setPlanConfig(plan.config ?? null);
      setPersonen(p);
      setError(null);
    } catch (err) {
      setError(meldung(err, "Fehler"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Personen die einem Game (in irgendeinem Slot) zugewiesen sind → Empfehlung
  const gamePersonMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const slot of slots) {
      if (!slot.game) continue;
      let set = map.get(slot.game.id);
      if (!set) {
        set = new Set();
        map.set(slot.game.id, set);
      }
      for (const p of slot.personen) set.add(p.person.id);
    }
    return map;
  }, [slots]);

  const groups = useMemo(() => {
    const byGame = new Map<string, { gameName: string; slots: Slot[] }>();
    for (const slot of slots) {
      if (!slot.game) continue;
      const entry = byGame.get(slot.game.id) ?? { gameName: slot.game.name, slots: [] };
      entry.slots.push(slot);
      byGame.set(slot.game.id, entry);
    }
    return [...byGame.entries()].sort((a, b) => a[1].gameName.localeCompare(b[1].gameName));
  }, [slots]);

  const handleAssign = async (slot: Slot, personIds: string[]) => {
    setSavingSlot(slot.id);
    setError(null);
    try {
      const updated = await apiSend<Slot>(
        `/api/einsatzplan/${slot.id}/personen`,
        "PUT",
        { personIds },
        "Fehler beim Speichern",
      );
      setSlots((prev) =>
        prev.map((s) => (s.id === slot.id ? { ...s, personen: updated.personen } : s)),
      );
    } catch (err) {
      setError(meldung(err, "Fehler beim Speichern"));
    } finally {
      setSavingSlot(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col">
        <TopBar title="Einsatzplan" />
        <div className="flex h-64 items-center justify-center text-sm text-ink-3">
          Lade Einsatzplan...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <TopBar title="Einsatzplan">
        <TopBarSpacer />
        {error && <span className="text-sm text-hot-tint">{error}</span>}
      </TopBar>

      <div className="space-y-5 px-4 py-6 sm:px-[22px]">
        {planConfig && (
          <div
            className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] border border-line px-3.5 py-2.5 ${
              planConfig.istAktiv ? "bg-done-dim" : "bg-neutral-dim"
            }`}
          >
            <span className="text-[13px] text-ink-3">Zeitplan</span>
            <span className="text-[13px] font-semibold text-ink">
              {planConfig.name}
            </span>
            {planConfig.istAktiv ? (
              <StatusPill tone="done">Aktiv</StatusPill>
            ) : (
              <StatusPill tone="neutral">
                Kein aktiver Zeitplan — zeigt zuletzt erstellten
              </StatusPill>
            )}
          </div>
        )}

        {!planConfig && (
          <div className="rounded-[10px] border border-line bg-surface p-8 text-center text-sm text-ink-3">
            Kein Zeitplan vorhanden. Erstelle zuerst einen Zeitplan unter
            „Zeitplan“.
          </div>
        )}

        {planConfig && groups.length === 0 && (
          <div className="rounded-[10px] border border-line bg-surface p-8 text-center text-sm text-ink-3">
            Keine Zeitplan-Slots mit Games in diesem Zeitplan gefunden.
          </div>
        )}

        {posten.length > 0 && <PostenUebersicht posten={posten} />}

        {posten.length > 0 && (
          <button
            type="button"
            onClick={() => setZeigeSlots((v) => !v)}
            className="text-[13px] font-medium text-ink-3 transition-colors duration-150 hover:text-ink"
          >
            {zeigeSlots
              ? "Runden-Feinjustierung ausblenden"
              : "Runden-Feinjustierung einblenden"}
          </button>
        )}

        {zeigeSlots &&
          groups.map(([gameId, group]) => (
          <section
            key={gameId}
            className="overflow-hidden rounded-[10px] border border-line bg-surface"
          >
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-line px-3.5 py-2.5">
              <h2 className="text-[13px] font-semibold text-ink">
                {group.gameName}
              </h2>
              <span className="tnum text-[11px] text-label">
                {group.slots.length} Slots
              </span>
              <span className="flex-1" aria-hidden />
              <span className="text-[11px] text-ink-3">
                <span className="tnum">
                  {group.slots[0]?.game?.schiedsrichterAnzahl ?? 1}
                </span>{" "}
                Schiedsrichter pro Slot ben&ouml;tigt
              </span>
            </div>
            <div className="divide-y divide-line-soft">
              {group.slots.map((slot) => (
                <SlotRow
                  key={slot.id}
                  slot={slot}
                  personen={personen}
                  empfohlen={gamePersonMap.get(gameId) ?? new Set()}
                  saving={savingSlot === slot.id}
                  onAssign={(ids) => handleAssign(slot, ids)}
                />
              ))}
            </div>
          </section>
          ))}
      </div>
    </div>
  );
}

/**
 * Der eigentliche Einsatzplan: eine Zeile pro Posten. Zugeteilt wird im
 * Games-Tab — hier steht das Ergebnis, inklusive der Mittagswelle, in der der
 * Posten pausiert.
 */
function PostenUebersicht({ posten }: { posten: Posten[] }) {
  const offen = posten.filter((p) => p.unterbesetzt).length;

  return (
    <section className="overflow-hidden rounded-[10px] border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3.5 py-2.5">
        <h2 className="text-[13px] font-semibold text-ink">Posten-Besetzung</h2>
        <span className="tnum text-[11px] text-label">{posten.length} Posten</span>
        <span className="flex-1" aria-hidden />
        {offen > 0 ? (
          <StatusPill tone="warn">
            <span className="tnum">{offen}</span>
            <span className="ml-1">unterbesetzt</span>
          </StatusPill>
        ) : (
          <StatusPill tone="done">Vollständig besetzt</StatusPill>
        )}
      </div>

      <div className="divide-y divide-line-soft">
        {posten.map((p) => (
          <div
            key={p.gameId}
            className="grid gap-x-4 gap-y-2 px-3.5 py-3 sm:grid-cols-[minmax(0,200px)_1fr_auto]"
          >
            <div className="min-w-0 space-y-0.5">
              <Link
                href={`/admin/games/${p.gameId}`}
                className="block truncate text-[13px] font-medium text-ink transition-colors duration-150 hover:text-action"
              >
                {p.gameName}
              </Link>
              <p className="tnum text-[11px] text-ink-3">
                {p.slots} Slots
                {p.durchgaenge > 1 && ` · ${p.durchgaenge} Durchgänge pro Team`}
              </p>
            </div>

            <div className="min-w-0 space-y-1">
              {p.crew.length > 0 ? (
                <p className="text-[12px] text-ink-2">
                  {p.crew.map((c) => c.name).join(", ")}
                </p>
              ) : (
                <p className="text-[12px] text-faint">
                  Niemand zugeteilt &mdash; im Game-Tab festlegen
                </p>
              )}
              {p.mittag && (
                <p className="tnum text-[11px] text-ink-3">
                  Mittag: {p.mittag.startZeit}&ndash;{p.mittag.endZeit} (Posten
                  pausiert)
                </p>
              )}
            </div>

            <div className="flex items-start gap-1.5">
              <StatusPill tone={p.unterbesetzt ? "warn" : "done"}>
                <span className="tnum">
                  {p.crew.length}/{p.bedarfSchiedsrichter + p.bedarfHelfer}
                </span>
                <span className="ml-1">Crew</span>
              </StatusPill>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SlotRow({
  slot,
  personen,
  empfohlen,
  saving,
  onAssign,
}: {
  slot: Slot;
  personen: Person[];
  empfohlen: Set<string>;
  saving: boolean;
  onAssign: (personIds: string[]) => void;
}) {
  const assignedIds = slot.personen.map((p) => p.person.id);
  const schiriMin = slot.game?.schiedsrichterAnzahl ?? 1;
  const schiriCount = slot.personen.filter((p) => p.person.rolle === "SCHIEDSRICHTER").length;
  const helferCount = slot.personen.filter((p) => p.person.rolle !== "SCHIEDSRICHTER").length;
  const unterbesetzt = schiriCount < schiriMin;

  return (
    <div className="flex flex-col gap-3 px-3.5 py-3 sm:flex-row sm:items-start">
      <div className="flex flex-wrap items-baseline gap-x-3 sm:w-36 sm:shrink-0 sm:flex-col sm:gap-y-0.5">
        <span className="tnum text-[13px] font-medium text-ink">
          {slot.startZeit}–{slot.endZeit}
        </span>
        <span className="tnum text-[11px] text-ink-3">Runde {slot.runde}</span>
      </div>
      <div className="text-xs text-ink-2 sm:w-52 sm:shrink-0 sm:pt-0.5">
        {slot.teams.map((t) => t.team.name).join(" vs. ") || "–"}
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={unterbesetzt ? "warn" : "done"}>
            <span className="tnum">
              {schiriCount}/{schiriMin}
            </span>
            <span className="ml-1">Schiedsrichter</span>
          </StatusPill>
          {helferCount > 0 && (
            <StatusPill tone="neutral">
              <span className="tnum">{helferCount}</span>
              <span className="ml-1">Helfer</span>
            </StatusPill>
          )}
          {saving && (
            <span className="text-[11px] text-ink-3">Speichert...</span>
          )}
        </div>
        {unterbesetzt && (
          <div className="flex items-center gap-2 rounded-[10px] border border-[var(--warn-border)] bg-warn-dim px-3 py-2 text-xs text-ink-2">
            <Warning size={14} weight="bold" className="shrink-0 text-warn" />
            <span>
              Unterbesetzt: mindestens{" "}
              <span className="tnum">{schiriMin}</span> Schiedsrichter
              ben&ouml;tigt
            </span>
          </div>
        )}
        <PersonMultiSelect
          personen={personen}
          selectedIds={assignedIds}
          empfohlen={empfohlen}
          disabled={saving}
          onChange={onAssign}
        />
      </div>
    </div>
  );
}

function PersonMultiSelect({
  personen,
  selectedIds,
  empfohlen,
  disabled,
  onChange,
}: {
  personen: Person[];
  selectedIds: string[];
  empfohlen: Set<string>;
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = personen.filter((p) => selectedIds.includes(p.id));
  const available = personen
    .filter((p) => !selectedIds.includes(p.id))
    .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  // Empfohlene (gleiche Game-Zuweisung in anderen Slots) zuerst
  const sorted = [...available].sort((a, b) => {
    const ea = empfohlen.has(a.id) ? 0 : 1;
    const eb = empfohlen.has(b.id) ? 0 : 1;
    if (ea !== eb) return ea - eb;
    return a.name.localeCompare(b.name);
  });

  const add = (id: string) => {
    onChange([...selectedIds, id]);
    setQuery("");
  };
  const remove = (id: string) => onChange(selectedIds.filter((s) => s !== id));

  return (
    <div ref={ref} className="relative">
      <div
        className={`flex min-h-[38px] cursor-text flex-wrap items-center gap-1.5 rounded-[9px] border border-line-strong bg-sunken px-2 py-1.5 transition-colors duration-150 focus-within:border-action ${
          disabled ? "pointer-events-none opacity-60" : ""
        }`}
        onClick={() => setOpen(true)}
      >
        {selected.map((p) => (
          <span
            key={p.id}
            className="inline-flex h-7 items-center gap-1.5 rounded-full bg-action-dim px-2.5 text-xs font-medium text-action-tint"
          >
            {p.name}
            <span className="text-[10px] uppercase tracking-[0.06em] opacity-70">
              {p.rolle === "SCHIEDSRICHTER" ? "SR" : "H"}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                remove(p.id);
              }}
              className="text-action-tint transition-colors duration-150 hover:text-hot-tint"
              aria-label={`${p.name} entfernen`}
            >
              <X size={12} weight="bold" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? "Person zuweisen..." : ""}
          className="min-w-[120px] flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
        />
      </div>
      {open && sorted.length > 0 && (
        <div className="anim-pop absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-[10px] border border-line bg-surface shadow-[var(--shadow-pop)]">
          {sorted.map((p) => (
            <button
              key={p.id}
              onClick={() => add(p.id)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-ink transition-colors duration-150 hover:bg-sunken"
            >
              <span>
                {p.name}
                <span className="ml-2 text-[10px] uppercase tracking-[0.06em] text-ink-3">
                  {p.rolle === "SCHIEDSRICHTER" ? "Schiedsrichter" : "Helfer"}
                </span>
              </span>
              {empfohlen.has(p.id) && (
                <span className="shrink-0 rounded-full bg-done-dim px-2 py-0.5 text-[10px] font-semibold text-done-tint">
                  Empfohlen
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {open && sorted.length === 0 && (
        <div className="anim-pop absolute z-20 mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink-3 shadow-[var(--shadow-pop)]">
          Keine Personen gefunden
        </div>
      )}
    </div>
  );
}
