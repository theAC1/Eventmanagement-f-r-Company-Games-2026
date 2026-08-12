"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { TopBar, TopBarSpacer } from "@/components/ui/top-bar";
import { Button } from "@/components/ui/button";

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

  if (loading || !team) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink-3">
        Lade...
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const teamsToPrint = printAll ? allTeams : [team];

  return (
    <div className="flex flex-col">
      <TopBar
        title={
          <span className="flex items-center gap-2.5">
            <Link
              href={`/admin/teams/${team.id}`}
              aria-label={`Zurück zu ${team.name}`}
              className="text-faint transition-colors duration-150 hover:text-ink"
            >
              <ArrowLeft size={18} weight="bold" />
            </Link>
            Badge
          </span>
        }
      >
        <span className="text-xs text-ink-3">{team.name}</span>
        <TopBarSpacer />
        <label className="flex items-center gap-2 text-xs font-medium text-ink-3">
          <input
            type="checkbox"
            checked={printAll}
            onChange={e => setPrintAll(e.target.checked)}
            className="h-4 w-4 rounded border-line-key accent-[var(--action)]"
          />
          Alle Teams
        </label>
        <Button variant="primary" onClick={handleExportPng}>
          PNG Export
        </Button>
        <Button variant="ghost" onClick={handlePrint}>
          Drucken
        </Button>
      </TopBar>

      {/* Badge Preview(s) — Badges bleiben bewusst dunkel (Druckvorlage) */}
      <div className="px-4 py-6 sm:px-[22px]">
        <div ref={badgeRef} className="flex flex-wrap justify-center gap-8">
          {teamsToPrint.map(t => (
            <BadgeCard key={t.id} team={t} portalUrl={`${origin}/team/${t.qrToken}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BadgeCard({ team, portalUrl }: {
  team: { id: string; name: string; nummer: number; farbe: string; logoUrl: string | null; motto: string | null; checkinCode: string; qrToken: string };
  portalUrl: string;
}) {
  return (
    <div style={{ width: "380px", backgroundColor: "#0A111C", borderRadius: "16px", overflow: "hidden", pageBreakInside: "avoid" }}>
      {/* Farb-Header */}
      <div style={{ height: "6px", backgroundColor: team.farbe }} />

      <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Team-Info */}
        <div style={{ textAlign: "center" }}>
          {team.logoUrl ? (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Badge wird per Canvas gerendert, next/image liefert kein <img> mit crossOrigin */}
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
          <div style={{ fontSize: "14px", color: "#8598B4" }}>#{team.nummer}</div>
          {team.motto && <div style={{ fontSize: "12px", color: "#7C90AE", fontStyle: "italic", marginTop: "4px" }}>{team.motto}</div>}
        </div>

        {/* Einziger QR-Code: Team-Portal (Schiri-Scanner erkennt ihn auch beim Check-in) */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            backgroundColor: "white", borderRadius: "12px", padding: "12px",
            display: "inline-block",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- extern erzeugter QR-Code, wird für den Druck als Canvas gebraucht */}
            <img src={qrUrl(portalUrl, 200)} alt="Team QR" style={{ width: "180px", height: "180px" }}
              crossOrigin="anonymous" />
          </div>
          <div style={{
            marginTop: "8px", fontSize: "11px", fontWeight: "600", color: "#34C77B",
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            Team-QR scannen
          </div>
          <div style={{ fontSize: "9px", color: "#7C90AE" }}>Zeitplan &middot; Punkte &middot; Lageplan &middot; Check-in</div>
        </div>

        {/* Backup-Token (manuelle Eingabe durch Schiedsrichter) */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            display: "inline-block", backgroundColor: "#101B2B", border: "1px solid #1D2C44",
            borderRadius: "8px", padding: "6px 20px",
          }}>
            <div style={{ fontSize: "9px", color: "#7C90AE", marginBottom: "2px" }}>BACKUP CODE</div>
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
          textAlign: "center", paddingTop: "8px", borderTop: "1px solid #1D2C44",
          fontSize: "10px", color: "#7C90AE", fontWeight: "600",
          textTransform: "uppercase", letterSpacing: "0.1em",
        }}>
          Company Games 2026
        </div>
      </div>
    </div>
  );
}
