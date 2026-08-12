"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Warning } from "@phosphor-icons/react";
import { TopBar, TopBarSpacer } from "@/components/ui/top-bar";
import { KpiBand, KpiCell } from "@/components/ui/kpi";
import { StatusPill } from "@/components/ui/pills";
import { apiFetch, apiSend } from "@/lib/api-client";
import { meldung } from "@/lib/api-fehler";
import type { VerpflegungsUebersicht, VerpflegungsPerson } from "@/app/api/verpflegung/route";

const ROLLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  ORGA: "Orga",
  SCHIEDSRICHTER: "Schiedsrichter",
  HELFER: "Helfer",
};

/**
 * Wie viele Personen sind wann am Essen?
 *
 * Die Wellen kommen aus dem gespeicherten Zeitplan, die Kopfzahlen live aus den
 * Stammdaten. Helfer ohne Posten melden hier, ob sie mitessen — sonst fehlen
 * sie in der Zahl, mit der die Küche plant.
 */
export default function VerpflegungPage() {
  const [daten, setDaten] = useState<VerpflegungsUebersicht | null>(null);
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDaten(await apiFetch<VerpflegungsUebersicht>("/api/verpflegung"));
      setFehler(null);
    } catch (err) {
      setFehler(meldung(err, "Verpflegungsübersicht konnte nicht geladen werden."));
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setzeMittag = async (person: VerpflegungsPerson, isstMittag: boolean) => {
    setSpeichert(person.id);
    setFehler(null);
    try {
      await apiSend(`/api/users/${person.id}`, "PUT", { isstMittag });
      await load();
    } catch (err) {
      setFehler(meldung(err, "Änderung konnte nicht gespeichert werden."));
    } finally {
      setSpeichert(null);
    }
  };

  if (laden) {
    return (
      <div className="flex flex-col">
        <TopBar title="Verpflegung" />
        <div className="flex h-64 items-center justify-center text-sm text-ink-3">
          L&auml;dt&hellip;
        </div>
      </div>
    );
  }

  const wellen = daten?.wellen ?? [];
  const teamsTotal = daten?.teams.teilnehmer ?? 0;
  const personalTotal = daten?.personal.essenTotal ?? 0;

  return (
    <div className="flex flex-col">
      <TopBar title="Verpflegung">
        {daten?.zeitplan ? (
          <span className="hidden text-[13px] text-ink-3 md:inline">
            Zeitplan:{" "}
            <span className="font-medium text-ink-2">{daten.zeitplan.name}</span>
          </span>
        ) : (
          <span className="text-[13px] text-ink-3">Kein Zeitplan</span>
        )}
        <TopBarSpacer />
      </TopBar>

      <KpiBand className="max-lg:hidden">
        <KpiCell label="Teilnehmer in Teams" value={teamsTotal} unit="Personen" />
        <KpiCell label="Orga, Schiris, Helfer" value={personalTotal} unit="essen mit" />
        <KpiCell
          label="Total am Mittag"
          value={teamsTotal + personalTotal}
          unit="Personen"
        />
        <KpiCell
          label="Spitze gleichzeitig"
          value={daten?.spitze ?? 0}
          unit="Personen"
          note="an dieser Zahl hängt die Küche"
          last
        />
      </KpiBand>

      <div className="space-y-5 px-4 py-6 sm:px-[22px]">
        {fehler && (
          <div className="flex items-start gap-2.5 rounded-[10px] border border-[var(--hot-border)] bg-hot-dim/50 px-3.5 py-2.5 text-[13px] text-ink-2">
            <Warning size={15} weight="bold" className="mt-0.5 shrink-0 text-hot-tint" />
            <span>{fehler}</span>
          </div>
        )}

        {daten && daten.teams.ohneAngabe.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-[10px] border border-[var(--warn-border)] bg-warn-dim px-3.5 py-2.5 text-[13px] text-ink-2">
            <Warning size={15} weight="bold" className="mt-0.5 shrink-0 text-warn" />
            <span>
              <span className="tnum">{daten.teams.ohneAngabe.length}</span> Team(s)
              ohne Teilnehmerzahl &mdash; sie fehlen in der Kopfzahl:{" "}
              {daten.teams.ohneAngabe.slice(0, 6).join(", ")}
              {daten.teams.ohneAngabe.length > 6 && " …"}.{" "}
              <Link href="/admin/teams" className="font-medium text-action-tint underline">
                Teams erg&auml;nzen
              </Link>
            </span>
          </div>
        )}

        {wellen.length === 0 ? (
          <div className="rounded-[10px] border border-line bg-surface p-8 text-center text-sm text-ink-3">
            Noch keine Mittagswellen berechnet. Stelle im{" "}
            <Link href="/admin/schedule" className="font-medium text-action-tint underline">
              Zeitplan
            </Link>{" "}
            ein Mittagsfenster ein und speichere den Plan.
          </div>
        ) : (
          <section className="overflow-hidden rounded-[10px] border border-line bg-surface">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3.5 py-2.5">
              <h2 className="text-[13px] font-semibold text-ink">Mittagswellen</h2>
              <span className="tnum text-[11px] text-label">
                {wellen.length} Wellen &middot; {wellen[0].startZeit}–
                {wellen[wellen.length - 1].endZeit}
              </span>
            </div>
            <div className="divide-y divide-line-soft">
              {wellen.map((w) => (
                <div
                  key={w.welle}
                  className="grid gap-x-4 gap-y-1.5 px-3.5 py-3 sm:grid-cols-[130px_1fr_auto]"
                >
                  <span className="tnum text-[13px] font-medium text-ink">
                    {w.startZeit}&ndash;{w.endZeit}
                  </span>
                  <div className="min-w-0 space-y-0.5 text-[12px]">
                    <p className="text-ink-2">
                      {w.teamNamen.join(", ") || "keine Teams"}
                    </p>
                    {w.postenNamen.length > 0 && (
                      <p className="text-ink-3">
                        Posten-Crew: {w.postenNamen.join(", ")}
                      </p>
                    )}
                    {w.helferNamen.length > 0 && (
                      <p className="text-ink-3">Helfer: {w.helferNamen.join(", ")}</p>
                    )}
                  </div>
                  <span className="tnum whitespace-nowrap text-[13px] font-semibold text-ink">
                    {w.personenTotal} Pers.
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {daten && (
          <PersonalListe
            titel="Ohne Posten — isst mit?"
            hinweis="Diese Personen sind keinem Posten zugeteilt. Ihre Angabe entscheidet, ob sie in der Kopfzahl mitzählen."
            personen={daten.personal.ohnePosten}
            umschaltbar
            speichert={speichert}
            onToggle={setzeMittag}
          />
        )}

        {daten && daten.personal.mitPosten.length > 0 && (
          <PersonalListe
            titel="Mit Posten — isst in der Welle des Postens"
            hinweis="Der Posten pausiert während seiner Mittagswelle, damit die Crew essen kann."
            personen={daten.personal.mitPosten}
            umschaltbar={false}
            speichert={speichert}
            onToggle={setzeMittag}
          />
        )}
      </div>
    </div>
  );
}

function PersonalListe({
  titel,
  hinweis,
  personen,
  umschaltbar,
  speichert,
  onToggle,
}: {
  titel: string;
  hinweis: string;
  personen: VerpflegungsPerson[];
  umschaltbar: boolean;
  speichert: string | null;
  onToggle: (person: VerpflegungsPerson, isstMittag: boolean) => void;
}) {
  const essen = personen.filter((p) => p.isstMittag).length;

  return (
    <section className="overflow-hidden rounded-[10px] border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3.5 py-2.5">
        <h2 className="text-[13px] font-semibold text-ink">{titel}</h2>
        <span className="tnum text-[11px] text-label">
          {essen} von {personen.length} essen mit
        </span>
      </div>
      <p className="border-b border-line-soft px-3.5 py-2 text-[11px] text-ink-3">
        {hinweis}
      </p>
      {personen.length === 0 ? (
        <p className="px-3.5 py-4 text-[13px] text-ink-3">Niemand erfasst.</p>
      ) : (
        <div className="divide-y divide-line-soft">
          {personen.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5"
            >
              <span className="text-[13px] text-ink">{p.name}</span>
              <span className="text-[11px] text-ink-3">
                {ROLLE_LABEL[p.rolle] ?? p.rolle}
              </span>
              {p.posten && (
                <span className="text-[11px] text-ink-3">&middot; {p.posten}</span>
              )}
              <span className="flex-1" aria-hidden />
              {umschaltbar ? (
                <button
                  type="button"
                  disabled={speichert === p.id}
                  onClick={() => onToggle(p, !p.isstMittag)}
                  className="inline-flex items-center rounded-full px-[9px] py-1 text-[11px] font-semibold tracking-[0.04em] transition-opacity duration-150 hover:opacity-80 disabled:cursor-wait"
                  style={
                    p.isstMittag
                      ? { color: "var(--done-tint)", background: "var(--done-dim)" }
                      : { color: "var(--ink-3)", background: "var(--sunken)" }
                  }
                >
                  {p.isstMittag ? "Isst mit" : "Isst nicht"}
                </button>
              ) : (
                <StatusPill tone="done">Isst mit</StatusPill>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
