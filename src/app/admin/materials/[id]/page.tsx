"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CaretLeft } from "@phosphor-icons/react";
import { TopBar, TopBarSpacer } from "@/components/ui/top-bar";
import { Button } from "@/components/ui/button";

type MaterialItem = {
  id: string;
  name: string;
  kategorie: string;
  menge: string | null;
  beschreibung: string | null;
  status: string;
  sponsor: string | null;
  kostenGeschaetzt: string | null;
  kostenEffektiv: string | null;
  gameId: string | null;
  game: { id: string; name: string; slug: string } | null;
  verantwortlich: { id: string; name: string } | null;
  kommentare: { id: string; text: string; createdAt: string; autor: { name: string } }[];
};

type GameOption = { id: string; name: string };

const KATEGORIEN = [
  { value: "SPONSOR", label: "Sponsor" },
  { value: "MIETE", label: "Miete" },
  { value: "KAUF", label: "Kauf" },
  { value: "EIGENBAU", label: "Eigenbau" },
  { value: "VERBRAUCH", label: "Verbrauch" },
  { value: "INFRASTRUKTUR", label: "Infrastruktur" },
];

const STATUS_OPTIONS = [
  { value: "OFFEN", label: "Offen" },
  { value: "ANGEFRAGT", label: "Angefragt" },
  { value: "BESTAETIGT", label: "Bestätigt" },
  { value: "VORHANDEN", label: "Vorhanden" },
  { value: "GELIEFERT", label: "Geliefert" },
];

const INPUT_CLS =
  "w-full rounded-[9px] border border-line-strong bg-sunken px-3 py-2 text-[13px] text-ink placeholder:text-faint focus:border-action focus:outline-none transition-colors duration-150";

