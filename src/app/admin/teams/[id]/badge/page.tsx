"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, WarningCircle } from "@phosphor-icons/react";
import { TopBar, TopBarSpacer } from "@/components/ui/top-bar";
import { Button } from "@/components/ui/button";
import { generateQrDataUrl } from "@/lib/qr";

type Team = {
  id: string; name: string; nummer: number; farbe: string;
  logoUrl: string | null; motto: string | null;
  qrToken: string; checkinCode: string;
};

export default function BadgePage() {
  const params = useParams();
  const teamId = params.id as string;
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [printAll, setPrintAll] = useState(false);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [qrGenerating, setQrGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/teams/${teamId}`).then(r => r.json()),
      // /api/teams/badges statt /api/teams: Die öffentliche Team-Liste hat
      // qrToken/checkinCode aus Sicherheitsgründen entfernt — für den
      // Badge-Druck ("Alle Teams") braucht es aber genau diese Felder.
      fetch("/api/teams/badges").then(r => r.json()),
    ])
      .then(([t, all]) => {
        if (t?.error) throw new Error(t.error);
        setTeam(t);
        setAllTeams(Array.isArray(all) ? all : []);
      })
      .catch(error => {
        console.error("Badge-Daten laden fehlgeschlagen:", error);
        setLoadError("Team-Daten konnten nicht geladen werden.");
      })
      .finally(() => setLoading(false));
  }, [teamId]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const teamsToPrint = printAll ? allTeams : team ? [team] : [];
  const teamsKey = teamsToPrint.map(t => t.id).join(",");

  // QR-Codes lokal generieren, sobald feststeht, welche Teams angezeigt
  // werden — als Data-URI statt externem Dienst (api.qrserver.com): sofort
  // verfügbar, offline-fest und beim PNG-Export nie durch CORS blockiert.
  useEffect(() => {
    if (teamsToPrint.length === 0) return;
    const missing = teamsToPrint.filter(t => !qrCodes[t.id]);
    if (missing.length === 0) return;

    let cancelled = false;
    setQrGenerating(true);
    Promise.all(
      missing.map(async t => {
        const portalUrl = `${origin}/team/${t.qrToken}`;
        const dataUrl = await generateQrDataUrl(portalUrl, 200);
        return [t.id, dataUrl] as const;
      }),
    )
      .then(entries => {
        if (cancelled) return;
        setQrCodes(prev => ({ ...prev, ...Object.fromEntries(entries) }));
      })
      .catch(error => {
        console.error("QR-Code-Generierung fehlgeschlagen:", error);
        if (!cancelled) setExportError("QR-Codes konnten nicht erzeugt werden.");
      })
      .finally(() => {
        if (!cancelled) setQrGenerating(false);
      });

    return () => {
      cancelled = true;
    };
    // teamsKey fasst zusammen, WELCHE Teams betroffen sind — reicht als Dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamsKey, origin]);

  const allQrReady = teamsToPrint.length > 0 && teamsToPrint.every(t => qrCodes[t.id]);

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
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleExportPng = async () => {
    if (!badgeRef.current || !allQrReady || exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      // Regulärer Bundle-Import statt CDN-Runtime-Import: Der Export darf
      // nicht mehr davon abhängen, dass jsdelivr.net im Moment des Drucks
      // erreichbar ist (Event-WLAN, Firmenproxy, ...).
      const { default: html2canvas } = await import("html2canvas");
      // Bei "Alle Teams" kann die Karte aus vielen Badges sehr gross werden —
      // scale 2 statt 3 hält den Canvas auch bei z.B. 30+ Teams schnell und
      // den Download handlich. Einzelbadge bleibt auf 3 für beste Druckqualität.
      const canvas = await html2canvas(badgeRef.current, {
        scale: printAll ? 2 : 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
      });
      const link = document.createElement("a");
      const filename = printAll
        ? "badges-alle-teams"
        : `badge-${team?.name?.toLowerCase().replace(/\s+/g, "-") ?? "team"}`;
      link.download = `${filename}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("PNG-Export fehlgeschlagen:", error);
      setExportError(
        "PNG-Export fehlgeschlagen. Bitte stattdessen „Drucken“ verwenden (im Druckdialog als PDF speicherbar).",
      );
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink-3">
        Lade...
      </div>
    );
  }

  if (loadError || !team) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-ink-3">
        <WarningCircle size={20} weight="bold" className="text-red-500" />
        {loadError ?? "Team nicht gefunden."}
      </div>
    );
  }

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
        <Button variant="primary" onClick={handleExportPng} disabled={!allQrReady || exporting}>
          {exporting ? "Exportiere…" : qrGenerating ? "QR-Codes…" : "PNG Export"}
        </Button>
        <Button variant="ghost" onClick={handlePrint}>
          Drucken
        </Button>
      </TopBar>

      {exportError && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 sm:mx-[22px]">
          <WarningCircle size={16} weight="bold" />
          {exportError}
        </div>
      )}

      {/* Badge Preview(s) — Badges bleiben bewusst dunkel (Druckvorlage) */}
      <div className="px-4 py-6 sm:px-[22px]">
        <div ref={badgeRef} className="flex flex-wrap justify-center gap-8">
          {teamsToPrint.map(t => (
            <BadgeCard
              key={t.id}
              team={t}
              portalUrl={`${origin}/team/${t.qrToken}`}
              qrDataUrl={qrCodes[t.id] ?? null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function BadgeCard({ team, qrDataUrl }: {
  team: { id: string; name: string; nummer: number; farbe: string; logoUrl: string | null; motto: string | null; checkinCode: string; qrToken: string };
  portalUrl: string;
  qrDataUrl: string | null;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = team.logoUrl && !logoFailed;

  return (
    <div style={{ width: "380px", backgroundColor: "#0A111C", borderRadius: "16px", overflow: "hidden", pageBreakInside: "avoid" }}>
      {/* Farb-Header */}
      <div style={{ height: "6px", backgroundColor: team.farbe }} />

      <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Team-Info */}
        <div style={{ textAlign: "center" }}>
          {showLogo ? (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Badge wird per Canvas gerendert, next/image liefert kein <img> mit crossOrigin */}
              <img
                src={team.logoUrl ?? undefined}
                alt={team.name}
                style={{ width: "56px", height: "56px", objectFit: "contain" }}
                crossOrigin="anonymous"
                onError={() => setLogoFailed(true)}
              />
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
            display: "inline-block", width: "180px", height: "180px",
          }}>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- lokal erzeugter Data-URI, kein next/image nötig
              <img src={qrDataUrl} alt="Team QR" style={{ width: "180px", height: "180px" }} />
            ) : (
              <div style={{ width: "180px", height: "180px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#8598B4" }}>
                Generiere…
              </div>
            )}
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
