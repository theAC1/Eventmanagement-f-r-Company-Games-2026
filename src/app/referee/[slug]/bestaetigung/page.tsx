"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { enqueueErgebnis } from "@/lib/offline-queue";
import { KORREKTUR_FENSTER_MS } from "@/lib/ergebnis-sperre";

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
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-400 text-sm">{error}</p>
        <Link href="/referee" className="text-sm text-zinc-400 hover:text-white transition">
          Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        Lade...
      </div>
    );
  }

  // ─── Offline-Warteschlange ───

  if (queued) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-20 h-20 rounded-full bg-amber-900/40 border-2 border-amber-600 flex items-center justify-center">
          <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
          </svg>
        </div>
        <div className="text-center max-w-sm">
          <h2 className="text-2xl font-bold">Ergebnis zwischengespeichert</h2>
          <p className="text-sm text-zinc-400 mt-2">
            Keine Verbindung zum Server. Das Ergebnis für {payload?.gameName} wird
            automatisch übermittelt, sobald wieder Empfang besteht — du kannst
            normal weiterarbeiten.
          </p>
        </div>
        <button
          onClick={() => router.push("/referee")}
          className="px-8 py-3 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition"
        >
          Zurück zur Übersicht
        </button>
      </div>
    );
  }

  // ─── Done ───

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-20 h-20 rounded-full bg-emerald-900/40 border-2 border-emerald-600 flex items-center justify-center">
          <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold">Partie abgeschlossen</h2>
          <p className="text-sm text-zinc-400 mt-2">
            {payload.gameName} — Ergebnis verifiziert
          </p>
        </div>
        <button
          onClick={() => router.push("/referee")}
          className="px-8 py-3 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition"
        >
          Zurück zur Übersicht
        </button>
      </div>
    );
  }

  const wl = payload.wertungslogik;

  // ─── Render ───

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="text-xs text-zinc-500 hover:text-white transition"
        >
          &larr; Zurück
        </button>
        <h1 className="text-2xl font-bold tracking-tight mt-2">
          {step === 1 ? "Ergebnis prüfen" : "Ergebnis bestätigen"}
        </h1>
        <p className="text-sm text-zinc-400">{payload.gameName}</p>
      </div>

      {/* Step indicator */}
      <div className="flex gap-2">
        <div className={`flex-1 h-1 rounded-full ${step >= 1 ? "bg-white" : "bg-zinc-800"}`} />
        <div className={`flex-1 h-1 rounded-full ${step >= 2 ? "bg-emerald-500" : "bg-zinc-800"}`} />
      </div>

      {/* Entries summary */}
      {payload.entries.map((entry) => {
        const punkte = wl ? berechneGamePunkte(entry.rohdaten, wl) : null;
        const details = formatRohdaten(entry.rohdaten, wl);

        return (
          <div
            key={entry.ergebnisId}
            className="border border-zinc-800 rounded-lg p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="font-medium">{entry.teamName}</p>
              {punkte !== null && (
                <span className="text-lg font-mono font-bold">
                  {punkte === 99999 ? "DNF" : punkte.toFixed(1)}
                  {wl?.einheit ? ` ${wl.einheit}` : " P"}
                </span>
              )}
            </div>

            {details.length > 0 && (
              <div className="space-y-1">
                {details.map((d, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-zinc-500">{d.label}</span>
                    <span className="font-mono">{d.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-400 text-center">{error}</p>
      )}

      {/* Step 1: Save button */}
      {step === 1 && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 bg-white text-black text-lg font-semibold rounded-lg hover:bg-zinc-200 transition disabled:opacity-50"
        >
          {saving ? "Speichert..." : "Speichern"}
        </button>
      )}

      {/* Step 2: Verify button */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Korrektur-Countdown */}
          {eingetragenUm !== null && (
            <div className={`border rounded-lg p-4 ${korrekturOffen ? "border-amber-700/50 bg-amber-950/20" : "border-zinc-800 bg-zinc-900/50"}`}>
              {korrekturOffen ? (
                <div className="space-y-3">
                  <p className="text-sm text-center">
                    <span className="text-zinc-400">Noch </span>
                    <span className="font-mono font-bold text-amber-400 tabular-nums">{formatRest(restMs)}</span>
                    <span className="text-zinc-400"> zum Korrigieren</span>
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
                    className="w-full py-2.5 border border-amber-700/60 text-amber-300 text-sm font-medium rounded-lg hover:bg-amber-900/30 transition disabled:opacity-40"
                  >
                    Korrigieren
                  </button>
                </div>
              ) : (
                <p className="text-sm text-zinc-400 text-center">
                  Die Korrekturfrist ist abgelaufen. Ab jetzt kann nur noch ein Admin das Ergebnis korrigieren.
                </p>
              )}
            </div>
          )}

          <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/50">
            <p className="text-sm text-zinc-300 text-center">
              Hiermit bestätige ich die Richtigkeit der Ergebnisse.
            </p>
          </div>

          <button
            onClick={handleVerify}
            disabled={verifying}
            className="w-full py-4 bg-emerald-600 text-white text-lg font-semibold rounded-lg hover:bg-emerald-500 transition disabled:opacity-50"
          >
            {verifying ? "Wird bestätigt..." : "Bestätigen"}
          </button>
        </div>
      )}
    </div>
  );
}