export default function MaterialDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;

  const [item, setItem] = useState<MaterialItem | null>(null);
  const [games, setGames] = useState<GameOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const loadItem = useCallback(() => {
    fetch(`/api/materials/${itemId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Material nicht gefunden");
        return res.json();
      })
      .then((data) => { setItem(data); setDirty(false); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [itemId]);

  useEffect(() => { loadItem(); }, [loadItem]);
  useEffect(() => {
    fetch("/api/games").then((r) => r.json()).then((d) =>
      setGames(d.map((g: GameOption) => ({ id: g.id, name: g.name })))
    );
  }, []);

  const update = <K extends keyof MaterialItem>(field: K, value: MaterialItem[K]) => {
    if (!item) return;
    setItem({ ...item, [field]: value });
    setDirty(true);
    setSuccessMsg(null);
  };

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/materials/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...item,
          kostenGeschaetzt: item.kostenGeschaetzt ? parseFloat(item.kostenGeschaetzt) : null,
          kostenEffektiv: item.kostenEffektiv ? parseFloat(item.kostenEffektiv) : null,
        }),
      });
      if (!res.ok) throw new Error("Fehler beim Speichern");
      const updated = await res.json();
      setItem({ ...item, ...updated });
      setDirty(false);
      setSuccessMsg("Gespeichert");
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`"${item?.name}" wirklich löschen?`)) return;
    try {
      await fetch(`/api/materials/${itemId}`, { method: "DELETE" });
      router.push("/admin/materials");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    }
  };

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink-3">
        Lade...
      </div>
    );
  if (!item)
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-sm text-hot-tint">{error ?? "Nicht gefunden"}</p>
        <Link
          href="/admin/materials"
          className="text-[13px] text-ink-3 transition-colors duration-150 hover:text-ink"
        >
          Zurück
        </Link>
      </div>
    );

  const currentIdx = STATUS_OPTIONS.findIndex((s) => s.value === item.status);

  return (
    <>
      <TopBar
        title={
          <span className="flex items-center gap-2.5">
            <Link
              href="/admin/materials"
              className="text-faint transition-colors duration-150 hover:text-ink"
              aria-label="Zurück zu Material"
            >
              <CaretLeft size={16} weight="bold" />
            </Link>
            {item.name}
          </span>
        }
      >
        <span className="hidden text-[13px] text-ink-3 sm:inline">
          {item.game?.name ?? "Allgemein"}
        </span>
        <TopBarSpacer />
        {successMsg && (
          <span className="text-[13px] text-done-tint">{successMsg}</span>
        )}
        {error && <span className="text-[13px] text-hot-tint">{error}</span>}
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!dirty || saving}
        >
          {saving ? "Speichert..." : "Speichern"}
        </Button>
      </TopBar>

      <div className="anim-rise max-w-[880px] space-y-5 px-4 py-5 sm:px-[22px]">
        {/* Status-Pipeline (Segmented Control) */}
        <div>
          <span className="cg-label mb-2 block">Status</span>
          <div className="flex rounded-[9px] border border-line-strong bg-sunken p-0.5">
            {STATUS_OPTIONS.map((s, idx) => {
              const active = item.status === s.value;
              const passed = currentIdx >= 0 && idx < currentIdx;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => update("status", s.value)}
                  className={`flex-1 rounded-[7px] px-1 py-[5px] text-xs transition-colors duration-150 sm:px-3 ${
                    active
                      ? "bg-action font-semibold text-on-action"
                      : passed
                        ? "bg-done-dim font-medium text-done-tint"
                        : "font-medium text-ink-3 hover:text-ink-2"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grunddaten */}
        <section className="rounded-[10px] border border-line bg-surface p-3.5 sm:p-5">
          <h2 className="cg-label mb-4">Grunddaten</h2>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => update("name", e.target.value)}
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Game">
                <select
                  value={item.gameId ?? ""}
                  onChange={(e) => update("gameId", e.target.value || null)}
                  className={INPUT_CLS}
                >
                  <option value="">Allgemein</option>
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Kategorie">
                <select
                  value={item.kategorie}
                  onChange={(e) => update("kategorie", e.target.value)}
                  className={INPUT_CLS}
                >
                  {KATEGORIEN.map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Menge">
                <input
                  type="text"
                  value={item.menge ?? ""}
                  onChange={(e) => update("menge", e.target.value || null)}
                  placeholder="z.B. 100 Stk."
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Sponsor">
                <input
                  type="text"
                  value={item.sponsor ?? ""}
                  onChange={(e) => update("sponsor", e.target.value || null)}
                  className={INPUT_CLS}
                />
              </Field>
            </div>

            <Field label="Beschreibung">
              <textarea
                value={item.beschreibung ?? ""}
                onChange={(e) => update("beschreibung", e.target.value || null)}
                rows={3}
                className={`${INPUT_CLS} resize-none`}
              />
            </Field>
          </div>
        </section>

        {/* Kosten */}
        <section className="rounded-[10px] border border-line bg-surface p-3.5 sm:p-5">
          <h2 className="cg-label mb-4">Kosten</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Geschätzt (CHF)">
              <input
                type="number"
                step="0.01"
                value={item.kostenGeschaetzt ?? ""}
                onChange={(e) => update("kostenGeschaetzt", e.target.value || null)}
                className={`${INPUT_CLS} tnum`}
              />
            </Field>
            <Field label="Effektiv (CHF)">
              <input
                type="number"
                step="0.01"
                value={item.kostenEffektiv ?? ""}
                onChange={(e) => update("kostenEffektiv", e.target.value || null)}
                className={`${INPUT_CLS} tnum`}
              />
            </Field>
          </div>
        </section>

        {/* Kommentare (read-only) */}
        {item.kommentare && item.kommentare.length > 0 && (
          <section className="rounded-[10px] border border-line bg-surface p-3.5 sm:p-5">
            <h2 className="cg-label mb-4">
              Kommentare · <span className="tnum">{item.kommentare.length}</span>
            </h2>
            <div className="space-y-2.5">
              {item.kommentare.map((k) => (
                <div
                  key={k.id}
                  className="rounded-[10px] border border-line-soft bg-sunken px-4 py-3"
                >
                  <div className="mb-1 flex items-center gap-2 text-[11px] text-ink-3">
                    <span className="font-medium text-ink-2">{k.autor.name}</span>
                    <span>&middot;</span>
                    <span className="tnum">
                      {new Date(k.createdAt).toLocaleDateString("de-CH")}
                    </span>
                  </div>
                  <p className="text-[13px] text-ink">{k.text}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Danger Zone */}
        <section
          className="rounded-[10px] border bg-surface p-3.5 sm:p-5"
          style={{ borderColor: "var(--hot-border)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13px] text-ink-2">Position endgültig löschen</p>
              <p className="text-[11px] text-ink-3">Inkl. aller Kommentare.</p>
            </div>
            <Button variant="danger-ghost" onClick={handleDelete}>
              Löschen
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="cg-label block">{label}</label>
      {children}
    </div>
  );
}
