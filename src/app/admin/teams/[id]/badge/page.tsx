"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, WarningCircle } from "@phosphor-icons/react";
import { TopBar, TopBarSpacer } from "@/components/ui/top-bar";
import { Button } from "@/components/ui/button";
import { generateQrDataUrl } from "@/lib/qr";
import {
  renderBadge,
  renderBadgeSheet,
  renderBadgesIndividually,
  downloadCanvas,
  PALETTE_DUNKEL,
  PALETTE_HELL,
  type BadgeTeam,
  type BadgePalette,
} from "@/lib/badge-canvas";
import { buildPrintDocument, openPrintWindow, writePrintDocument } from "@/lib/badge-print";

type Team = BadgeTeam;

/** Auflösung des Ausdrucks: 380px-Vorlage × 3 ≈ 320 dpi bei 90 mm Breite. */
const PRINT_SCALE = 3;
const SINGLE_SCALE = 4;
const SHEET_SCALE = 3;

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
  const [busy, setBusy] = useState<null | "png" | "print">(null);
  // Hell ist die Vorgabe fürs Drucken: 14 fast schwarze Karten kosten sehr
  // viel Toner und werden auf einfachen Druckern streifig.
  const [hellDrucken, setHellDrucken] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/teams/${teamId}`).then(r => r.json()),
      // /api/teams/badges statt /api/teams: Die allgemeine Team-Liste hat
      // qrToken/checkinCode aus Sicherheitsgründen entfernt — für den
      // Badge-Druck ("Alle Teams") braucht es aber genau diese Felder.
      fetch("/api/teams/badges").then(r => r.json()),
    ])
      .then(([t, all]) => {
        if (t?.error) throw new Error(t.error);
        setTeam(t);
        setAllTeams(Array.isArray(all) ? all : []);
      })
      .catch(err => {
        console.error("Badge-Daten laden fehlgeschlagen:", err);
        setLoadError("Team-Daten konnten nicht geladen werden.");
      })
      .finally(() => setLoading(false));
  }, [teamId]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const teamsToPrint = printAll ? allTeams : team ? [team] : [];
  const teamsKey = teamsToPrint.map(t => t.id).join(",");

  // QR-Codes lokal als Data-URI erzeugen — kein externer Dienst, damit sie
  // offline funktionieren und die Canvas beim Export nie "tainten".
  useEffect(() => {
    if (teamsToPrint.length === 0) return;
    const missing = teamsToPrint.filter(t => !qrCodes[t.id]);
    if (missing.length === 0) return;

    let cancelled = false;
    setQrGenerating(true);
    Promise.all(
      missing.map(async t => {
        const dataUrl = await generateQrDataUrl(`${origin}/team/${t.qrToken}`, 400);
        return [t.id, dataUrl] as const;
      }),
    )
      .then(entries => {
        if (!cancelled) setQrCodes(prev => ({ ...prev, ...Object.fromEntries(entries) }));
      })
      .catch(err => {
        console.error("QR-Code-Generierung fehlgeschlagen:", err);
        if (!cancelled) setError("QR-Codes konnten nicht erzeugt werden.");
      })
      .finally(() => {
        if (!cancelled) setQrGenerating(false);
      });

    return () => {
      cancelled = true;
    };
    // teamsKey sagt, WELCHE Teams gebraucht werden — das ist die eigentliche Abhängigkeit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamsKey, origin]);

  const allQrReady = teamsToPrint.length > 0 && teamsToPrint.every(t => qrCodes[t.id]);
  const palette = hellDrucken ? PALETTE_HELL : PALETTE_DUNKEL;

  const reportLogos = useCallback((skipped: string[]) => {
    setNotice(
      skipped.length > 0
        ? `Hinweis: Logo nicht ladbar für ${skipped.join(", ")} — dort steht die Startnummer im Kreis.`
        : null,
    );
  }, []);

  const handleExportPng = async () => {
    if (!allQrReady || busy) return;
    setBusy("png");
    setError(null);
    try {
      if (printAll) {
        const { canvas, logosSkipped } = await renderBadgeSheet(teamsToPrint, qrCodes, {
          scale: SHEET_SCALE,
          palette,
        });
        await downloadCanvas(canvas, "badges-alle-teams.png");
        reportLogos(logosSkipped);
      } else if (team) {
        const { canvas, logosSkipped } = await renderBadge(
          team,
          qrCodes[team.id],
          SINGLE_SCALE,
          palette,
        );
        const slug = team.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        await downloadCanvas(canvas, `badge-${slug || "team"}.png`);
        reportLogos(logosSkipped);
      }
    } catch (err) {
      console.error("PNG-Export fehlgeschlagen:", err);
      setError(
        "PNG-Export fehlgeschlagen. Bitte stattdessen „Drucken“ verwenden — im Druckdialog lässt sich der Bogen auch als PDF speichern.",
      );
    } finally {
      setBusy(null);
    }
  };

  const handlePrint = async () => {
    if (!allQrReady || busy) return;

    // Fenster ZUERST öffnen, solange der Klick den Browser noch dazu
    // berechtigt — das Rendern der Badges dauert zu lange, danach würde der
    // Popup-Blocker zuschlagen.
    const printWindow = openPrintWindow();
    if (!printWindow) {
      setError(
        "Das Druckfenster wurde blockiert. Bitte Popups für diese Seite erlauben und erneut auf „Drucken“ klicken.",
      );
      return;
    }

    setBusy("print");
    setError(null);
    try {
      const { badges, logosSkipped } = await renderBadgesIndividually(
        teamsToPrint,
        qrCodes,
        PRINT_SCALE,
        palette,
      );
      writePrintDocument(
        printWindow,
        buildPrintDocument(
          badges.map(b => ({ name: b.team.name, dataUrl: b.canvas.toDataURL("image/png") })),
          printAll ? `Badges – alle Teams (${badges.length})` : `Badge – ${team?.name ?? ""}`,
        ),
      );
      reportLogos(logosSkipped);
    } catch (err) {
      console.error("Druck fehlgeschlagen:", err);
      printWindow.close();
      setError(
        "Druck fehlgeschlagen. Bitte stattdessen „PNG Export“ verwenden und die Datei aus dem Download-Ordner drucken.",
      );
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink-3">Lade...</div>
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

  const actionsDisabled = !allQrReady || busy !== null;

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
          Alle Teams ({allTeams.length})
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-ink-3">
          <input
            type="checkbox"
            checked={hellDrucken}
            onChange={e => setHellDrucken(e.target.checked)}
            className="h-4 w-4 rounded border-line-key accent-[var(--action)]"
          />
          Hell drucken
        </label>
        <Button variant="primary" onClick={handleExportPng} disabled={actionsDisabled}>
          {busy === "png" ? "Exportiere…" : qrGenerating ? "QR-Codes…" : "PNG Export"}
        </Button>
        <Button variant="ghost" onClick={handlePrint} disabled={actionsDisabled}>
          {busy === "print" ? "Bereite Druck vor…" : "Drucken"}
        </Button>
      </TopBar>

      {error && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 sm:mx-[22px]">
          <WarningCircle size={16} weight="bold" />
          {error}
        </div>
      )}
      {notice && (
        <div className="mx-4 mt-4 rounded-lg border border-line-key bg-surface px-3 py-2 text-xs text-ink-3 sm:mx-[22px]">
          {notice}
        </div>
      )}

      {/* Vorschau — das exportierte PNG wird aus denselben Daten gezeichnet
          (src/lib/badge-canvas.ts), nicht aus diesem DOM. */}
      <div className="px-4 py-6 sm:px-[22px]">
        <div className="flex flex-wrap justify-center gap-8">
          {teamsToPrint.map(t => (
            <BadgeCard key={t.id} team={t} qrDataUrl={qrCodes[t.id] ?? null} palette={palette} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BadgeCard({ team, qrDataUrl, palette }: {
  team: Team;
  qrDataUrl: string | null;
  palette: BadgePalette;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = team.logoUrl && !logoFailed;

  return (
    <div style={{
      width: "380px", backgroundColor: palette.bg, borderRadius: "16px", overflow: "hidden",
      border: palette.cardBorder ? `1px solid ${palette.cardBorder}` : undefined,
    }}>
      <div style={{ height: "6px", backgroundColor: team.farbe }} />

      <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ textAlign: "center" }}>
          {showLogo ? (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- externes Logo, next/image bringt hier keinen Vorteil */}
              <img
                src={team.logoUrl ?? undefined}
                alt={team.name}
                style={{ width: "56px", height: "56px", objectFit: "contain" }}
                // Gleiche Ladebedingung wie der Export (badge-canvas.ts): Ein Logo
                // ohne CORS-Freigabe fällt schon in der Vorschau auf den
                // Nummernkreis zurück, statt etwas zu zeigen, das im PNG fehlt.
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
          <div style={{ fontSize: "22px", fontWeight: "bold", color: palette.ink }}>{team.name}</div>
          <div style={{ fontSize: "14px", color: palette.inkDim }}>#{team.nummer}</div>
          {team.motto && <div style={{ fontSize: "12px", color: palette.inkFaint, fontStyle: "italic", marginTop: "4px" }}>{team.motto}</div>}
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{
            backgroundColor: palette.qrBg, borderRadius: "12px", padding: "12px",
            display: "inline-block",
          }}>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- lokaler Data-URI
              <img src={qrDataUrl} alt="Team QR" style={{ width: "180px", height: "180px", display: "block" }} />
            ) : (
              <div style={{ width: "180px", height: "180px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#8598B4" }}>
                Generiere…
              </div>
            )}
          </div>
          <div style={{
            marginTop: "8px", fontSize: "11px", fontWeight: "600", color: palette.accent,
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            Team-QR scannen
          </div>
          <div style={{ fontSize: "9px", color: palette.inkFaint }}>Zeitplan &middot; Punkte &middot; Lageplan &middot; Check-in</div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{
            display: "inline-block", backgroundColor: palette.backupBg, border: `1px solid ${palette.line}`,
            borderRadius: "8px", padding: "6px 20px",
          }}>
            <div style={{ fontSize: "9px", color: palette.inkFaint, marginBottom: "2px" }}>BACKUP CODE</div>
            <div style={{
              fontSize: "28px", fontWeight: "bold", color: palette.ink, fontFamily: "monospace",
              letterSpacing: "0.2em",
            }}>
              {team.checkinCode || "---"}
            </div>
          </div>
        </div>

        <div style={{
          textAlign: "center", paddingTop: "8px", borderTop: `1px solid ${palette.line}`,
          fontSize: "10px", color: palette.inkFaint, fontWeight: "600",
          textTransform: "uppercase", letterSpacing: "0.1em",
        }}>
          Company Games 2026
        </div>
      </div>
    </div>
  );
}
