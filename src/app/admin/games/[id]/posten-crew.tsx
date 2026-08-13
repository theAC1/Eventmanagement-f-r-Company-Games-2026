"use client";

import { useCallback, useEffect, useState } from "react";
import { Warning, X } from "@phosphor-icons/react";
import { StatusPill } from "@/components/ui/pills";
import { apiFetch, apiSend } from "@/lib/api-client";
import { meldung } from "@/lib/api-fehler";

type Person = {
  id: string;
  name: string;
  rolle: string;
  isstMittag: boolean;
  posten: { id: string; name: string }[];
};

type CrewEintrag = {
  id: string;
  rolle: string;
  person: { id: string; name: string; rolle: string; isstMittag: boolean };
};

type PostenCrewProps = {
  gameId: string;
  gameName: string;
  bedarfSchiedsrichter: number;
  bedarfHelfer: number;
};

const ROLLEN_KURZ: Record<string, string> = {
  SCHIEDSRICHTER: "SR",
  HELFER: "H",
  ORGA: "Orga",
  ADMIN: "Admin",
  OWNER: "Owner",
};

/**
 * Zuteilung von Schiedsrichtern und Helfern zu diesem Posten.
 *
 * Zugeteilt wird hier — einmal pro Posten, nicht mehr Slot für Slot. Daraus
 * entstehen der Einsatzplan und die Mittagswelle der Crew: der Posten pausiert
 * genau dann, wenn seine Leute essen.
 */
export function PostenCrew({
  gameId,
  gameName,
  bedarfSchiedsrichter,
  bedarfHelfer,
}: PostenCrewProps) {
  const [crew, setCrew] = useState<CrewEintrag[]>([]);
  const [personen, setPersonen] = useState<Person[]>([]);
  const [laden, setLaden] = useState(true);
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const laenden = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([
        apiFetch<CrewEintrag[]>(`/api/games/${gameId}/crew`),
        apiFetch<Person[]>("/api/persons?rolle=SCHIEDSRICHTER,HELFER,ORGA"),
      ]);
      setCrew(c);
      setPersonen(p);
      setFehler(null);
    } catch (err) {
      setFehler(meldung(err, "Posten-Crew konnte nicht geladen werden."));
    } finally {
      setLaden(false);
    }
  }, [gameId]);

  useEffect(() => {
    void laenden();
  }, [laenden]);

  const setzen = async (personIds: string[]) => {
    setSpeichert(true);
    setFehler(null);
    try {
      setCrew(await apiSend<CrewEintrag[]>(`/api/games/${gameId}/crew`, "PUT", { personIds }));
    } catch (err) {
      setFehler(meldung(err, "Zuteilung konnte nicht gespeichert werden."));
    } finally {
      setSpeichert(false);
    }
  };

  const zugeteilt = crew.map((c) => c.person.id);
  const schiedsrichter = crew.filter((c) => c.person.rolle === "SCHIEDSRICHTER").length;
  const helfer = crew.length - schiedsrichter;
  const unterbesetzt =
    schiedsrichter < bedarfSchiedsrichter || helfer < bedarfHelfer;

  return (
    <section className="space-y-4 rounded-[10px] border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="cg-label">Posten-Crew</h2>
        <StatusPill tone={schiedsrichter < bedarfSchiedsrichter ? "warn" : "done"}>
          <span className="tnum">
            {schiedsrichter}/{bedarfSchiedsrichter}
          </span>
          <span className="ml-1">Schiedsrichter</span>
        </StatusPill>
        <StatusPill tone={helfer < bedarfHelfer ? "warn" : "done"}>
          <span className="tnum">
            {helfer}/{bedarfHelfer}
          </span>
          <span className="ml-1">Helfer</span>
        </StatusPill>
        {speichert && <span className="text-[11px] text-ink-3">Speichert&hellip;</span>}
      </div>

      <p className="text-xs text-ink-3">
        Wer hier steht, betreut &bdquo;{gameName}&ldquo; den ganzen Tag. Daraus
        entstehen der Einsatzplan und die Mittagswelle &mdash; der Posten
        pausiert genau dann, wenn seine Crew isst.
      </p>

      {fehler && (
        <div className="flex items-start gap-2.5 rounded-[10px] border border-[var(--hot-border)] bg-hot-dim/50 px-3.5 py-2.5 text-[13px] text-ink-2">
          <Warning size={15} weight="bold" className="mt-0.5 shrink-0 text-hot-tint" />
          <span>{fehler}</span>
        </div>
      )}

      {unterbesetzt && !laden && (
        <div className="flex items-start gap-2.5 rounded-[10px] border border-[var(--warn-border)] bg-warn-dim px-3.5 py-2.5 text-[13px] text-ink-2">
          <Warning size={15} weight="bold" className="mt-0.5 shrink-0 text-warn" />
          <span>
            Unterbesetzt &mdash; ben&ouml;tigt werden{" "}
            <span className="tnum">{bedarfSchiedsrichter}</span> Schiedsrichter
            und <span className="tnum">{bedarfHelfer}</span> Helfer.
          </span>
        </div>
      )}

      {laden ? (
        <p className="text-sm text-ink-3">L&auml;dt&hellip;</p>
      ) : (
        <PersonenAuswahl
          personen={personen}
          gewaehlt={zugeteilt}
          eigenerPosten={gameId}
          disabled={speichert}
          onChange={setzen}
        />
      )}
    </section>
  );
}

