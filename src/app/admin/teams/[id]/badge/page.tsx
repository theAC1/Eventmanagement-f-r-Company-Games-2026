"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Team = {
  id: string; name: string; nummer: number; farbe: string;
  logoUrl: string | null; motto: string | null;
  qrToken: string; checkinCode: string;
};

function qrUrl(data: string, size = 250) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&format=png&margin=1`;
}

export default function BadgePage() {
  const params = useParams();
  const teamId = params.id as string;
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [printAll, setPrintAll] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/teams/${teamId}`).then(r => r.json()),
      fetch("/api/teams").then(r => r.json()),
    ]).then(([t, all]) => {
      setTeam(t);
      setAllTeams(all);
      setLoading(false);
    });
  }, [teamId]);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow || !badgeRef.current) return;
    printWindow.document.write(`
      <html><head><title>Badge – ${team?.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
        @page { size: 100mm 140mm; margin: 0; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style></head><body>
      ${badgeRef.current.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const handleExportPng = () => {
    if (!badgeRef.current) return;
    // Canvas-basierter Export
    const el = badgeRef.current;
    import(/* webpackIgnore: true */ "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js" as string)
      .then(mod => mod.default(el, { scale: 3, useCORS: true, allowTaint: true }))
      .then((canvas: HTMLCanvasElement) => {
        const link = document.createElement("a");
        link.download = `badge-${team?.name?.toLowerCase().replace(/\s+/g, "-")}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      })
      .catch(() => handlePrint());
  };

  if (loading || !team) return <div className="flex items-center justify-center h-64 text-zinc-500">Lade...</div>;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const portalUrl = `${origin}/team/${team.qrToken}`;
  const checkinUrl = `${origin}/api/checkin?code=${team.checkinCode}`;

  const teamsToPrint = printAll ? allTeams : [team];

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
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input type="checkbox" checked={printAll} onChange={e => setPrintAll(e.target.checked)}
              className="rounded" />
            Alle Teams
          </label>
          <button onClick={handleExportPng}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition">
            PNG Export
          </button>
          <button onClick={handlePrint}
            className="px-4 py-2 border border-zinc-700 text-sm rounded-lg hover:bg-zinc-800 transition">
            Drucken
          </button>
        </div>
      </div>

      {/* Badge Preview(s) */}
      <div ref={badgeRef} className="flex flex-wrap justify-center gap-8">
        {teamsToPrint.map(t => (
          <BadgeCard key={t.id} team={t} portalUrl={`${origin}/team/${t.qrToken}`}
            checkinUrl={`${origin}/checkin/${t.checkinCode}`} />
        ))}
      </div>
    </div>
  );
}

function BadgeCard({ team, portalUrl, checkinUrl }: {
  team: { id: string; name: string; nummer: number; farbe: string; logoUrl: string | null; motto: string | null; checkinCode: string; qrToken: string };
  portalUrl: string; checkinUrl: string;
}) {
  return (
    <div style={{ width: "380px", backgroundColor: "#0a0a0a", borderRadius: "16px", overflow: "hidden", pageBreakInside: "avoid" }}>
      {/* Farb-Header */}
      <div style={{ height: "6px", backgroundColor: team.farbe }} />

      <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Team-Info */}
        <div style={{ textAlign: "center" }}>
          {team.logoUrl ? (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
              <img src={team.logoUrl} alt={team.name} style={{ width: "56px", height: "56px", objectFit: "contain" }}
                crossOrigin="anonymous" />
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%", backgroundColor: team.farbe,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "24px", fontWeight: "bold", color: "white",
              }}>{team.nummer}</div>
            </div>
          )}
          <div style={{ fontSize: "22px", fontWeight: "bold", color: "white" }}>{team.name}</div>
          <div style={{ fontSize: "14px", color: "#71717a" }}>#{team.nummer}</div>
          {team.motto && <div style={{ fontSize: "12px", color: "#52525b", fontStyle: "italic", marginTop: "4px" }}>{team.motto}</div>}
        </div>

        {/* Zwei QR-Codes nebeneinander */}
        <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
          {/* QR 1: Team-Portal */}
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{
              backgroundColor: "white", borderRadius: "10px", padding: "8px",
              display: "inline-block",
            }}>
              <img src={qrUrl(portalUrl, 140)} alt="Portal QR" style={{ width: "120px", height: "120px" }}
                crossOrigin="anonymous" />
            </div>
            <div style={{
              marginTop: "6px", fontSize: "10px", fontWeight: "600", color: "#22c55e",
              textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              Team-Portal
            </div>
            <div style={{ fontSize: "9px", color: "#52525b" }}>Zeitplan &middot; Punkte &middot; Lageplan</div>
          </div>

          {/* QR 2: Check-in (Schiedsrichter) */}
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{
              backgroundColor: "white", borderRadius: "10px", padding: "8px",
              display: "inline-block",
            }}>
              <img src={qrUrl(checkinUrl, 140)} alt="Check-in QR" style={{ width: "120px", height: "120px" }}
                crossOrigin="anonymous" />
            </div>
            <div style={{
              marginTop: "6px", fontSize: "10px", fontWeight: "600", color: "#f59e0b",
              textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              Check-in
            </div>
            <div style={{ fontSize: "9px", color: "#52525b" }}>Schiedsrichter scannt</div>
          </div>
        </div>

        {/* Backup-Token */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            display: "inline-block", backgroundColor: "#18181b", border: "1px solid #27272a",
            borderRadius: "8px", padding: "6px 20px",
          }}>
            <div style={{ fontSize: "9px", color: "#52525b", marginBottom: "2px" }}>BACKUP CODE</div>
            <div style={{
              fontSize: "28px", fontWeight: "bold", color: "white", fontFamily: "monospace",
              letterSpacing: "0.2em",
            }}>
              {team.checkinCode || "---"}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: "center", paddingTop: "8px", borderTop: "1px solid #27272a",
          fontSize: "10px", color: "#52525b", fontWeight: "600",
          textTransform: "uppercase", letterSpacing: "0.1em",
        }}>
          Company Games 2026
        </div>
      </div>
    </div>
  );
}
