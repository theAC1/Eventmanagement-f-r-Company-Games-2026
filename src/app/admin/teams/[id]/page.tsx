"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { AuditInfo } from "@/components/audit-info";
import { TopBar, TopBarSpacer } from "@/components/ui/top-bar";
import { Button, ButtonLink } from "@/components/ui/button";
import { apiSend } from "@/lib/api-client";
import { meldung } from "@/lib/api-fehler";

type Team = {
  id: string; name: string; nummer: number; farbe: string;
  captainName: string | null; captainEmail: string | null;
  logoUrl: string | null; motto: string | null;
  teilnehmerAnzahl: number | null; teilnehmerNamen: string[] | null;
  qrToken: string;
  createdBy?: { id: string; name: string } | null;
  updatedBy?: { id: string; name: string } | null;
  createdAt?: string;
  updatedAt?: string;
};

const INPUT_CLASS =
  "w-full rounded-[9px] border border-line-strong bg-sunken px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-label focus:border-action";

/** Namensliste aus dem Textfeld — eine Zeile pro Person, Leerzeilen fallen weg. */
function teilnehmerNamenAus(text: string): string[] {
  return text.split("\n").map(n => n.trim()).filter(Boolean);
}

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoWarnung, setLogoWarnung] = useState<string | null>(null);
  const [teilnehmerText, setTeilnehmerText] = useState("");

  const loadTeam = useCallback(() => {
    fetch(`/api/teams/${teamId}`)
      .then(r => { if (!r.ok) throw new Error("Nicht gefunden"); return r.json(); })
      .then(t => {
        setTeam(t);
        setTeilnehmerText(Array.isArray(t.teilnehmerNamen) ? t.teilnehmerNamen.join("\n") : "");
        setDirty(false);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [teamId]);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  const update = <K extends keyof Team>(field: K, value: Team[K]) => {
    if (!team) return;
    setTeam({ ...team, [field]: value });
    setDirty(true);
    setSuccessMsg(null);
  };

  const handleSave = async () => {
    if (!team) return;
    setSaving(true); setError(null); setLogoWarnung(null);
    try {
      const namen = teilnehmerNamenAus(teilnehmerText);
      // Die gepflegte Zahl gilt: sie ist die verbindliche Meldung für
      // Verpflegung und Mittagswellen. Eine Namensliste, die erst zur Hälfte
      // erfasst ist, darf sie nicht überschreiben — nur wenn gar keine Zahl
      // gesetzt ist, springt die Liste ein.
      const gemeldeteAnzahl = team.teilnehmerAnzahl ?? (namen.length > 0 ? namen.length : null);
      // apiSend statt fetch: liefert den Klartext-Grund der API ans Formular.
      // Vorher stand hier bei jedem Fehler nur "Fehler beim Speichern" — eine
      // abgelehnte Logo-Adresse sah damit aus wie ein Serverproblem.
      const gespeichert = await apiSend<Team & { logoWarnung?: string | null }>(
        `/api/teams/${teamId}`,
        "PUT",
        {
          ...team,
          teilnehmerNamen: namen.length > 0 ? namen : null,
          teilnehmerAnzahl: gemeldeteAnzahl,
        },
        "Fehler beim Speichern",
      );
      // Abgeleitete Zahl sichtbar machen, ohne die Audit-Angaben neu zu laden.
      // Das Logo kommt als lokaler Pfad zurück (der Server hat es kopiert) —
      // ohne Übernahme würde der nächste Klick die fremde Adresse erneut senden.
      setTeam(vorher =>
        vorher
          ? { ...vorher, teilnehmerAnzahl: gemeldeteAnzahl, logoUrl: gespeichert.logoUrl }
          : vorher,
      );
      setLogoWarnung(gespeichert.logoWarnung ?? null);
      setDirty(false);
      setSuccessMsg("Gespeichert");
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (err) {
      setError(meldung(err, "Fehler beim Speichern"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`"${team?.name}" wirklich löschen?`)) return;
    await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
    router.push("/admin/teams");
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink-3">
        Lade...
      </div>
    );
  }
  if (!team) {
    return (
      <div className="py-12 text-center text-sm text-hot-tint">
        {error ?? "Nicht gefunden"}
      </div>
    );
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const portalUrl = `${baseUrl}/team/${team.qrToken}`;
  const anzahlNamen = teilnehmerNamenAus(teilnehmerText).length;
  const anzahlWeichtAb =
    team.teilnehmerAnzahl != null && anzahlNamen > 0 && team.teilnehmerAnzahl !== anzahlNamen;

  return (
    <div className="flex flex-col">
      <TopBar
        title={
          <span className="flex items-center gap-2.5">
            <Link
              href="/admin/teams"
              aria-label="Zurück zu Teams"
              className="text-faint transition-colors duration-150 hover:text-ink"
            >
              <ArrowLeft size={18} weight="bold" />
            </Link>
            {team.name}
          </span>
        }
      >
        <TopBarSpacer />
        {successMsg && <span className="text-xs font-medium text-done">{successMsg}</span>}
        <Button variant="primary" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? "Speichert..." : "Speichern"}
        </Button>
      </TopBar>

      <div className="max-w-3xl space-y-4 px-4 py-5 sm:px-[22px]">
        {/* Eigene Zeile statt Kurztext in der Kopfleiste: Die Meldungen der API
            nennen jetzt Feld und Grund und passen dort nicht mehr hinein. */}
        {error && (
          <p className="rounded-[9px] border border-hot-tint/30 bg-hot-tint/10 px-3 py-2 text-xs text-hot-tint">
            {error}
          </p>
        )}
        {/* Team-Header mit Farbe */}
        <div className="flex items-center gap-4">
          <div
            className="tnum flex h-16 w-16 items-center justify-center rounded-xl text-2xl font-bold text-white"
            style={{ backgroundColor: team.farbe }}
          >
            {team.nummer}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-[-0.02em] text-ink">{team.name}</h1>
            {team.motto && <p className="truncate text-sm text-ink-3">{team.motto}</p>}
            <AuditInfo
              createdBy={team.createdBy}
              updatedBy={team.updatedBy}
              createdAt={team.createdAt}
              updatedAt={team.updatedAt}
            />
          </div>
        </div>

        {/* Grunddaten */}
        <section className="space-y-5 rounded-[10px] border border-line bg-surface p-5">
          <h2 className="cg-label">Grunddaten</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Teamname">
              <input type="text" value={team.name} onChange={e => update("name", e.target.value)}
                className={INPUT_CLASS} />
            </Field>
            <Field label="Nummer">
              <input type="number" value={team.nummer} onChange={e => update("nummer", parseInt(e.target.value) || 1)}
                className={`${INPUT_CLASS} tnum`} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Farbe">
              <div className="flex gap-2">
                <input type="color" value={team.farbe} onChange={e => update("farbe", e.target.value)}
                  className="h-9 w-10 cursor-pointer rounded-[9px] border border-line-strong bg-sunken" />
                <input type="text" value={team.farbe} onChange={e => update("farbe", e.target.value)}
                  className={`${INPUT_CLASS} tnum flex-1`} />
              </div>
            </Field>
            <Field label="Motto / Slogan">
              <input type="text" value={team.motto ?? ""} onChange={e => update("motto", e.target.value || null)}
                placeholder="z.B. Wir geben alles!"
                className={INPUT_CLASS} />
            </Field>
          </div>
          <Field label="Logo">
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[9px] border border-line bg-sunken">
                <LogoVorschau key={team.logoUrl ?? ""} url={team.logoUrl} />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <input type="text" value={team.logoUrl ?? ""} onChange={e => update("logoUrl", e.target.value || null)}
                  placeholder="https://firma.ch/logo.png"
                  className={INPUT_CLASS} />
                <p className="text-[11px] text-ink-3">
                  Bild-Adresse einfügen und speichern — das Logo wird dabei einmalig auf
                  unseren Server kopiert. Fremd eingebundene Logos erscheinen sonst zwar
                  in der Vorschau, aber nicht im Badge-Export und nicht im Ausdruck.
                </p>
              </div>
            </div>
          </Field>
          {logoWarnung && (
            <p className="rounded-[9px] border border-[var(--warn-border)] bg-warn-dim/50 px-3 py-2 text-[11px] text-ink-2">
              {logoWarnung}
            </p>
          )}
        </section>

        {/* Captain */}
        <section className="space-y-5 rounded-[10px] border border-line bg-surface p-5">
          <h2 className="cg-label">Team-Captain</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input type="text" value={team.captainName ?? ""} onChange={e => update("captainName", e.target.value || null)}
                className={INPUT_CLASS} />
            </Field>
            <Field label="E-Mail">
              <input type="email" value={team.captainEmail ?? ""} onChange={e => update("captainEmail", e.target.value || null)}
                className={INPUT_CLASS} />
            </Field>
          </div>
        </section>

        {/* Teilnehmer */}
        <section className="space-y-5 rounded-[10px] border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="cg-label">Teilnehmer</h2>
            <span className="tnum text-xs text-ink-3">{anzahlNamen} Namen erfasst</span>
          </div>
          <Field label="Definitive Teilnehmerzahl">
            <input
              type="number"
              min={1}
              value={team.teilnehmerAnzahl ?? ""}
              onChange={e => {
                const zahl = parseInt(e.target.value, 10);
                update("teilnehmerAnzahl", Number.isFinite(zahl) && zahl > 0 ? zahl : null);
              }}
              placeholder={anzahlNamen > 0 ? String(anzahlNamen) : "z.B. 8"}
              className={`${INPUT_CLASS} tnum sm:max-w-[160px]`}
            />
            <p className="text-[11px] text-ink-3">
              Verbindliche Kopfzahl für Verpflegung und Mittagswellen. Leer lassen heisst:
              aus der Namensliste ableiten.
            </p>
          </Field>
          {anzahlWeichtAb && (
            <p className="rounded-[9px] border border-[var(--warn-border)] bg-warn-dim/50 px-3 py-2 text-[11px] text-ink-2">
              Gemeldete Zahl ({team.teilnehmerAnzahl}) weicht von den {anzahlNamen} erfassten
              Namen ab. Für die Planung zählt die gemeldete Zahl.
            </p>
          )}
          <Field label="Namen (ein Name pro Zeile)">
            <textarea value={teilnehmerText}
              onChange={e => { setTeilnehmerText(e.target.value); setDirty(true); }}
              rows={6} placeholder={"Max Muster\nAnna Beispiel\nLuca Test"}
              className={`${INPUT_CLASS} tnum resize-y`} />
          </Field>
        </section>

        {/* QR / Badge */}
        <section className="space-y-4 rounded-[10px] border border-line bg-surface p-5">
          <h2 className="cg-label">Badge &amp; QR-Code</h2>
          <div className="space-y-2 text-sm text-ink-3">
            <p>Team-Portal URL:</p>
            <code className="tnum block break-all rounded-[9px] border border-line bg-sunken px-3 py-2 text-xs text-ink-2">
              {portalUrl}
            </code>
            <p className="text-[11px] text-label">
              QR-Token: <span className="tnum">{team.qrToken}</span>
            </p>
          </div>
          <ButtonLink href={`/admin/teams/${team.id}/badge`} variant="primary">
            Badge generieren
          </ButtonLink>
        </section>

        {/* Danger Zone */}
        <section className="rounded-[10px] border border-[var(--hot-border)] bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">Team löschen</p>
              <p className="text-[11px] text-ink-3">Inkl. aller Ergebnisse und QR-Verifikationen.</p>
            </div>
            <Button variant="danger-ghost" onClick={handleDelete}>
              Löschen
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * Zeigt sofort, ob die eingetragene Adresse überhaupt ein Bild liefert —
 * vorher merkte man das erst beim Badge-Druck. Der Aufrufer setzt `key` auf
 * die Adresse, damit der Fehlerzustand bei einer neuen Adresse zurückfällt.
 */
function LogoVorschau({ url }: { url: string | null }) {
  const [fehler, setFehler] = useState(false);

  if (!url) return <span className="text-[10px] text-ink-3">kein Logo</span>;
  if (fehler) return <span className="text-[10px] text-hot-tint">defekt</span>;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- beliebige Bildquelle, next/image bringt hier keinen Vorteil
    <img
      src={url}
      alt="Logo-Vorschau"
      className="h-12 w-12 object-contain"
      onError={() => setFehler(true)}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="cg-label block">{label}</label>
      {children}
    </div>
  );
}
