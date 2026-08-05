"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CaretLeft } from "@phosphor-icons/react";
import { TopBar, TopBarSpacer } from "@/components/ui/top-bar";
import { Button, ButtonLink } from "@/components/ui/button";

type GameOption = { id: string; name: string };

const KATEGORIEN = [
  { value: "SPONSOR", label: "Sponsor" },
  { value: "MIETE", label: "Miete" },
  { value: "KAUF", label: "Kauf" },
  { value: "EIGENBAU", label: "Eigenbau" },
  { value: "VERBRAUCH", label: "Verbrauch" },
  { value: "INFRASTRUKTUR", label: "Infrastruktur" },
];

const FORM_ID = "new-material-form";

const INPUT_CLS =
  "w-full rounded-[9px] border border-line-strong bg-sunken px-3 py-2 text-[13px] text-ink placeholder:text-faint focus:border-action focus:outline-none transition-colors duration-150";

export default function NewMaterialPage() {
  const router = useRouter();
  const [games, setGames] = useState<GameOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    gameId: "",
    kategorie: "KAUF",
    menge: "",
    beschreibung: "",
    sponsor: "",
    kostenGeschaetzt: "",
  });

  useEffect(() => {
    fetch("/api/games")
      .then((res) => res.json())
      .then((data) => setGames(data.map((g: GameOption) => ({ id: g.id, name: g.name }))));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name ist erforderlich"); return; }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          gameId: form.gameId || null,
          kostenGeschaetzt: form.kostenGeschaetzt ? parseFloat(form.kostenGeschaetzt) : null,
        }),
      });
      if (!res.ok) throw new Error("Fehler beim Erstellen");
      const item = await res.json();
      router.push(`/admin/materials/${item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
      setSaving(false);
    }
  };

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
            Neue Position
          </span>
        }
      >
        <TopBarSpacer />
        {error && <span className="text-[13px] text-hot-tint">{error}</span>}
        <ButtonLink href="/admin/materials" variant="ghost">
          Abbrechen
        </ButtonLink>
        <Button type="submit" form={FORM_ID} variant="primary" disabled={saving}>
          {saving ? "Erstellt..." : "Position erstellen"}
        </Button>
      </TopBar>

      <form
        id={FORM_ID}
        onSubmit={handleSubmit}
        className="anim-rise max-w-[720px] space-y-5 px-4 py-5 sm:px-[22px]"
      >
        <section className="rounded-[10px] border border-line bg-surface p-3.5 sm:p-5">
          <h2 className="cg-label mb-4">Grunddaten</h2>
          <div className="space-y-4">
            <Field label="Name">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="z.B. Erusbacher Harassen"
                autoFocus
                className={INPUT_CLS}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Game">
                <select
                  value={form.gameId}
                  onChange={(e) => setForm({ ...form, gameId: e.target.value })}
                  className={INPUT_CLS}
                >
                  <option value="">Allgemein (kein Game)</option>
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Kategorie">
                <select
                  value={form.kategorie}
                  onChange={(e) => setForm({ ...form, kategorie: e.target.value })}
                  className={INPUT_CLS}
                >
                  {KATEGORIEN.map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Menge">
                <input
                  type="text"
                  value={form.menge}
                  onChange={(e) => setForm({ ...form, menge: e.target.value })}
                  placeholder="z.B. 100 + 50 Reserve"
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Sponsor">
                <input
                  type="text"
                  value={form.sponsor}
                  onChange={(e) => setForm({ ...form, sponsor: e.target.value })}
                  placeholder="z.B. Erusbacher Bier"
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Kosten (CHF)">
                <input
                  type="number"
                  step="0.01"
                  value={form.kostenGeschaetzt}
                  onChange={(e) => setForm({ ...form, kostenGeschaetzt: e.target.value })}
                  placeholder="Geschätzt"
                  className={`${INPUT_CLS} tnum`}
                />
              </Field>
            </div>

            <Field label="Beschreibung">
              <textarea
                value={form.beschreibung}
                onChange={(e) => setForm({ ...form, beschreibung: e.target.value })}
                rows={2}
                placeholder="Zusätzliche Details..."
                className={`${INPUT_CLS} resize-none`}
              />
            </Field>
          </div>
        </section>

        {error && <p className="text-[13px] text-hot-tint">{error}</p>}
      </form>
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
