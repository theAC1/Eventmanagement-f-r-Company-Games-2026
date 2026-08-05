"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { AuditInfo } from "@/components/audit-info";
import { TopBar, TopBarSpacer } from "@/components/ui/top-bar";
import { Button, ButtonLink } from "@/components/ui/button";

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
    setSaving(true); setError(null);
    try {
      const namen = teilnehmerText.trim().split("\n").filter(n => n.trim());
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...team,
          teilnehmerNamen: namen.length > 0 ? namen : null,
          teilnehmerAnzahl: namen.length > 0 ? namen.length : team.teilnehmerAnzahl,
        }),
      });
      if (!res.ok) throw new Error("Fehler beim Speichern");
      setDirty(false);
      setSuccessMsg("Gespeichert");
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
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
        {error && <span className="text-xs font-medium text-hot-tint">{error}</span>}
        <Button variant="primary" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? "Speichert..." : "Speichern"}
        </Button>
      </TopBar>

      <div className="max-w-3xl space-y-4 px-4 py-5 sm:px-[22px]">
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
          <Field label="Logo URL">
            <input type="text" value={team.logoUrl ?? ""} onChange={e => update("logoUrl", e.target.value || null)}
              placeholder="https://... oder /images/logos/team1.png"
              className={INPUT_CLASS} />
          </Field>
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
            <span className="tnum text-xs text-ink-3">
              {teilnehmerText.trim().split("\n").filter(n => n.trim()).length} Personen
            </span>
          </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="cg-label block">{label}</label>
      {children}
    </div>
  );
}
