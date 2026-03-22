"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Game = { id: string; name: string; slug: string; modus: string; teamsProSlot: number };
type CheckedInTeam = { teamId: string; teamName: string; teamNummer: number; teamFarbe: string };

export default function CheckinPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"scan" | "code">("code");
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState<CheckedInTeam[]>([]);
  const [scanning, setScanning] = useState(false);
  const scanningRef = useRef(false); // Fix: useRef statt Closure für requestAnimationFrame
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const isDuell = game?.modus === "DUELL" && (game?.teamsProSlot ?? 1) >= 2;
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

    // Check ob Team schon eingecheckt
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkinCode: trimmed }),
    });

    if (!res.ok) {
      setError("Ungültiger Code");
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
      body: JSON.stringify({ qrToken: token }),
    });

    if (!res.ok) { setError("Ungültiger QR-Code"); return; }
    const data = await res.json();

    if (checkedIn.find(t => t.teamId === data.teamId)) { return; } // Already checked in

    setCheckedIn(prev => [...prev, {
      teamId: data.teamId,
      teamName: data.teamName,
      teamNummer: data.teamNummer,
      teamFarbe: data.teamFarbe,
    }]);
  };

  // QR-Scanner via Kamera (Fix: useRef für Loop-Control)
  const startScanner = async () => {
    scanningRef.current = true;
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        if ("BarcodeDetector" in window) {
          const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
          const scanLoop = async () => {
            if (!scanningRef.current || !videoRef.current) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const url = barcodes[0].rawValue;
                const checkinMatch = url.match(/checkin\/([A-Z0-9]{3})/i);
                const tokenMatch = url.match(/team\/([a-z0-9]+)/i);
                if (checkinMatch) {
                  await verifyCode(checkinMatch[1]);
                } else if (tokenMatch) {
                  await verifyQrToken(tokenMatch[1]);
                }
              }
            } catch { /* ignore scan errors */ }
            if (scanningRef.current) requestAnimationFrame(scanLoop);
          };
          requestAnimationFrame(scanLoop);
        }
      }
    } catch {
      setError("Kamera-Zugriff verweigert");
      scanningRef.current = false;
      setScanning(false);
    }
  };

  const stopScanner = () => {
    scanningRef.current = false;
    setScanning(false);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  const removeTeam = (teamId: string) => {
    setCheckedIn(prev => prev.filter(t => t.teamId !== teamId));
  };

  const proceedToEingabe = () => {
    // Zum Eingabe-Formular mit vorausgewählten Teams
    const teamIds = checkedIn.map(t => t.teamId).join(",");
    router.push(`/referee/${slug}/eingabe?teams=${teamIds}`);
  };

  if (loading || !game) return <div className="flex items-center justify-center h-64 text-zinc-500">Lade...</div>;

  return (
    <div className="space-y-6 pb-12">
      <div>
        <Link href={`/referee/${slug}`} className="text-xs text-zinc-500 hover:text-white transition">
          &larr; {game.name}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mt-2">Check-in</h1>
        <p className="text-sm text-zinc-400">
          {isDuell ? "2 Teams einchecken" : "Team einchecken"} &middot; {game.name}
        </p>
      </div>

      {/* Eingecheckte Teams */}
      <div className="space-y-2">
        {Array.from({ length: maxTeams }, (_, i) => {
          const t = checkedIn[i];
          return (
            <div key={i} className={`flex items-center justify-between p-4 rounded-lg border ${
              t ? "border-emerald-800 bg-emerald-950/20" : "border-zinc-800 border-dashed"
            }`}>
              {t ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white"
                      style={{ backgroundColor: t.teamFarbe }}>
                      {t.teamNummer}
                    </div>
                    <div>
                      <p className="font-medium">{t.teamName}</p>
                      <p className="text-xs text-emerald-400">Eingecheckt</p>
                    </div>
                  </div>
                  <button onClick={() => removeTeam(t.teamId)}
                    className="text-xs text-zinc-500 hover:text-red-400 transition">
                    Entfernen
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-3 text-zinc-500">
                  <div className="w-10 h-10 rounded-full border border-dashed border-zinc-700 flex items-center justify-center text-lg">?</div>
                  <p className="text-sm">{isDuell ? `Team ${i === 0 ? "A" : "B"}` : "Team"} – noch nicht eingecheckt</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Check-in Methode */}
      {!allCheckedIn && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => { setMode("code"); stopScanner(); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                mode === "code" ? "bg-zinc-800 border-zinc-600 text-white" : "border-zinc-800 text-zinc-500"
              }`}>
              Code eingeben
            </button>
            <button onClick={() => { setMode("scan"); startScanner(); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                mode === "scan" ? "bg-zinc-800 border-zinc-600 text-white" : "border-zinc-800 text-zinc-500"
              }`}>
              QR scannen
            </button>
          </div>

          {/* Code-Eingabe */}
          {mode === "code" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  ref={codeInputRef}
                  type="text"
                  value={codeInput}
                  onChange={e => setCodeInput(e.target.value.toUpperCase().slice(0, 3))}
                  onKeyDown={e => { if (e.key === "Enter") verifyCode(codeInput); }}
                  placeholder="z.B. B6J"
                  maxLength={3}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-2xl font-mono text-center tracking-[0.3em] uppercase focus:outline-none focus:border-zinc-500"
                />
                <button onClick={() => verifyCode(codeInput)}
                  disabled={codeInput.length !== 3}
                  className="px-6 py-3 bg-white text-black font-medium rounded-lg hover:bg-zinc-200 transition disabled:opacity-50">
                  OK
                </button>
              </div>
              <p className="text-xs text-zinc-600 text-center">
                3-Zeichen Code vom Badge (unter dem QR-Code)
              </p>
            </div>
          )}

          {/* QR-Scanner */}
          {mode === "scan" && (
            <div className="space-y-3">
              <div className="relative rounded-lg overflow-hidden bg-black" style={{ aspectRatio: "4/3" }}>
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                {!scanning && (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
                    <button onClick={startScanner}
                      className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium">
                      Kamera starten
                    </button>
                  </div>
                )}
                {scanning && (
                  <div className="absolute inset-0 border-2 border-amber-500/30 rounded-lg pointer-events-none">
                    <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-amber-500/50 animate-pulse" />
                  </div>
                )}
              </div>
              <p className="text-xs text-zinc-600 text-center">
                Check-in QR-Code (gelb) auf dem Badge scannen
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        </div>
      )}

      {/* Weiter zur Ergebnis-Eingabe */}
      {allCheckedIn && (
        <button onClick={proceedToEingabe}
          className="w-full py-4 bg-emerald-600 text-white text-lg font-semibold rounded-lg hover:bg-emerald-500 transition">
          Begegnung starten &rarr;
        </button>
      )}
    </div>
  );
}
