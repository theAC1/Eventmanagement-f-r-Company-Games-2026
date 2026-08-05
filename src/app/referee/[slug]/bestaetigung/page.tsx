"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, CloudArrowUp } from "@phosphor-icons/react";
import { enqueueErgebnis } from "@/lib/offline-queue";
import { KORREKTUR_FENSTER_MS } from "@/lib/ergebnis-sperre";
import { ProgressBar } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

// ─── Types ───

type EingabeFeld = { name: string; typ: string; label: string };
type Level = { name: string; grundpunkte: number };
type Option = { name: string; punkte_erfolg: number; punkte_fail: number };

type Wertungslogik = {
  typ?: string;
  einheit?: string;
  richtung?: string;
  messung?: string;
  eingabefelder?: EingabeFeld[];
  levels?: Level[];
  optionen?: Option[];
  strafen?: Record<string, number>;
  nicht_geschafft?: string;
};

type EntryData = {
  ergebnisId: string;
  teamId: string;
  teamName: string;
  rohdaten: Record<string, unknown>;
};

type BestaetigungPayload = {
  gameId: string;
  gameName: string;
  gameSlug: string;
  slotId?: string;
  wertungslogik: Wertungslogik | null;
  entries: EntryData[];
};

// ─── Helpers ───

function berechneGamePunkte(
  rohdaten: Record<string, unknown>,
  wl: Wertungslogik,
): number {
  switch (wl.typ) {
    case "max_value": {
      const feld = wl.messung ?? wl.eingabefelder?.[0]?.name;
      return feld ? (Number(rohdaten[feld]) || 0) : 0;
    }
    case "zeit": {
      const zeit = Number(rohdaten.zeit_sekunden ?? rohdaten.durchgang_1 ?? 0);
      let strafzeit = 0;
      if (wl.strafen) {
        for (const [key, sek] of Object.entries(wl.strafen)) {
          strafzeit += (Number(rohdaten[key]) || 0) * sek;
        }
      }
      if (rohdaten.nicht_geschafft === true) return 99999;
      return zeit + strafzeit;
    }
    case "punkte_duell": {
      const felder = wl.eingabefelder ?? [];
      return felder.length > 0 ? (Number(rohdaten[felder[0].name]) || 0) : 0;
    }
    case "formel": {
      const felder = wl.eingabefelder ?? [];
      let summe = 0;
      for (const f of felder) {
        const val = Number(rohdaten[f.name] ?? 0);
        summe += val * val;
      }
      return summe;
    }
    case "multi_level": {
      const level = wl.levels?.find((l) => l.name === rohdaten.level);
      if (!level) return 0;
      const zeit = Number(rohdaten.zeit_sekunden ?? 0);
      return Math.max(0, level.grundpunkte - zeit * 0.1);
    }
    case "risiko_wahl": {
      const option = wl.optionen?.find((o) => o.name === rohdaten.option);
      if (!option) return 0;
      const erfolg = rohdaten.erfolg === true;
      return erfolg ? option.punkte_erfolg : option.punkte_fail;
    }
    default:
      return 0;
  }
}

function formatRohdaten(
  rohdaten: Record<string, unknown>,
  wl: Wertungslogik | null,
): { label: string; value: string }[] {
  if (!wl) return [];
  const items: { label: string; value: string }[] = [];

  // Eingabefelder
  for (const f of wl.eingabefelder ?? []) {
    if (rohdaten[f.name] !== undefined) {
      items.push({ label: f.label, value: String(rohdaten[f.name]) });
    }
  }

  // Time
  if (wl.typ === "zeit" && rohdaten.zeit_sekunden !== undefined) {
    const sek = Number(rohdaten.zeit_sekunden);
    const min = Math.floor(sek / 60);
    const rest = sek % 60;
    items.push({
      label: "Zeit",
      value: min > 0 ? `${min}:${String(rest).padStart(2, "0")} min` : `${sek}s`,
    });
  }

  // Level
  if (wl.typ === "multi_level" && rohdaten.level) {
    items.push({ label: "Level", value: String(rohdaten.level) });
  }

  // Option + Erfolg
  if (wl.typ === "risiko_wahl") {
    if (rohdaten.option) items.push({ label: "Wahl", value: String(rohdaten.option) });
    if (rohdaten.erfolg !== undefined) {
      items.push({ label: "Erfolg", value: rohdaten.erfolg ? "Ja" : "Nein" });
    }
  }

  // Penalties
  if (wl.strafen) {
    for (const [key, sek] of Object.entries(wl.strafen)) {
      const count = Number(rohdaten[key] ?? 0);
      if (count > 0) {
        items.push({
          label: key.replace(/_/g, " "),
          value: `${count}x (+${count * sek}s)`,
        });
      }
    }
  }

  // Nicht geschafft
  if (rohdaten.nicht_geschafft === true) {
    items.push({ label: "Status", value: "Nicht geschafft" });
  }

  return items;
}

