"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import jsQR from "jsqr";
import { ArrowLeft, CheckCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

type Game = { id: string; name: string; slug: string; modus: string; teamsProSlot: number };
type CheckedInTeam = { teamId: string; teamName: string; teamNummer: number; teamFarbe: string };

export default function CheckinPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const slotId = searchParams.get("slotId") ?? undefined;
  const slotTeamIds = (searchParams.get("teams") ?? "").split(",").filter(Boolean);

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [mode, setMode] = useState<"scan" | "code">("code");
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState<CheckedInTeam[]>([]);
  const [scanning, setScanning] = useState(false);
  const scanningRef = useRef(false); // Fix: useRef statt Closure für requestAnimationFrame
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const isDuell =
    slotTeamIds.length >= 2 ||
    (game?.modus === "DUELL" && (game?.teamsProSlot ?? 1) >= 2);
  const maxTeams = isDuell ? 2 : 1;
  const allCheckedIn = checkedIn.length >= maxTeams;

  useEffect(() => {
    fetch(`/api/games/by-slug/${slug}`)
      .then(r => r.json())
      .then(g => { setGame(g); setLoading(false); });
  }, [slug]);

  // Cleanup: Kamera stoppen bei Unmount
  useEffect(() => {
    return () => {
      scanningRef.current = false;
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Auto-focus code input
  useEffect(() => {
    if (mode === "code") codeInputRef.current?.focus();
  }, [mode, checkedIn]);

  const verifyCode = async (code: string) => {
    setError(null);
    const trimmed = code.toUpperCase().trim();
    if (trimmed.length !== 3) { setError("Code muss 3 Zeichen haben"); return; }

    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkinCode: trimmed, ...(slotId ? { slotId } : {}) }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Ungültiger Code");
      return;
    }

    const data = await res.json();

    if (checkedIn.find(t => t.teamId === data.teamId)) {
      setError(`${data.teamName} ist bereits eingecheckt`);
      return;
    }

    setCheckedIn(prev => [...prev, {
      teamId: data.teamId,
      teamName: data.teamName,
      teamNummer: data.teamNummer,
      teamFarbe: data.teamFarbe,
    }]);
    setCodeInput("");
  };

  const verifyQrToken = async (token: string) => {
    setError(null);
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrToken: token, ...(slotId ? { slotId } : {}) }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Ungültiger QR-Code");
      return;
    }
    const data = await res.json();

    if (checkedIn.find(t => t.teamId === data.teamId)) { return; } // Already checked in

    setCheckedIn(prev => [...prev, {
      teamId: data.teamId,
      teamName: data.teamName,
      teamNummer: data.teamNummer,
      teamFarbe: data.teamFarbe,
    }]);
  };

  // Decodierten QR-Wert verarbeiten (URL kann Portal- oder Check-in-Code sein)
  const handleDecoded = async (raw: string) => {
    const checkinMatch = raw.match(/checkin\/([A-Z0-9]{3})/i);
    const tokenMatch = raw.match(/team\/([a-z0-9]+)/i);
    if (checkinMatch) {
      await verifyCode(checkinMatch[1]);
    } else if (tokenMatch) {
      await verifyQrToken(tokenMatch[1]);
    }
  };

  // QR-Scanner via Kamera – BarcodeDetector wenn verfügbar, sonst jsQR-Fallback (iOS Safari)
  const startScanner = async () => {
    scanningRef.current = true;
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const hasBarcodeDetector = "BarcodeDetector" in window;
      const detector = hasBarcodeDetector
        ? new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector({ formats: ["qr_code"] })
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
            // jsQR-Fallback: Frame in Canvas zeichnen und dekodieren
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
        } catch { /* ignore scan errors */ }
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
      setError("Kamera-Zugriff verweigert");
      scanningRef.current = false;
      setScanning(false);
    }
  };

  const stopScanner = () => {
    scanningRef.current = false;
    setScanning(false);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  const removeTeam = (teamId: string) => {
    setCheckedIn(prev => prev.filter(t => t.teamId !== teamId));
  };

  const startPartie = async () => {
    if (!game) return;
    setStarting(true);
    setError(null);

    try {
      const teamIds = checkedIn.map((t) => t.teamId);
      const res = await fetch("/api/partie/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: game.id,
          teamIds,
          zeitplanSlotId: slotId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Partie konnte nicht gestartet werden");
      }

      const ergebnisse: { id: string }[] = await res.json();
      const ergebnisIds = ergebnisse.map((e) => e.id).join(",");

      const urlParams = new URLSearchParams();
      urlParams.set("ergebnisIds", ergebnisIds);
      if (slotId) urlParams.set("slotId", slotId);

      router.push(`/referee/${slug}/live?${urlParams.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Starten");
      setStarting(false);
    }
  };

  if (loading || !game) {
    return (
      <div className="mx-auto flex h-64 w-full max-w-md items-center justify-center text-sm text-ink-3">
        Lade...
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-[18px] pb-12">
      {/* Header */}
      <div>
        <Link
          href={`/referee/${slug}`}
          className="inline-flex items-center gap-1.5 text-[12px] text-ink-3 transition-colors duration-150 hover:text-ink"
        >
          <ArrowLeft size={13} weight="bold" />
          {game.name}
        </Link>
        <h1 className="mt-2.5 text-[22px] font-semibold tracking-tight">Check-in</h1>
        <p className="mt-1 text-[13px] text-ink-3">
          {isDuell ? "2 Teams einchecken" : "Team einchecken"} · {game.name}
        </p>
      </div>

      {/* Fortschritt bei Duell-Slots */}
      {isDuell && (
        <div className="flex items-center gap-2 text-[13px]">
          <span className={checkedIn.length >= 1 ? "text-done-tint" : "text-ink-3"}>
            {checkedIn[0] ? `${checkedIn[0].teamName} ✓` : "Team A ausstehend"}
          </span>
          <span className="text-faint">—</span>
          <span className={checkedIn.length >= 2 ? "text-done-tint" : "text-ink-3"}>
            {checkedIn[1] ? `${checkedIn[1].teamName} ✓` : "Team B ausstehend"}
          </span>
          <span className="tnum ml-auto text-[11px] text-label">
            {checkedIn.length}/2
          </span>
        </div>
      )}

      {/* Eingecheckte Teams */}
      <div className="flex flex-col gap-2">
        {Array.from({ length: maxTeams }, (_, i) => {
          const t = checkedIn[i];
          return (
            <div
              key={i}
              className={`flex items-center justify-between rounded-xl border p-4 ${
                t
                  ? "border-[1.5px] border-done bg-done-dim/50"
                  : "border-dashed border-line-strong"
              }`}
            >
              {t ? (
                <>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-white"
                      style={{ backgroundColor: t.teamFarbe }}
                    >
                      {t.teamNummer}
                    </div>
                    <div>
                      <p className="font-medium text-ink">{t.teamName}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[12px] text-done-tint">
                        <CheckCircle size={13} weight="bold" />
                        Eingecheckt
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeTeam(t.teamId)}
                    className="min-h-12 px-2 text-[12px] text-ink-3 transition-colors duration-150 hover:text-hot-tint"
                  >
                    Entfernen
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-3 text-ink-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-line-strong text-lg">
                    ?
                  </div>
                  <p className="text-sm">
                    {isDuell ? `Team ${i === 0 ? "A" : "B"}` : "Team"} – noch nicht eingecheckt
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Check-in Methode */}
      {!allCheckedIn && (
        <div className="flex flex-col gap-4">
          {/* Segmented Control */}
          <div className="flex rounded-[9px] border border-line-strong bg-sunken p-0.5">
            <button
              onClick={() => { setMode("code"); stopScanner(); }}
              className={`min-h-12 flex-1 rounded-[7px] px-3 text-sm transition-colors duration-150 ${
                mode === "code"
                  ? "bg-action font-semibold text-on-action"
                  : "font-medium text-ink-3"
              }`}
            >
              Code eingeben
            </button>
            <button
              onClick={() => { setMode("scan"); startScanner(); }}
              className={`min-h-12 flex-1 rounded-[7px] px-3 text-sm transition-colors duration-150 ${
                mode === "scan"
                  ? "bg-action font-semibold text-on-action"
                  : "font-medium text-ink-3"
              }`}
            >
              QR scannen
            </button>
          </div>

          {/* Code-Eingabe */}
          {mode === "code" && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  ref={codeInputRef}
                  type="text"
                  value={codeInput}
                  onChange={e => setCodeInput(e.target.value.toUpperCase().slice(0, 3))}
                  onKeyDown={e => { if (e.key === "Enter") verifyCode(codeInput); }}
                  placeholder="z.B. B6J"
                  maxLength={3}
                  className="tnum min-w-0 flex-1 rounded-[9px] border border-line-strong bg-sunken px-4 py-3 text-center text-2xl uppercase tracking-[0.3em] text-ink placeholder:text-faint focus:border-action focus:outline-none"
                />
                <Button
                  variant="primary"
                  onClick={() => verifyCode(codeInput)}
                  disabled={codeInput.length !== 3}
                  className="h-auto min-h-12 px-6"
                >
                  OK
                </Button>
              </div>
              <p className="text-center text-[12px] text-ink-3">
                3-Zeichen Code vom Badge (unter dem QR-Code)
              </p>
            </div>
          )}

          {/* QR-Scanner */}
          {mode === "scan" && (
            <div className="flex flex-col gap-3">
              <div className="relative overflow-hidden rounded-xl border border-line bg-black" style={{ aspectRatio: "4/3" }}>
                <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                {!scanning && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: "var(--scrim)" }}>
                    <Button variant="primary" onClick={startScanner} className="h-auto min-h-12 px-5">
                      Kamera starten
                    </Button>
                  </div>
                )}
                {scanning && (
                  <div className="pointer-events-none absolute inset-0 rounded-xl border-2 border-warn/30">
                    <div className="absolute left-4 right-4 top-1/2 h-0.5 animate-pulse bg-warn/50" />
                  </div>
                )}
              </div>
              <p className="text-center text-[12px] text-ink-3">
                Team-QR-Code auf dem Badge scannen
              </p>
            </div>
          )}

          {error && <p className="text-center text-sm text-hot-tint">{error}</p>}
        </div>
      )}

      {/* Partie starten */}
      {allCheckedIn && (
        <Button
          variant="cta"
          onClick={startPartie}
          disabled={starting}
          className="h-16 w-full rounded-[14px]"
        >
          {starting ? "Wird gestartet..." : "Begegnung starten →"}
        </Button>
      )}
    </div>
  );
}
