"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AuditInfo } from "@/components/audit-info";

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

  if (loading) return <div className="flex items-center justify-center h-64 text-zinc-500">Lade...</div>;
  if (!team) return <div className="text-red-400 text-center py-12">{error ?? "Nicht gefunden"}</div>;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const portalUrl = `${baseUrl}/team/${team.qrToken}`;

  return (
    <div className="max-w-3xl space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Link href="/admin/teams" className="hover:text-white transition">Teams</Link>
          <span>/</span>
          <span className="text-white">{team.name}</span>
        </div>
        <div className="flex items-center gap-3">
          {successMsg && <span className="text-sm text-emerald-400">{successMsg}</span>}
          {error && <span className="text-sm text-red-400">{error}</span>}
          <button onClick={handleSave} disabled={!dirty || saving}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${dirty ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"}`}>
            {saving ? "Speichert..." : "Speichern"}
          </button>
        </div>
      </div>

      {/* Team-Header mit Farbe */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold text-white"
          style={{ backgroundColor: team.farbe }}>
          {team.nummer}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{team.name}</h1>
          {team.motto && <p className="text-zinc-400">{team.motto}</p>}
          <AuditInfo
            createdBy={team.createdBy}
            updatedBy={team.updatedBy}
            createdAt={team.createdAt}
            updatedAt={team.updatedAt}
          />
        </div>
      </div>

      {/* Grunddaten */}
      <section className="border border-zinc-800 rounded-lg p-6 space-y-5">
        <h2 className="text-lg font-semibold">Grunddaten</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Teamname">
            <input type="text" value={team.name} onChange={e => update("name", e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
          </Field>
          <Field label="Nummer">
            <input type="number" value={team.nummer} onChange={e => update("nummer", parseInt(e.target.value) || 1)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Farbe">
            <div className="flex gap-2">
              <input type="color" value={team.farbe} onChange={e => update("farbe", e.target.value)}
                className="w-10 h-9 bg-zinc-900 border border-zinc-700 rounded cursor-pointer" />
              <input type="text" value={team.farbe} onChange={e => update("farbe", e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-zinc-500" />
            </div>
          </Field>
          <Field label="Motto / Slogan">
            <input type="text" value={team.motto ?? ""} onChange={e => update("motto", e.target.value || null)}
              placeholder="z.B. Wir geben alles!"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
          </Field>
        </div>
        <Field label="Logo URL">
          <input type="text" value={team.logoUrl ?? ""} onChange={e => update("logoUrl", e.target.value || null)}
            placeholder="https://... oder /images/logos/team1.png"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
        </Field>
      </section>

      {/* Captain */}
      <section className="border border-zinc-800 rounded-lg p-6 space-y-5">
        <h2 className="text-lg font-semibold">Team-Captain</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name">
            <input type="text" value={team.captainName ?? ""} onChange={e => update("captainName", e.target.value || null)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
          </Field>
          <Field label="E-Mail">
            <input type="email" value={team.captainEmail ?? ""} onChange={e => update("captainEmail", e.target.value || null)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
          </Field>
        </div>
      </section>

      {/* Teilnehmer */}
      <section className="border border-zinc-800 rounded-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Teilnehmer</h2>
          <span className="text-sm text-zinc-500">
            {teilnehmerText.trim().split("\n").filter(n => n.trim()).length} Personen
          </span>
        </div>
        <Field label="Namen (ein Name pro Zeile)">
          <textarea value={teilnehmerText}
            onChange={e => { setTeilnehmerText(e.target.value); setDirty(true); }}
            rows={6} placeholder={"Max Muster\nAnna Beispiel\nLuca Test"}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-zinc-500 resize-y" />
        </Field>
      </section>

      {/* QR / Badge */}
      <section className="border border-zinc-800 rounded-lg p-6 space-y-5">
        <h2 className="text-lg font-semibold">Badge &amp; QR-Code</h2>
        <div className="text-sm text-zinc-400 space-y-2">
          <p>Team-Portal URL:</p>
          <code className="block bg-zinc-900 px-3 py-2 rounded text-xs break-all">
            {portalUrl}
          </code>
          <p className="text-xs text-zinc-600">QR-Token: {team.qrToken}</p>
        </div>
        <Link href={`/admin/teams/${team.id}/badge`}
          className="inline-block px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition">
          Badge generieren
        </Link>
      </section>

      {/* Danger Zone */}
      <section className="border border-red-900/50 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-300">Team löschen</p>
            <p className="text-xs text-zinc-500">Inkl. aller Ergebnisse und QR-Verifikationen.</p>
          </div>
          <button onClick={handleDelete}
            className="px-4 py-2 text-sm font-medium text-red-400 border border-red-800 rounded-lg hover:bg-red-950 transition">
            Löschen
          </button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}
