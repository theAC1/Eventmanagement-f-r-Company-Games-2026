"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Person = { id: string; name: string; rolle: string };

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

export default function EinsatzplanPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [planConfig, setPlanConfig] = useState<PlanConfig | null>(null);
  const [personen, setPersonen] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSlot, setSavingSlot] = useState<string | null>(null);

  const load = () => {
    Promise.all([
      fetch("/api/einsatzplan").then((r) => {
        if (!r.ok) throw new Error("Fehler beim Laden des Einsatzplans");
        return r.json();
      }),
      fetch("/api/persons?rolle=SCHIEDSRICHTER,HELFER").then((r) => {
        if (!r.ok) throw new Error("Fehler beim Laden der Personen");
        return r.json();
      }),
    ])
      .then(([s, p]) => {
        setSlots(s.slots ?? []);
        setPlanConfig(s.config ?? null);
        setPersonen(p);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Fehler"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

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
      const res = await fetch(`/api/einsatzplan/${slot.id}/personen`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personIds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Fehler beim Speichern");
      }
      const updated = await res.json();
      setSlots((prev) =>
        prev.map((s) => (s.id === slot.id ? { ...s, personen: updated.personen } : s)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSavingSlot(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        Lade Einsatzplan...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Einsatzplan</h1>
          {planConfig && (
            <p className="text-sm text-zinc-500 mt-1">
              Zeitplan: <span className="text-zinc-300">{planConfig.name}</span>
              {planConfig.istAktiv ? (
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full border border-emerald-800 bg-emerald-950/40 text-emerald-400">Aktiv</span>
              ) : (
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full border border-amber-800 bg-amber-950/40 text-amber-400">
                  Kein aktiver Zeitplan — zeigt zuletzt erstellten
                </span>
              )}
            </p>
          )}
        </div>
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>

      {!planConfig && (
        <div className="border border-zinc-800 rounded-lg p-8 text-center text-zinc-500 text-sm">
          Kein Zeitplan vorhanden. Erstelle zuerst einen Zeitplan unter „Zeitplan“.
        </div>
      )}

      {planConfig && groups.length === 0 && (
        <div className="border border-zinc-800 rounded-lg p-8 text-center text-zinc-500 text-sm">
          Keine Zeitplan-Slots mit Games in diesem Zeitplan gefunden.
        </div>
      )}

      {groups.map(([gameId, group]) => (
        <section key={gameId} className="border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-zinc-900/60 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="font-semibold">{group.gameName}</h2>
            <span className="text-xs text-zinc-500">
              {group.slots[0]?.game?.schiedsrichterAnzahl ?? 1} Schiedsrichter pro Slot benötigt
            </span>
          </div>
          <div className="divide-y divide-zinc-800/70">
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
  const unterbesetzt = schiriCount < schiriMin;

  return (
    <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="w-40 shrink-0 text-sm">
        <div className="font-medium">
          {slot.startZeit}–{slot.endZeit}
        </div>
        <div className="text-xs text-zinc-500">Runde {slot.runde}</div>
      </div>
      <div className="w-56 shrink-0 text-xs text-zinc-400">
        {slot.teams.map((t) => t.team.name).join(" vs. ") || "–"}
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs px-2 py-0.5 rounded-full border ${
              unterbesetzt
                ? "border-amber-700 bg-amber-900/40 text-amber-300"
                : "border-emerald-800 bg-emerald-950/40 text-emerald-400"
            }`}
          >
            {schiriCount}/{schiriMin} Schiedsrichter
          </span>
          {slot.personen
            .filter((p) => p.person.rolle !== "SCHIEDSRICHTER")
            .length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full border border-zinc-700 bg-zinc-900 text-zinc-400">
              {slot.personen.filter((p) => p.person.rolle !== "SCHIEDSRICHTER").length} Helfer
            </span>
          )}
          {saving && <span className="text-xs text-zinc-500">Speichert...</span>}
        </div>
        {unterbesetzt && (
          <div className="text-xs text-amber-400 bg-amber-950/30 border border-amber-900/50 rounded-md px-2.5 py-1.5">
            Unterbesetzt: mindestens {schiriMin} Schiedsrichter benötigt
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
        className={`flex flex-wrap items-center gap-1.5 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 min-h-[38px] ${
          disabled ? "opacity-60 pointer-events-none" : ""
        }`}
        onClick={() => setOpen(true)}
      >
        {selected.map((p) => (
          <span
            key={p.id}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700"
          >
            {p.name}
            <span className="text-[10px] text-zinc-500 uppercase">{p.rolle === "SCHIEDSRICHTER" ? "SR" : "H"}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                remove(p.id);
              }}
              className="text-zinc-500 hover:text-red-400 ml-0.5"
              aria-label={`${p.name} entfernen`}
            >
              ×
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
          className="flex-1 min-w-[120px] bg-transparent text-sm focus:outline-none placeholder:text-zinc-600"
        />
      </div>
      {open && sorted.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl">
          {sorted.map((p) => (
            <button
              key={p.id}
              onClick={() => add(p.id)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-800 flex items-center justify-between"
            >
              <span>
                {p.name}
                <span className="ml-2 text-[10px] text-zinc-500 uppercase">
                  {p.rolle === "SCHIEDSRICHTER" ? "Schiedsrichter" : "Helfer"}
                </span>
              </span>
              {empfohlen.has(p.id) && (
                <span className="text-[10px] text-emerald-400 border border-emerald-800 bg-emerald-950/40 rounded-full px-1.5 py-0.5">
                  Empfohlen
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {open && sorted.length === 0 && (
        <div className="absolute z-20 mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl px-3 py-2 text-sm text-zinc-500">
          Keine Personen gefunden
        </div>
      )}
    </div>
  );
}
