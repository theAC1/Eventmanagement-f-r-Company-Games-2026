"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  GEWICHTUNG_G_DEFAULT,
  GEWICHTUNG_SIEG_DEFAULT,
} from "@/lib/wertungslogik-types";

/**
 * Leitstand-Karte zur Justierung der vertraulichen Gewichtungsfaktoren
 * (gewichtungG bei Cornhole, gewichtungSieg bei XXL Viergewinnt).
 *
 * Nur die Orga sieht diese Werte — Schiedsrichter erhalten die Wertungslogik
 * ohne Gewichtungs-Keys und geben nur Rohresultate ein. Beim Speichern
 * berechnet der Server (PUT /api/games/:id) alle bestehenden Ergebnisse
 * des Games aus den Rohdaten neu.
 */

type WertungGame = {
  id: string;
  name: string;
  wertungslogik?: Record<string, unknown> | null;
};

type GewichtungsKey = "gewichtungG" | "gewichtungSieg";

type GewichtungsFeld = {
  gameId: string;
  gameName: string;
  key: GewichtungsKey;
  label: string;
  aktuellerWert: number;
  wertungslogik: Record<string, unknown>;
};

type WertungConfigProps = {
  games: WertungGame[];
  onSaved: () => void;
};

type Feedback = { typ: "ok" | "fehler"; text: string };

/** Immutable: gibt eine Kopie des Objekts ohne den angegebenen Key zurück. */
function ohneKey<T>(obj: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
}

function findeGewichtungsFelder(games: WertungGame[]): GewichtungsFeld[] {
  const felder: GewichtungsFeld[] = [];
  for (const game of games) {
    const wl = game.wertungslogik;
    if (!wl || typeof wl !== "object") continue;

    if ("gewichtungG" in wl || wl.typ === "duell_kleinbegegnungen") {
      felder.push({
        gameId: game.id,
        gameName: game.name,
        key: "gewichtungG",
        label: "Gewichtung G",
        aktuellerWert:
          typeof wl.gewichtungG === "number" ? wl.gewichtungG : GEWICHTUNG_G_DEFAULT,
        wertungslogik: wl,
      });
    }
    if ("gewichtungSieg" in wl || wl.typ === "sieg_zuege") {
      felder.push({
        gameId: game.id,
        gameName: game.name,
        key: "gewichtungSieg",
        label: "Gewichtung Sieg",
        aktuellerWert:
          typeof wl.gewichtungSieg === "number"
            ? wl.gewichtungSieg
            : GEWICHTUNG_SIEG_DEFAULT,
        wertungslogik: wl,
      });
    }
  }
  return felder;
}

export function WertungConfig({ games, onSaved }: WertungConfigProps) {
  const [entwuerfe, setEntwuerfe] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});

  const felder = findeGewichtungsFelder(games);
  if (felder.length === 0) return null;

  const handleChange = (rowKey: string, wert: string) => {
    setEntwuerfe((prev) => ({ ...prev, [rowKey]: wert }));
    setFeedback((prev) => ohneKey(prev, rowKey));
  };

  const speichern = async (feld: GewichtungsFeld) => {
    const rowKey = `${feld.gameId}:${feld.key}`;
    const roh = entwuerfe[rowKey];
    const wert = roh === undefined ? feld.aktuellerWert : Number(roh);

    if (roh !== undefined && (roh.trim() === "" || !Number.isFinite(wert) || wert < 0)) {
      setFeedback((prev) => ({
        ...prev,
        [rowKey]: { typ: "fehler", text: "Bitte eine Zahl ≥ 0 eingeben" },
      }));
      return;
    }

    setSavingKey(rowKey);
    try {
      // Lost-Update vermeiden: Die beim Seitenload geladene wertungslogik kann
      // veraltet sein (z. B. parallele Änderung auf der Admin-Detailseite).
      // Deshalb vor dem Schreiben die aktuelle Fassung laden und NUR den
      // Gewichtungs-Key in diese frische Kopie mergen.
      const frischRes = await fetch(`/api/games/${feld.gameId}`);
      if (!frischRes.ok) {
        const data = await frischRes.json().catch(() => null);
        throw new Error(
          data?.error ?? `Aktuelle Wertungslogik konnte nicht geladen werden (HTTP ${frischRes.status})`,
        );
      }
      const frischesGame = (await frischRes.json()) as WertungGame;
      const frischeWertungslogik =
        frischesGame.wertungslogik && typeof frischesGame.wertungslogik === "object"
          ? frischesGame.wertungslogik
          : feld.wertungslogik;

      const res = await fetch(`/api/games/${feld.gameId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Immutable Merge: nur der Gewichtungs-Key ändert, Rest bleibt unangetastet
          wertungslogik: { ...frischeWertungslogik, [feld.key]: wert },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setFeedback((prev) => ({
        ...prev,
        [rowKey]: { typ: "ok", text: "Gespeichert — Ergebnisse neu berechnet" },
      }));
      setEntwuerfe((prev) => ohneKey(prev, rowKey));
      onSaved();
    } catch (err) {
      setFeedback((prev) => ({
        ...prev,
        [rowKey]: {
          typ: "fehler",
          text: err instanceof Error ? err.message : "Unbekannter Fehler",
        },
      }));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="border-b border-line px-4 py-2.5 sm:px-[22px]">
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3.5">
        <div className="flex flex-col gap-0.5">
          <p className="cg-label">Wertungs-Konfiguration</p>
          <p className="text-xs text-ink-3">
            Gewichtungsfaktoren für die Punkteberechnung — nur hier im Leitstand
            sichtbar. Schiedsrichter sehen diese Werte nie, sie erfassen nur
            Rohresultate. Eine Änderung bewertet bestehende Ergebnisse neu.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {felder.map((feld) => {
            const rowKey = `${feld.gameId}:${feld.key}`;
            const fb = feedback[rowKey];
            return (
              <div
                key={rowKey}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[9px] border border-line bg-sunken px-3 py-2"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-ink">
                    {feld.gameName}
                  </span>
                  <span className="text-[11px] text-ink-3">
                    {feld.label} · aktuell{" "}
                    <span className="tnum">{feld.aktuellerWert}</span>
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  value={entwuerfe[rowKey] ?? String(feld.aktuellerWert)}
                  onChange={(e) => handleChange(rowKey, e.target.value)}
                  aria-label={`${feld.label} für ${feld.gameName}`}
                  className="tnum h-[34px] w-24 shrink-0 rounded-[9px] border border-line-strong bg-surface px-2.5 text-[13px] text-ink outline-none transition-colors duration-150 focus:border-action"
                />
                <Button
                  variant="ghost"
                  onClick={() => speichern(feld)}
                  disabled={savingKey === rowKey}
                  className="shrink-0"
                >
                  {savingKey === rowKey ? "Speichert…" : "Speichern"}
                </Button>
                {fb && (
                  <span
                    className={`basis-full text-xs ${
                      fb.typ === "ok" ? "text-done-tint" : "text-hot-tint"
                    }`}
                  >
                    {fb.text}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
