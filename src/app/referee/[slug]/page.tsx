"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { ModusChip } from "@/components/ui/pills";
import { ButtonLink } from "@/components/ui/button";

type WertungslogikField = {
  name: string;
  typ: string;
  label: string;
};

type Wertungslogik = {
  typ?: string;
  einheit?: string;
  richtung?: string;
  messung?: string;
  tiebreaker?: string;
  eingabefelder?: WertungslogikField[];
  formel?: string;
  strafen?: Record<string, number>;
  nicht_geschafft?: string;
  levels?: { name: string; grundpunkte: number }[];
  zeit_bonus?: string;
  optionen?: { name: string; punkte_erfolg: number; punkte_fail: number }[];
  show_modus?: boolean;
};

type GameVariante = {
  id: string;
  name: string;
  beschreibung: string | null;
  istAktiv: boolean;
};

type MaterialItem = {
  id: string;
  name: string;
  menge: string | null;
  status: string;
};

type Game = {
  id: string;
  name: string;
  slug: string;
  typ: string;
  status: string;
  modus: string;
  teamsProSlot: number;
  kurzbeschreibung: string | null;
  einfuehrungMin: number;
  playtimeMin: number;
  reserveMin: number;
  regeln: string | null;
  wertungstyp: string | null;
  wertungslogik: Wertungslogik | null;
  flaecheLaengeM: number | null;
  flaecheBreiteM: number | null;
  helferAnzahl: number;
  stromNoetig: boolean;
  varianten: GameVariante[];
  materialItems: MaterialItem[];
};

/** Regeln-Text in einzelne Bullet-Zeilen zerlegen (führende Aufzählungszeichen entfernen). */
function regelnAlsListe(regeln: string): string[] {
  return regeln
    .split("\n")
    .map((z) => z.replace(/^\s*[-–•*]\s*/, "").trim())
    .filter((z) => z.length > 0);
}

function SpecChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="tnum inline-flex items-center rounded-md bg-raised px-2 py-1 text-[12px] text-ink-2">
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="cg-label text-[11px] text-label">{children}</p>;
}

