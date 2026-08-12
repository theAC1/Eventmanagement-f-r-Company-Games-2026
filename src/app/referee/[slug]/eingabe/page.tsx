"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import jsQR from "jsqr";
import { ArrowLeft, Warning } from "@phosphor-icons/react";
import { ErgebnisFormular } from "@/components/ergebnis-formular";
import { KleinbegegnungenEditor } from "@/components/wertung/kleinbegegnungen-editor";
import { spiegleKleinbegegnungen } from "@/lib/game-punkte-berechnung";
import type { KleinbegegnungRoh, Wertungslogik } from "@/lib/wertungslogik-types";
import { parseQrToken, resolveScanResult, applyScannedTeam } from "@/lib/qr-scan";

type Game = {
  id: string;
  name: string;
  slug: string;
  modus: string;
  teamsProSlot: number;
  wertungslogik: Wertungslogik | null;
};

type Team = { id: string; name: string; nummer: number };

type ConflictEntry = {
  id: string;
  gamePunkte: number;
  status: string;
  eingetragenUm: string;
  rohdaten: Record<string, unknown>;
  team?: { id: string; name: string; nummer: number };
  eingetragenVon?: { id: string; name: string } | null;
};

type BarcodeDetectorLike = {
  detect: (video: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
};

const selectClass =
  "h-12 flex-1 min-w-0 rounded-[9px] border border-line-strong bg-sunken px-3 text-sm text-ink focus:border-action focus:outline-none";

export default function EingabePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictEntry[] | null>(null);
  const [showConflict, setShowConflict] = useState(false);

  // Formular-State
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedTeamId2, setSelectedTeamId2] = useState(""); // Für Duell
  const [rohdaten, setRohdaten] = useState<Record<string, unknown>>({});
  const [rohdaten2, setRohdaten2] = useState<Record<string, unknown>>({}); // Für Duell Team B
  // Für duell_kleinbegegnungen (Cornhole): EINE gemeinsame Liste,
  // Team B erhält beim Speichern die gespiegelte Sicht.
  const [kleinbegegnungen, setKleinbegegnungen] = useState<KleinbegegnungRoh[]>([]);

  // QR-Scanner-State
  const [scanTarget, setScanTarget] = useState<"A" | "B" | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const scanningRef = useRef(false);
  const scanTargetRef = useRef<"A" | "B" | null>(null);
  const resolvingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/games/by-slug/${slug}`).then((r) => {
        if (!r.ok) throw new Error(`Game laden fehlgeschlagen (HTTP ${r.status})`);
        return r.json();
      }),
      fetch("/api/teams").then((r) => {
        if (!r.ok) throw new Error(`Teams laden fehlgeschlagen (HTTP ${r.status})`);
        return r.json();
      }),
    ]).then(([g, t]) => {
      setGame(g);
      setTeams(t);
      setLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Daten konnten nicht geladen werden");
      setLoading(false);
    });
  }, [slug]);

  // Cleanup: Kamera stoppen bei Unmount
  useEffect(() => {
    // Das <video>-Element beim Aufsetzen festhalten: im Cleanup kann videoRef
    // bereits auf ein anderes (oder gar kein) Element zeigen — der Kamerastream
    // liefe dann weiter.
    const video = videoRef.current;
    return () => {
      scanningRef.current = false;
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      if (video?.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const stopScanner = () => {
    scanningRef.current = false;
    scanTargetRef.current = null;
    setScanning(false);
    setScanTarget(null);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  // Decodierten QR-Wert verarbeiten: Token extrahieren und Team auflösen
  const handleDecoded = async (raw: string) => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    try {
      // Token kann als Portal-URL (…/team/<token>), `token`-Query-Param oder Rohwert kommen
      const token = parseQrToken(raw);

      const res = await fetch("/api/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: token }),
      });
      const result = resolveScanResult(res.ok ? await res.json() : null);
      if (!result.ok) {
        setScanError(result.error);
        return;
      }
      const target = scanTargetRef.current;
      const next = applyScannedTeam(
        { selectedTeamId, selectedTeamId2 },
        target,
        result.teamId,
      );
      setSelectedTeamId(next.selectedTeamId);
      setSelectedTeamId2(next.selectedTeamId2);
      setScanError(null);
      stopScanner();
    } finally {
      resolvingRef.current = false;
    }
  };

  // QR-Scanner via Kamera – BarcodeDetector wenn verfügbar, sonst jsQR-Fallback (iOS Safari)
  const startScanner = async (target: "A" | "B") => {
    setScanError(null);
    setScanTarget(target);
    scanTargetRef.current = target;
    scanningRef.current = true;
    setScanning(true);
    // Warten bis das <video>-Element gerendert ist
    await new Promise((r) => setTimeout(r, 0));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const hasBarcodeDetector = "BarcodeDetector" in window;
      const detector = hasBarcodeDetector
        ? new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector({ formats: ["qr_code"] })
        : null;

      const scanOnce = async () => {
        if (!scanningRef.current || !videoRef.current) return;
        const video = videoRef.current;
        try {
          if (detector) {
            const barcodes = await detector.detect(video);
            if (barcodes.length > 0) {
              await handleDecoded(barcodes[0].rawValue);
            }
          } else if (video.videoWidth > 0) {
            let canvas = canvasRef.current;
            if (!canvas) {
              canvas = document.createElement("canvas");
              canvasRef.current = canvas;
            }
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const result = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
              });
              if (result?.data) {
                await handleDecoded(result.data);
              }
            }
          }
        } catch { /* Scan-Fehler ignorieren */ }
      };

      const rafLoop = async () => {
        if (!scanningRef.current) return;
        await scanOnce();
        if (scanningRef.current) requestAnimationFrame(rafLoop);
      };
      requestAnimationFrame(rafLoop);

      // Fallback-Loop: requestAnimationFrame kann auf Safari stillschweigend anhalten
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = setInterval(() => { void scanOnce(); }, 500);
    } catch {
      setScanError("Kamera-Zugriff verweigert");
      stopScanner();
    }
  };

  const handleSubmit = async (teamId: string, daten: Record<string, unknown>) => {
    if (!game || !teamId) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/ergebnisse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, teamId, rohdaten: daten }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler");
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDuell = async (): Promise<boolean> => {
    if (!selectedTeamId || !selectedTeamId2) {
      setError("Beide Teams auswählen");
      return false;
    }
    const istKleinbegegnungen = game?.wertungslogik?.typ === "duell_kleinbegegnungen";
    if (istKleinbegegnungen && kleinbegegnungen.length === 0) {
      setError("Mindestens eine Kleinbegegnung erfassen");
      return false;
    }
    setSaving(true);
    setError(null);
    setConflict(null);
    setShowConflict(false);
    try {
      const res = await fetch("/api/ergebnisse/duell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: game!.id,
          teamAId: selectedTeamId,
          rohdatenA: istKleinbegegnungen ? { kleinbegegnungen } : rohdaten,
          teamBId: selectedTeamId2,
          rohdatenB: istKleinbegegnungen
            ? { kleinbegegnungen: spiegleKleinbegegnungen(kleinbegegnungen) }
            : rohdaten2,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409 && data.conflict) {
          setConflict(Array.isArray(data.existing) ? data.existing : []);
        }
        throw new Error(data.error || "Fehler");
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (game?.modus === "DUELL" && game.teamsProSlot >= 2) {
      const ok = await handleSaveDuell();
      if (ok) {
        setSuccess("Beide Ergebnisse gespeichert");
        setTimeout(() => {
          setSuccess(null);
          setRohdaten({});
          setRohdaten2({});
          setKleinbegegnungen([]);
          setSelectedTeamId("");
          setSelectedTeamId2("");
        }, 1500);
      }
    } else {
      // Solo
      if (!selectedTeamId) {
        setError("Team auswählen");
        return;
      }
      const ok = await handleSubmit(selectedTeamId, rohdaten);
      if (ok) {
        setSuccess("Ergebnis gespeichert");
        setTimeout(() => {
          setSuccess(null);
          setRohdaten({});
          setSelectedTeamId("");
        }, 1500);
      }
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex h-64 w-full max-w-md items-center justify-center text-sm text-ink-3">
        Lade...
      </div>
    );
  }
  if (error && !game) {
    return (
      <div className="mx-auto flex h-64 w-full max-w-md flex-col items-center justify-center gap-3">
        <p className="text-sm text-hot-tint">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="min-h-12 rounded-[9px] border border-line-strong px-4 text-sm font-medium text-ink-2 transition-colors duration-150 hover:border-action hover:text-ink"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }
  if (!game) {
    return (
      <div className="mx-auto w-full max-w-md py-12 text-center text-sm text-hot-tint">
        Game nicht gefunden
      </div>
    );
  }

  const wl = game.wertungslogik;
  const isDuell = game.modus === "DUELL" && game.teamsProSlot >= 2;

  const scanButtonClass = (aktiv: boolean) =>
    `shrink-0 min-h-12 rounded-[9px] border px-3 text-xs font-medium transition-colors duration-150 ${
      aktiv
        ? "border-action bg-action-dim text-action-tint"
        : "border-line-strong text-ink-2 hover:border-action hover:text-ink"
    }`;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-[18px] pb-12 lg:max-w-2xl">
      {/* Header */}
      <div>
        <Link
          href={`/referee/${slug}`}
          className="inline-flex items-center gap-1.5 text-[12px] text-ink-3 transition-colors duration-150 hover:text-ink"
        >
          <ArrowLeft size={13} weight="bold" />
          {game.name}
        </Link>
        <h1 className="mt-2.5 text-[22px] font-semibold tracking-tight">Ergebnis eintragen</h1>
        <p className="mt-1 text-[13px] text-ink-3">{game.name}</p>
      </div>

      {/* Team-Auswahl */}
      <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
        <div className={isDuell ? "grid grid-cols-1 gap-4 sm:grid-cols-2" : ""}>
          <div className="flex flex-col gap-1.5">
            <label className="cg-label text-label">{isDuell ? "Team A" : "Team"}</label>
            <div className="flex gap-2">
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className={selectClass}
              >
                <option value="">Team wählen...</option>
                {teams
                  .filter((t) => t.id !== selectedTeamId2)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      #{t.nummer} {t.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={() => (scanTarget === "A" ? stopScanner() : startScanner("A"))}
                className={scanButtonClass(scanTarget === "A")}
              >
                {scanTarget === "A" ? "Abbrechen" : "QR scannen"}
              </button>
            </div>
          </div>
          {isDuell && (
            <div className="flex flex-col gap-1.5">
              <label className="cg-label text-label">Team B</label>
              <div className="flex gap-2">
                <select
                  value={selectedTeamId2}
                  onChange={(e) => setSelectedTeamId2(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Team wählen...</option>
                  {teams
                    .filter((t) => t.id !== selectedTeamId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        #{t.nummer} {t.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => (scanTarget === "B" ? stopScanner() : startScanner("B"))}
                  className={scanButtonClass(scanTarget === "B")}
                >
                  {scanTarget === "B" ? "Abbrechen" : "QR scannen"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* QR-Scanner */}
        {scanTarget && (
          <div className="flex flex-col gap-2">
            <div className="relative overflow-hidden rounded-xl border border-line bg-black" style={{ aspectRatio: "4/3" }}>
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
              {scanning && (
                <div className="pointer-events-none absolute inset-0 rounded-xl border-2 border-warn/30">
                  <div className="absolute left-4 right-4 top-1/2 h-0.5 animate-pulse bg-warn/50" />
                </div>
              )}
            </div>
            <p className="text-center text-[12px] text-ink-3">
              Team-QR-Code auf dem Badge scannen{isDuell ? ` (Team ${scanTarget})` : ""}
            </p>
          </div>
        )}
        {scanError && <p className="text-center text-sm text-hot-tint">{scanError}</p>}
      </section>

      {/* Ergebnis-Formular */}
      {isDuell && wl?.typ === "duell_kleinbegegnungen" ? (
        /* Cornhole: EIN gemeinsamer Editor statt zwei getrennter Formulare */
        <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
          <h3 className="text-sm font-semibold text-ink">Kleinbegegnungen</h3>
          <KleinbegegnungenEditor
            kleinbegegnungen={kleinbegegnungen}
            onChange={setKleinbegegnungen}
            labelEigene={teams.find((t) => t.id === selectedTeamId)?.name ?? "Team A"}
            labelGegner={teams.find((t) => t.id === selectedTeamId2)?.name ?? "Team B"}
          />
        </section>
      ) : isDuell ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ErgebnisFormular
            label={teams.find((t) => t.id === selectedTeamId)?.name ?? "Team A"}
            wertungslogik={wl}
            rohdaten={rohdaten}
            onChange={setRohdaten}
            isDuellTeamA
          />
          <ErgebnisFormular
            label={teams.find((t) => t.id === selectedTeamId2)?.name ?? "Team B"}
            wertungslogik={wl}
            rohdaten={rohdaten2}
            onChange={setRohdaten2}
            isDuellTeamA={false}
          />
        </div>
      ) : (
        <ErgebnisFormular
          label="Ergebnis"
          wertungslogik={wl}
          rohdaten={rohdaten}
          onChange={setRohdaten}
        />
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !selectedTeamId}
          className="min-h-12 rounded-[9px] bg-action px-6 text-sm font-semibold text-on-action transition-colors duration-150 hover:bg-action-hover disabled:pointer-events-none disabled:opacity-50"
        >
          {saving ? "Speichert..." : "Ergebnis speichern"}
        </button>
        {success && <span className="text-sm text-done-tint">{success}</span>}
        {error && !conflict && <span className="text-sm text-hot-tint">{error}</span>}
      </div>

      {conflict && (
        <section className="flex flex-col gap-3 rounded-xl border border-[var(--warn-border)] bg-warn-dim/60 p-4">
          <div className="flex items-start gap-2.5">
            <Warning size={18} weight="bold" className="mt-0.5 shrink-0 text-warn" />
            <div>
              <p className="text-sm font-semibold text-ink">{error}</p>
              <p className="mt-1 text-[12px] leading-[1.45] text-ink-2">
                Deine Eingabe wurde nicht gespeichert. Es besteht bereits ein Ergebnis für dieses Match.
              </p>
            </div>
          </div>

          {conflict.length > 0 && showConflict && (
            <div className="flex flex-col gap-2 border-t border-[var(--warn-border)] pt-3">
              {conflict.map((c) => (
                <div key={c.id} className="rounded-[9px] bg-surface p-3 text-xs text-ink-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink">
                      {c.team ? `#${c.team.nummer} ${c.team.name}` : "Team"}
                    </span>
                    <span className="tnum text-ink-3">
                      {c.gamePunkte} Punkte · {c.status}
                    </span>
                  </div>
                  <p className="mt-1 text-ink-3">
                    Eingetragen von {c.eingetragenVon?.name ?? "unbekannt"}
                    {c.eingetragenUm ? ` am ${new Date(c.eingetragenUm).toLocaleString("de-DE")}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            {conflict.length > 0 && (
              <button
                onClick={() => setShowConflict((v) => !v)}
                className="min-h-12 rounded-[9px] border border-[var(--warn-border)] px-4 text-xs font-medium text-warn transition-colors duration-150 hover:bg-warn-dim"
              >
                {showConflict ? "Ausblenden" : "Vorhandenes Ergebnis anzeigen"}
              </button>
            )}
            <Link
              href={`/referee/${slug}/live`}
              className="inline-flex min-h-12 items-center rounded-[9px] border border-line-strong px-4 text-xs font-medium text-ink-2 transition-colors duration-150 hover:border-action hover:text-ink"
            >
              Zu den Ergebnissen
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
