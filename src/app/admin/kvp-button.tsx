"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bug, ChatCircleDots, CheckCircle, Lightbulb, Sparkle, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

type KvpTyp = "BUG" | "WUNSCHFUNKTION" | "IDEE";

const TYP_CONFIG: Record<
  KvpTyp,
  { label: string; icon: React.ComponentType<{ size?: number; weight?: "bold" }>; activeStyle: React.CSSProperties }
> = {
  BUG: {
    label: "Bug / Fehler",
    icon: Bug,
    activeStyle: {
      color: "var(--hot-tint)",
      background: "var(--hot-dim)",
      borderColor: "var(--hot-border)",
    },
  },
  WUNSCHFUNKTION: {
    label: "Wunschfunktion",
    icon: Sparkle,
    activeStyle: {
      color: "var(--action-tint)",
      background: "var(--action-dim)",
      borderColor: "var(--action)",
    },
  },
  IDEE: {
    label: "Idee / Verbesserung",
    icon: Lightbulb,
    activeStyle: {
      color: "var(--warn)",
      background: "var(--warn-dim)",
      borderColor: "var(--warn-border)",
    },
  },
};

const INITIAL_FORM = { typ: "BUG" as KvpTyp, titel: "", beschreibung: "" };

const INPUT_CLASS =
  "w-full rounded-[9px] border border-line-strong bg-sunken px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-label focus:border-action";

export function KvpFloatingButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const charsLeft = 500 - form.beschreibung.length;

  const handleOpen = () => {
    setForm(INITIAL_FORM);
    setError(null);
    setSuccess(false);
    setOpen(true);
  };

  const handleClose = () => {
    if (saving) return;
    setOpen(false);
  };

  const handleSubmit = async () => {
    if (!form.titel.trim() || !form.beschreibung.trim()) {
      setError("Bitte Titel und Beschreibung ausfüllen.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/kvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typ: form.typ,
          titel: form.titel.trim(),
          beschreibung: form.beschreibung.trim(),
          seite: pathname,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Fehler beim Senden");
      }
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={handleOpen}
        title="Feedback / KVP melden"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-1.5 rounded-full bg-action px-4 py-2.5 text-xs font-semibold text-on-action shadow-[var(--shadow-pop)] transition-colors duration-150 hover:bg-action-hover"
        aria-label="KVP-Meldung erstellen"
      >
        <ChatCircleDots size={16} weight="bold" />
        KVP
      </button>

      {/* Modal / Bottom-Sheet */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:justify-end sm:p-6"
          style={{ background: "var(--scrim)" }}
          onClick={handleClose}
        >
          <div
            className="anim-pop w-full overflow-hidden rounded-t-2xl border border-line bg-surface shadow-[var(--shadow-pop)] sm:w-[420px] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-ink">Feedback / KVP</h2>
                <p className="tnum mt-0.5 max-w-[280px] truncate text-[11px] text-label">
                  {pathname}
                </p>
              </div>
              <button
                onClick={handleClose}
                disabled={saving}
                className="text-faint transition-colors duration-150 hover:text-ink disabled:opacity-40"
                aria-label="Schliessen"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            {success ? (
              <div className="flex flex-col items-center gap-3 px-5 py-10 text-done">
                <CheckCircle size={44} weight="bold" className="anim-pop" />
                <p className="text-sm font-medium">Danke! Meldung gespeichert.</p>
              </div>
            ) : (
              <div className="space-y-4 px-5 py-4">
                {/* Typ-Auswahl */}
                <div className="space-y-1.5">
                  <label className="cg-label block">Typ</label>
                  <div className="flex gap-2">
                    {(Object.keys(TYP_CONFIG) as KvpTyp[]).map((typ) => {
                      const cfg = TYP_CONFIG[typ];
                      const Icon = cfg.icon;
                      const isActive = form.typ === typ;
                      return (
                        <button
                          key={typ}
                          onClick={() => setForm({ ...form, typ })}
                          className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition-colors duration-150 ${
                            isActive
                              ? "font-semibold"
                              : "border-line-strong text-ink-3 hover:text-ink-2"
                          }`}
                          style={isActive ? cfg.activeStyle : undefined}
                        >
                          <Icon size={18} weight="bold" />
                          <span className="text-center leading-tight">{cfg.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Titel */}
                <div className="space-y-1.5">
                  <label className="cg-label block">Titel</label>
                  <input
                    type="text"
                    value={form.titel}
                    onChange={(e) =>
                      setForm({ ...form, titel: e.target.value.slice(0, 100) })
                    }
                    placeholder="Kurze Zusammenfassung…"
                    maxLength={100}
                    className={INPUT_CLASS}
                  />
                </div>

                {/* Beschreibung */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="cg-label">Beschreibung</label>
                    <span
                      className={`tnum text-[11px] ${
                        charsLeft < 50 ? "text-warn" : "text-label"
                      }`}
                    >
                      {charsLeft} / 500
                    </span>
                  </div>
                  <textarea
                    value={form.beschreibung}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        beschreibung: e.target.value.slice(0, 500),
                      })
                    }
                    placeholder="Was ist passiert? Was erwartest du? Je konkreter desto besser…"
                    rows={4}
                    maxLength={500}
                    className={`${INPUT_CLASS} resize-none`}
                  />
                </div>

                {/* Error */}
                {error && (
                  <p className="text-xs font-medium text-hot-tint">{error}</p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1 max-sm:pb-2">
                  <button
                    onClick={handleClose}
                    disabled={saving}
                    className="px-3 text-[13px] font-medium text-ink-3 transition-colors duration-150 hover:text-ink disabled:opacity-50"
                  >
                    Abbrechen
                  </button>
                  <Button
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={saving || !form.titel.trim() || !form.beschreibung.trim()}
                  >
                    {saving ? "Sende…" : "Melden"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