export default function RefereeGamePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/games/by-slug/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error("Game nicht gefunden");
        return r.json();
      })
      .then(setGame)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="mx-auto flex h-64 w-full max-w-md items-center justify-center text-sm text-ink-3">
        Lade...
      </div>
    );
  }
  if (error || !game) {
    return (
      <div className="mx-auto flex h-64 w-full max-w-md flex-col items-center justify-center gap-4">
        <p className="text-sm text-hot-tint">{error ?? "Nicht gefunden"}</p>
        <Link href="/referee" className="text-sm text-action transition-colors duration-150 hover:text-ink">
          Zurück
        </Link>
      </div>
    );
  }

  const totalMin = game.einfuehrungMin + game.playtimeMin + game.reserveMin;
  const wl = game.wertungslogik;
  const regeln = game.regeln ? regelnAlsListe(game.regeln) : [];

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-[18px] pb-12">
      {/* Header */}
      <div>
        <Link
          href="/referee"
          className="inline-flex items-center gap-1.5 text-[12px] text-ink-3 transition-colors duration-150 hover:text-ink"
        >
          <ArrowLeft size={13} weight="bold" />
          Mein Tagesplan
        </Link>
        <div className="mt-2.5 flex items-center gap-2.5">
          <h1 className="text-[22px] font-semibold tracking-tight">{game.name}</h1>
          <ModusChip modus={game.modus} size="large" />
        </div>
        {game.kurzbeschreibung && (
          <p className="mt-1 text-[14px] leading-[1.45] text-ink-3">{game.kurzbeschreibung}</p>
        )}
      </div>

      {/* Aktionen */}
      <div className="flex flex-col gap-2.5">
        <ButtonLink variant="cta" href={`/referee/${slug}/checkin`} className="w-full">
          Check-in
        </ButtonLink>
        <ButtonLink variant="cta-ghost" href={`/referee/${slug}/eingabe`} className="w-full">
          Ergebnis eintragen
        </ButtonLink>
      </div>

      {/* Eckdaten */}
      <div className="flex flex-wrap gap-2">
        <SpecChip>
          {game.modus === "DUELL" ? `Duell · ${game.teamsProSlot} Teams` : "Solo"}
        </SpecChip>
        <SpecChip>max {game.playtimeMin} min</SpecChip>
        <SpecChip>Slot {totalMin} min</SpecChip>
        {game.flaecheLaengeM && game.flaecheBreiteM && (
          <SpecChip>
            {game.flaecheLaengeM}×{game.flaecheBreiteM} m
          </SpecChip>
        )}
        <SpecChip>{game.helferAnzahl} Helfer</SpecChip>
        {game.stromNoetig && (
          <span className="tnum inline-flex items-center rounded-md bg-warn-dim px-2 py-1 text-[12px] text-warn">
            Strom nötig
          </span>
        )}
      </div>
      <p className="tnum -mt-2 text-[12px] text-ink-3">
        Ablauf: {game.einfuehrungMin}&prime; Einführung → {game.playtimeMin}&prime; Spiel →{" "}
        {game.reserveMin}&prime; Reserve
      </p>

      {/* Aktive Variante */}
      {game.varianten.length > 0 && (
        <section className="rounded-xl border border-[var(--warn-border)] bg-warn-dim/50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-warn">
            Aktive Variante
          </p>
          <p className="mt-1.5 text-[15px] font-medium text-ink">{game.varianten[0].name}</p>
          {game.varianten[0].beschreibung && (
            <p className="mt-1 text-sm leading-[1.45] text-ink-2">
              {game.varianten[0].beschreibung}
            </p>
          )}
        </section>
      )}

      {/* Regeln */}
      {regeln.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <SectionLabel>Regeln am Feld</SectionLabel>
          <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-4">
            {regeln.map((r, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="mt-2 h-[5px] w-[5px] shrink-0 rounded-full bg-action" />
                <span className="text-[14px] leading-[1.45] text-ink-2">{r}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Wertung */}
      {wl && (
        <section className="flex flex-col gap-2.5">
          <SectionLabel>Wertung</SectionLabel>
          <div className="flex flex-col gap-3.5 rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-wrap gap-2">
              {wl.typ && <SpecChip>{wl.typ.replace(/_/g, " ")}</SpecChip>}
              {wl.einheit && <SpecChip>{wl.einheit}</SpecChip>}
              {wl.richtung && (
                <SpecChip>
                  {wl.richtung === "hoechster_gewinnt"
                    ? "Höchster gewinnt"
                    : "Niedrigster gewinnt"}
                </SpecChip>
              )}
              {wl.tiebreaker && <SpecChip>Tiebreaker: {wl.tiebreaker}</SpecChip>}
            </div>

            {/* Eingabefelder */}
            {wl.eingabefelder && wl.eingabefelder.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="cg-label text-label">Einzutragende Werte</p>
                {wl.eingabefelder.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-[9px] border border-line-soft px-3.5 py-2.5"
                  >
                    <span className="text-sm font-medium text-ink">{f.label}</span>
                    <span className="tnum text-[11px] text-ink-3">{f.typ}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Levels (Radio Runner) */}
            {wl.levels && (
              <div className="flex flex-col gap-1.5">
                <p className="cg-label text-label">Schwierigkeitsstufen</p>
                {wl.levels.map((l, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-[9px] border border-line-soft px-3.5 py-2.5"
                  >
                    <span className="text-sm font-medium capitalize text-ink">{l.name}</span>
                    <span className="tnum text-sm text-ink-2">{l.grundpunkte} Grundpunkte</span>
                  </div>
                ))}
                {wl.zeit_bonus && (
                  <p className="mt-1 text-[12px] text-ink-3">Zeitbonus: {wl.zeit_bonus}</p>
                )}
              </div>
            )}

            {/* Optionen (Eierfall) */}
            {wl.optionen && (
              <div className="flex flex-col gap-1.5">
                <p className="cg-label text-label">Risikowahl</p>
                {wl.optionen.map((o, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-[9px] border border-line-soft px-3.5 py-2.5"
                  >
                    <span className="text-sm font-medium text-ink">{o.name}</span>
                    <span className="tnum text-sm text-done-tint">{o.punkte_erfolg} Punkte</span>
                  </div>
                ))}
                {wl.show_modus && (
                  <p className="mt-1 text-[12px] text-warn">Show-Modus aktiv</p>
                )}
              </div>
            )}

            {/* Strafen (Lava Becken) */}
            {wl.strafen && (
              <div className="flex flex-col gap-1.5">
                <p className="cg-label text-label">Strafen</p>
                {Object.entries(wl.strafen).map(([key, val]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-[9px] border border-line-soft px-3.5 py-2.5"
                  >
                    <span className="text-sm capitalize text-ink">{key.replace(/_/g, " ")}</span>
                    <span className="tnum text-sm text-hot-tint">+{val} s</span>
                  </div>
                ))}
                {wl.nicht_geschafft && (
                  <p className="mt-1 text-[12px] text-hot-tint">
                    Nicht geschafft: {wl.nicht_geschafft}
                  </p>
                )}
              </div>
            )}

            {/* Formel (Kisten Stappeln) */}
            {wl.formel && (
              <div className="rounded-[9px] bg-sunken px-3.5 py-3">
                <p className="cg-label text-label">Formel</p>
                <code className="tnum mt-1 block text-sm text-ink">{wl.formel}</code>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Material */}
      {game.materialItems.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <SectionLabel>Material</SectionLabel>
          <div className="flex flex-col gap-2">
            {game.materialItems.map((m) => (
              <div
                key={m.id}
                className="flex min-h-12 items-center justify-between rounded-xl border border-line bg-surface px-4 py-2.5"
              >
                <span className="text-sm font-medium text-ink">{m.name}</span>
                <span className="tnum text-[13px] text-ink-3">{m.menge ?? "–"}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