// ─── Component ───

export default function BestaetigungPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [payload, setPayload] = useState<BestaetigungPayload | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [queued, setQueued] = useState(false);
  const [eingetragenUm, setEingetragenUm] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const restMs =
    eingetragenUm !== null ? Math.max(0, eingetragenUm + KORREKTUR_FENSTER_MS - now) : 0;
  const korrekturOffen = eingetragenUm !== null && restMs > 0;

  // Countdown sekündlich aktualisieren solange das Korrekturfenster offen ist
  useEffect(() => {
    if (step !== 2 || eingetragenUm === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step, eingetragenUm]);

  const formatRest = (ms: number) => {
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  // Load data from sessionStorage
  useEffect(() => {
    const raw = sessionStorage.getItem("bestaetigung_data");
    if (!raw) {
      setError("Keine Daten vorhanden. Bitte zurück zur Live-Ansicht.");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as BestaetigungPayload;
      setPayload(parsed);
    } catch {
      setError("Daten konnten nicht geladen werden");
    }
  }, []);

  // ─── Step 1: Save ───

  const handleSave = async () => {
    if (!payload) return;
    setSaving(true);
    setError(null);

    const commitId = crypto.randomUUID();

    // Bei Signalverlust: alle Einträge in die Offline-Warteschlange legen.
    // Dank commitId (Idempotenz) kann ein späterer Retry keine Duplikate erzeugen.
    const enqueueAll = () => {
      for (const entry of payload.entries) {
        enqueueErgebnis({
          commitId,
          gameId: payload.gameId,
          teamId: entry.teamId,
          zeitplanSlotId: payload.slotId ?? null,
          gameName: payload.gameName,
          teamName: entry.teamName,
          rohdaten: entry.rohdaten,
        });
      }
      sessionStorage.removeItem("bestaetigung_data");
      setQueued(true);
    };

    try {
      const ids: string[] = [];

      for (const entry of payload.entries) {
        let res: Response;
        try {
          res = await fetch("/api/ergebnisse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              gameId: payload.gameId,
              teamId: entry.teamId,
              zeitplanSlotId: payload.slotId ?? null,
              rohdaten: entry.rohdaten,
              commitId,
            }),
          });
        } catch {
          // Netzwerkfehler (offline) — Warteschlange übernimmt
          enqueueAll();
          return;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          if (res.status >= 500 || res.status === 408 || res.status === 429) {
            // Serverseitig temporär — ebenfalls in die Warteschlange
            enqueueAll();
            return;
          }
          if (data?.code === "LOCKED") {
            throw new Error(data.error);
          }
          throw new Error(data?.error ?? `Fehler bei ${entry.teamName}`);
        }

        const result = await res.json();
        ids.push(result.id);
      }

      setSavedIds(ids);
      setEingetragenUm(Date.now());
      setNow(Date.now());
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  // ─── Step 2: Verify ───

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);

    try {
      for (const id of savedIds) {
        const res = await fetch(`/api/ergebnisse/${id}/verify`, {
          method: "PUT",
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Fehler beim Verifizieren");
        }
      }

      // Clean up sessionStorage
      sessionStorage.removeItem("bestaetigung_data");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Bestätigen");
    } finally {
      setVerifying(false);
    }
  };

  // ─── Error State ───

  if (error && !payload) {
    return (
      <div className="mx-auto flex h-64 w-full max-w-md flex-col items-center justify-center gap-3">
        <p className="text-sm text-hot-tint">{error}</p>
        <Link href="/referee" className="text-sm text-action transition-colors duration-150 hover:text-ink">
          Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="mx-auto flex h-64 w-full max-w-md items-center justify-center text-sm text-ink-3">
        Lade...
      </div>
    );
  }

  // ─── Offline-Warteschlange ───

  if (queued) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-6">
        <div className="anim-pop flex h-20 w-20 items-center justify-center rounded-full border-2 border-[var(--warn-border)] bg-warn-dim">
          <CloudArrowUp size={40} weight="bold" className="text-warn" />
        </div>
        <div className="max-w-sm text-center">
          <h2 className="text-[22px] font-semibold tracking-tight">Zwischengespeichert</h2>
          <p className="mt-2 text-sm leading-[1.45] text-ink-3">
            Keine Verbindung zum Server. Das Ergebnis für {payload?.gameName} wird
            automatisch übermittelt, sobald wieder Empfang besteht — du kannst
            normal weiterarbeiten.
          </p>
        </div>
        <Button variant="cta" onClick={() => router.push("/referee")} className="w-full max-w-xs">
          Zurück zur Übersicht
        </Button>
      </div>
    );
  }

  // ─── Done ───

  if (done) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-6">
        <CheckCircle size={80} weight="fill" className="anim-pop text-done" />
        <div className="text-center">
          <h2 className="text-[22px] font-semibold tracking-tight">Partie abgeschlossen</h2>
          <p className="mt-2 text-sm text-ink-3">
            {payload.gameName} — Ergebnis verifiziert
          </p>
        </div>
        <Button variant="cta" onClick={() => router.push("/referee")} className="w-full max-w-xs">
          Zurück zur Übersicht
        </Button>
      </div>
    );
  }

  const wl = payload.wertungslogik;

  // ─── Render ───

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-[18px] pb-12">
      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-[12px] text-ink-3 transition-colors duration-150 hover:text-ink"
        >
          <ArrowLeft size={13} weight="bold" />
          Zurück
        </button>
        <h1 className="mt-2.5 text-[22px] font-semibold tracking-tight">
          {step === 1 ? "Ergebnis prüfen" : "Ergebnis bestätigen"}
        </h1>
        <p className="mt-1 text-[13px] text-ink-3">{payload.gameName}</p>
      </div>

      {/* 2-Schritt-Fortschritt */}
      <div className="flex flex-col gap-1.5">
        <ProgressBar
          pct={step === 1 ? 50 : 100}
          color={step === 1 ? "var(--action)" : "var(--done)"}
          height={4}
        />
        <div className="flex justify-between text-[11px]">
          <span className={step === 1 ? "font-semibold text-ink-2" : "text-label"}>
            1 · Prüfen
          </span>
          <span className={step === 2 ? "font-semibold text-ink-2" : "text-label"}>
            2 · Bestätigen
          </span>
        </div>
      </div>

      {/* Punkte-Vorschau pro Team */}
      {payload.entries.map((entry) => {
        const punkte = wl ? berechneGamePunkte(entry.rohdaten, wl) : null;
        const details = formatRohdaten(entry.rohdaten, wl);

        return (
          <div
            key={entry.ergebnisId}
            className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-ink">{entry.teamName}</p>
              {punkte !== null && (
                <span className="tnum text-[22px] font-bold text-ink">
                  {punkte === 99999 ? "DNF" : punkte.toFixed(1)}
                  {punkte !== 99999 && (
                    <span className="ml-1 text-[13px] font-medium text-ink-3">
                      {wl?.einheit ?? "P"}
                    </span>
                  )}
                </span>
              )}
            </div>

            {details.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t border-line-soft pt-3">
                {details.map((d, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="capitalize text-ink-3">{d.label}</span>
                    <span className="tnum text-ink">{d.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Error */}
      {error && <p className="text-center text-sm text-hot-tint">{error}</p>}

      {/* Step 1: Save button */}
      {step === 1 && (
        <Button variant="cta" onClick={handleSave} disabled={saving} className="h-16 w-full rounded-[14px]">
          {saving ? "Speichert..." : "Speichern"}
        </Button>
      )}

      {/* Step 2: Verify button */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          {/* Korrektur-Countdown */}
          {eingetragenUm !== null && (
            <div
              className={`rounded-xl border p-4 ${
                korrekturOffen
                  ? "border-[var(--warn-border)] bg-warn-dim/60"
                  : "border-line bg-surface"
              }`}
            >
              {korrekturOffen ? (
                <div className="flex flex-col gap-3">
                  <p className="text-center text-sm text-ink-2">
                    Noch{" "}
                    <span className="tnum font-bold text-warn">{formatRest(restMs)}</span>{" "}
                    zum Korrigieren
                  </p>
                  <button
                    onClick={() => {
                      const qs = new URLSearchParams();
                      if (savedIds.length) qs.set("ergebnisIds", savedIds.join(","));
                      if (payload.slotId) qs.set("slotId", payload.slotId);
                      const query = qs.toString();
                      router.push(`/referee/${slug}/live${query ? `?${query}` : ""}`);
                    }}
                    disabled={savedIds.length === 0}
                    className="min-h-12 w-full rounded-[9px] border border-[var(--warn-border)] text-sm font-medium text-warn transition-colors duration-150 hover:bg-warn-dim disabled:pointer-events-none disabled:opacity-40"
                  >
                    Korrigieren
                  </button>
                </div>
              ) : (
                <p className="text-center text-sm text-ink-3">
                  Die Korrekturfrist ist abgelaufen. Ab jetzt kann nur noch ein Admin das Ergebnis korrigieren.
                </p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="text-center text-sm text-ink-2">
              Hiermit bestätige ich die Richtigkeit der Ergebnisse.
            </p>
          </div>

          <Button
            variant="success-outline"
            onClick={handleVerify}
            disabled={verifying}
            className="w-full"
          >
            {verifying ? "Wird bestätigt..." : "Bestätigen"}
          </Button>
        </div>
      )}
    </div>
  );
}
