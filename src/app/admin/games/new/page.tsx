"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react";
import { TopBar, TopBarSpacer } from "@/components/ui/top-bar";
import { Button, ButtonLink } from "@/components/ui/button";

const INPUT_CLASS =
  "w-full h-[38px] rounded-[9px] border border-line-strong bg-sunken px-3 text-sm text-ink outline-none transition-colors duration-150 focus:border-action";
const TEXTAREA_CLASS =
  "w-full rounded-[9px] border border-line-strong bg-sunken px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 focus:border-action resize-none";

export default function NewGamePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    typ: "NEU" as "RETURNEE" | "NEU",
    modus: "SOLO" as "SOLO" | "DUELL",
    teamsProSlot: 1,
    kurzbeschreibung: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name ist erforderlich");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          kurzbeschreibung: form.kurzbeschreibung || null,
        }),
      });
      if (!res.ok) throw new Error("Fehler beim Erstellen");
      const game = await res.json();
      router.push(`/admin/games/${game.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col">
      <TopBar
        title={
          <span className="flex items-center gap-2">
            <Link
              href="/admin"
              className="text-ink-3 transition-colors duration-150 hover:text-ink"
            >
              Games
            </Link>
            <CaretRight size={13} weight="bold" className="text-faint" />
            <span>Neues Game</span>
          </span>
        }
      >
        <TopBarSpacer />
        {error && <span className="text-sm text-hot-tint">{error}</span>}
        <ButtonLink href="/admin" variant="ghost">
          Abbrechen
        </ButtonLink>
        <Button
          type="submit"
          form="new-game-form"
          variant="primary"
          disabled={saving}
        >
          {saving ? "Erstellt..." : "Game erstellen"}
        </Button>
      </TopBar>

      <div className="px-4 py-6 sm:px-[22px]">
        <form
          id="new-game-form"
          onSubmit={handleSubmit}
          className="max-w-4xl space-y-5"
        >
          <section className="space-y-4 rounded-[10px] border border-line bg-surface p-5">
            <h2 className="cg-label">Grunddaten</h2>

            <div className="space-y-1.5">
              <label className="cg-label">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="z.B. Mega Jenga"
                autoFocus
                className={INPUT_CLASS}
              />
            </div>

            <div className="space-y-1.5">
              <label className="cg-label">Kurzbeschreibung</label>
              <textarea
                value={form.kurzbeschreibung}
                onChange={(e) =>
                  setForm({ ...form, kurzbeschreibung: e.target.value })
                }
                rows={2}
                placeholder="Worum geht es bei diesem Game?"
                className={TEXTAREA_CLASS}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="cg-label">Typ</label>
                <select
                  value={form.typ}
                  onChange={(e) =>
                    setForm({ ...form, typ: e.target.value as typeof form.typ })
                  }
                  className={INPUT_CLASS}
                >
                  <option value="NEU">Neu</option>
                  <option value="RETURNEE">Returnee</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="cg-label">Modus</label>
                <select
                  value={form.modus}
                  onChange={(e) => {
                    const m = e.target.value as typeof form.modus;
                    setForm({
                      ...form,
                      modus: m,
                      teamsProSlot: m === "DUELL" ? 2 : 1,
                    });
                  }}
                  className={INPUT_CLASS}
                >
                  <option value="SOLO">Solo</option>
                  <option value="DUELL">Duell</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="cg-label">Teams/Slot</label>
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={form.teamsProSlot}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      teamsProSlot: parseInt(e.target.value) || 1,
                    })
                  }
                  className={`${INPUT_CLASS} tnum`}
                />
              </div>
            </div>
          </section>

          <p className="text-xs text-faint">
            Nach dem Erstellen kannst du Regeln, Wertungslogik, Zeitstruktur und
            mehr auf der Detail-Seite konfigurieren.
          </p>
        </form>
      </div>
    </div>
  );
}
