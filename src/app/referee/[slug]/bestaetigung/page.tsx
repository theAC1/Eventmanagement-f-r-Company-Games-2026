"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, CloudArrowUp } from "@phosphor-icons/react";
import { enqueueErgebnis, isRetryableStatus } from "@/lib/offline-queue";
import { KORREKTUR_FENSTER_MS } from "@/lib/ergebnis-sperre";
import {
  berechneGamePunkteAusRohdaten,
  berechneKleinbegegnungenStatistik,
  parseKleinbegegnungen,
} from "@/lib/game-punkte-berechnung";
import { ZEIT_DNF_SENTINEL, type Wertungslogik } from "@/lib/wertungslogik-types";
import { ProgressBar } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { formatPunktzahl, formatSekundenMSS, formatSiege } from "@/components/wertung/format";
import { formatRohdaten } from "@/components/wertung/rohdaten-format";

// ─── Types ───

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

/**
 * Punkte-Vorschau formatieren: Zeit-Games als m:ss (DNF-Sentinel als "DNF"),
 * alle anderen als Zahl mit Einheit.
 */
function punkteAnzeige(
  punkte: number,
  wl: Wertungslogik | null,
): { text: string; einheit: string | null } {
  if (punkte === ZEIT_DNF_SENTINEL) return { text: "DNF", einheit: null };
  if (wl?.typ === "zeit") return { text: formatSekundenMSS(punkte), einheit: "min" };
  return { text: formatPunktzahl(punkte), einheit: wl?.einheit ?? "P" };
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
  const [queuedGrund, setQueuedGrund] = useState<"offline" | "server">("offline");
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
    const enqueueAll = (grund: "offline" | "server" = "offline") => {
      setQueuedGrund(grund);
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
          if (isRetryableStatus(res.status)) {
            // Serverfehler/Überlast: Das Ergebnis kommt in die Warteschlange
            // und wird automatisch nachgereicht — sonst gingen bereits
            // erfasste Teams dieser Begegnung verloren. Der Grund wird aber
            // ehrlich benannt: "keine Verbindung" wäre falsch und schickte
            // die Schiedsrichter auf WLAN-Suche.
            enqueueAll("server");
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
            {queuedGrund === "server"
              ? `Der Server konnte gerade nicht speichern. Das Ergebnis für ${payload?.gameName ?? ""} ist gesichert und wird automatisch nachgereicht — du kannst normal weiterarbeiten.`
              : `Keine Verbindung zum Server. Das Ergebnis für ${payload?.gameName ?? ""} wird automatisch übermittelt, sobald wieder Empfang besteht — du kannst normal weiterarbeiten.`}
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
        // Cornhole/Viergewinnt: Die Gewichtung ist dem Client unbekannt
        // (Server filtert sie) — deshalb KEINE Punktzahl, nur die
        // Rohdaten-Zusammenfassung anzeigen. Der Server rechnet verbindlich.
        const istKleinbegegnungen = wl?.typ === "duell_kleinbegegnungen";
        const hatVerdeckteGewichtung =
          istKleinbegegnungen || wl?.typ === "sieg_zuege";
        const punkte =
          wl && !hatVerdeckteGewichtung
            ? berechneGamePunkteAusRohdaten(entry.rohdaten, wl)
            : null;
        const details = formatRohdaten(entry.rohdaten, wl);

        return (
          <div
            key={entry.ergebnisId}
            className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-ink">{entry.teamName}</p>
              {istKleinbegegnungen ? (
                (() => {
                  const stat = berechneKleinbegegnungenStatistik(
                    parseKleinbegegnungen(entry.rohdaten),
                  );
                  return (
                    <span className="tnum text-right text-[13px] font-medium leading-[1.4] text-ink-2">
                      {stat.gespielt}{" "}
                      {stat.gespielt === 1 ? "Kleinbegegnung" : "Kleinbegegnungen"} ·{" "}
                      {formatSiege(stat.siege)} {stat.siege === 1 ? "Sieg" : "Siege"} · Ø{" "}
                      {stat.mittelwert.toFixed(1)} Punkte
                    </span>
                  );
                })()
              ) : punkte !== null ? (
                (() => {
                  const anzeige = punkteAnzeige(punkte, wl);
                  return (
                    <span className="tnum text-[22px] font-bold text-ink">
                      {anzeige.text}
                      {anzeige.einheit && (
                        <span className="ml-1 text-[13px] font-medium text-ink-3">
                          {anzeige.einheit}
                        </span>
                      )}
                    </span>
                  );
                })()
              ) : null}
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
