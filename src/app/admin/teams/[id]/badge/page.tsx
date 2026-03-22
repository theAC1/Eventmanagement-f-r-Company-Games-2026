"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Team = {
  id: string; name: string; nummer: number; farbe: string;
  logoUrl: string | null; motto: string | null; qrToken: string;
  captainName: string | null;
};

export default function BadgePage() {
  const params = useParams();
  const teamId = params.id as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrSvg, setQrSvg] = useState<string>("");
  const badgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/teams/${teamId}`)
      .then(r => r.json())
      .then(async (t) => {
        setTeam(t);
        // QR-Code als SVG generieren (via API oder Client-side)
        const portalUrl = `${window.location.origin}/team/${t.qrToken}`;
        // Einfacher QR-Code via Google Charts API (Fallback)
        setQrSvg(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(portalUrl)}&format=svg`);
        setLoading(false);
      });
  }, [teamId]);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = async () => {
    if (!badgeRef.current) return;
    try {
      const mod = await import(/* webpackIgnore: true */ "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js" as string);
      const html2canvas = mod.default;
      const canvas = await html2canvas(badgeRef.current, { scale: 3, useCORS: true });
      const link = document.createElement("a");
      link.download = `badge-${team?.name?.toLowerCase().replace(/\s+/g, "-") ?? "team"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      handlePrint();
    }
  };

  if (loading || !team) return <div className="flex items-center justify-center h-64 text-zinc-500">Lade...</div>;

  const portalUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/team/${team.qrToken}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Link href="/admin/teams" className="hover:text-white transition">Teams</Link>
          <span>/</span>
          <Link href={`/admin/teams/${team.id}`} className="hover:text-white transition">{team.name}</Link>
          <span>/</span>
          <span className="text-white">Badge</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition">
            Als PNG exportieren
          </button>
          <button onClick={handlePrint}
            className="px-4 py-2 border border-zinc-700 text-sm rounded-lg hover:bg-zinc-800 transition">
            Drucken
          </button>
        </div>
      </div>

      {/* Badge Preview */}
      <div className="flex justify-center">
        <div ref={badgeRef}
          className="w-[400px] rounded-2xl overflow-hidden shadow-2xl"
          style={{ backgroundColor: "#111" }}>

          {/* Farb-Header */}
          <div className="h-3" style={{ backgroundColor: team.farbe }} />

          <div className="p-8 space-y-6">
            {/* Team-Info */}
            <div className="text-center space-y-2">
              {team.logoUrl && (
                <div className="flex justify-center mb-4">
                  <img src={team.logoUrl} alt={team.name} className="w-20 h-20 object-contain" />
                </div>
              )}
              {!team.logoUrl && (
                <div className="flex justify-center mb-4">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white"
                    style={{ backgroundColor: team.farbe }}>
                    {team.nummer}
                  </div>
                </div>
              )}
              <h2 className="text-2xl font-bold text-white">{team.name}</h2>
              <p className="text-lg text-zinc-400">#{team.nummer}</p>
              {team.motto && (
                <p className="text-sm text-zinc-500 italic">{team.motto}</p>
              )}
            </div>

            {/* QR-Code */}
            <div className="flex justify-center">
              <div className="bg-white rounded-xl p-4">
                <img
                  src={qrSvg}
                  alt="QR Code"
                  className="w-48 h-48"
                  crossOrigin="anonymous"
                />
              </div>
            </div>

            {/* Scan-Hinweis */}
            <div className="text-center space-y-1">
              <p className="text-xs text-zinc-400">
                QR-Code scannen für Team-Portal
              </p>
              <p className="text-[10px] text-zinc-600 font-mono break-all">
                {portalUrl}
              </p>
            </div>

            {/* Footer */}
            <div className="text-center pt-2 border-t border-zinc-800">
              <p className="text-xs text-zinc-500 font-semibold tracking-wider uppercase">
                Company Games 2026
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Print Stylesheet */}
      <style jsx global>{`
        @media print {
          body > *:not(.print-badge) { display: none !important; }
          header, nav, footer { display: none !important; }
          @page { margin: 0; size: 100mm 140mm; }
        }
      `}</style>
    </div>
  );
}