function PersonenAuswahl({
  personen,
  gewaehlt,
  eigenerPosten,
  disabled,
  onChange,
}: {
  personen: Person[];
  gewaehlt: string[];
  eigenerPosten: string;
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [suche, setSuche] = useState("");

  const ausgewaehlt = personen.filter((p) => gewaehlt.includes(p.id));

  // Wer schon einem anderen Posten zugeteilt ist, taucht hier gar nicht erst
  // auf — doppelte Zuteilung ist nicht erlaubt. Verschieben heisst: zuerst am
  // alten Posten rausnehmen, dann taucht die Person hier auf.
  const belegtAnderswo = personen.filter(
    (p) => !gewaehlt.includes(p.id) && p.posten.some((x) => x.id !== eigenerPosten),
  ).length;

  const sortiert = personen
    .filter((p) => !gewaehlt.includes(p.id))
    .filter((p) => !p.posten.some((x) => x.id !== eigenerPosten))
    .filter((p) => p.name.toLowerCase().includes(suche.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-3">
      <div className="flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-[9px] border border-line-strong bg-sunken px-2 py-1.5">
        {ausgewaehlt.length === 0 && (
          <span className="px-1 text-sm text-faint">Noch niemand zugeteilt</span>
        )}
        {ausgewaehlt.map((p) => (
          <span
            key={p.id}
            className="inline-flex h-7 items-center gap-1.5 rounded-full bg-action-dim px-2.5 text-xs font-medium text-action-tint"
          >
            {p.name}
            <span className="text-[10px] uppercase tracking-[0.06em] opacity-70">
              {ROLLEN_KURZ[p.rolle] ?? p.rolle}
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(gewaehlt.filter((id) => id !== p.id))}
              className="text-action-tint transition-colors duration-150 hover:text-hot-tint"
              aria-label={`${p.name} entfernen`}
            >
              <X size={12} weight="bold" />
            </button>
          </span>
        ))}
      </div>

      <input
        type="search"
        value={suche}
        onChange={(e) => setSuche(e.target.value)}
        placeholder="Person suchen..."
        className="h-[34px] w-full max-w-xs rounded-[9px] border border-line-strong bg-sunken px-3 text-[13px] text-ink outline-none transition-colors duration-150 placeholder:text-label focus:border-action"
      />

      {personen.length === 0 ? (
        <p className="text-xs text-ink-3">
          Noch keine Schiedsrichter oder Helfer erfasst &mdash; lege sie unter
          &bdquo;Benutzer&ldquo; an.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {sortiert.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange([...gewaehlt, p.id])}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line-strong px-2.5 text-xs text-ink-2 transition-colors duration-150 hover:border-action hover:text-ink disabled:opacity-50"
            >
              + {p.name}
              <span className="text-[10px] uppercase tracking-[0.06em] opacity-70">
                {ROLLEN_KURZ[p.rolle] ?? p.rolle}
              </span>
            </button>
          ))}
          {sortiert.length === 0 && (
            <span className="text-xs text-ink-3">Alle passenden Personen zugeteilt.</span>
          )}
        </div>
      )}

      {belegtAnderswo > 0 && (
        <p className="text-xs text-ink-3">
          {belegtAnderswo} weitere {belegtAnderswo === 1 ? "Person ist" : "Personen sind"}{" "}
          bereits einem anderen Posten zugeteilt und daher hier ausgeblendet.
        </p>
      )}
    </div>
  );
}
