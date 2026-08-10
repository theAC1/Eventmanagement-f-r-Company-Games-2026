import { ArrowsClockwise, CheckCircle, FloppyDisk, Warning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/pills";
import type { ParameterAenderung } from "@/lib/zeitplan-parameter";
import { GeladenerZeitplan } from "./types";

type ZeitplanAktionenProps = {
  /** Gespeicherter Plan, an dem gerade gearbeitet wird — null bei einer frischen Vorschau. */
  geladen: GeladenerZeitplan | null;
  name: string;
  loading: boolean;
  /** Es liegt ein generiertes (noch nicht gespeichertes) Ergebnis vor. */
  hatVorschau: boolean;
  aenderungen: ParameterAenderung[];
  gesperrt: boolean;
  sperrGrund: string | null;
  statusMsg: string | null;
  onNameChange: (val: string) => void;
  onAktualisieren: () => void;
  onSpeichernNeu: () => void;
  onAktivieren: () => void;
};

const INPUT_CLASS =
  "h-[38px] min-w-[200px] flex-1 rounded-[9px] border border-line-strong bg-sunken px-3 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-faint focus:border-action disabled:opacity-50";

export function ZeitplanAktionen({
  geladen,
  name,
  loading,
  hatVorschau,
  aenderungen,
  gesperrt,
  sperrGrund,
  statusMsg,
  onNameChange,
  onAktualisieren,
  onSpeichernNeu,
  onAktivieren,
}: ZeitplanAktionenProps) {
  const nameFehlt = name.trim().length === 0;
  // Der Neuaufbau kann auch ohne Gameday blockiert sein (QR-Scans am Plan).
  const neuaufbauGesperrt = gesperrt || geladen?.sperre.neuaufbauErlaubt === false;
  const grund = sperrGrund ?? geladen?.sperre.grund ?? null;
  const warnungen = geladen?.sperre.warnungen ?? [];

  return (
    <section className="space-y-3.5 rounded-[10px] border border-line bg-surface p-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="cg-label shrink-0">
          {geladen ? "Geladener Zeitplan" : "Neuer Zeitplan"}
        </span>
        {geladen?.istAktiv && <StatusPill tone="done">Aktiv</StatusPill>}

        <input
          type="text"
          value={name}
          disabled={gesperrt}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Name f&uuml;r diesen Zeitplan..."
          className={INPUT_CLASS}
        />

        {geladen && (
          <Button
            variant="primary"
            onClick={onAktualisieren}
            disabled={loading || nameFehlt || neuaufbauGesperrt}
            title={
              neuaufbauGesperrt && grund
                ? grund
                : "Zeitplan mit den aktuellen Parametern neu berechnen und speichern"
            }
          >
            <ArrowsClockwise size={15} weight="bold" />
            {loading ? "Aktualisiert..." : "Zeitplan aktualisieren"}
          </Button>
        )}

        <Button
          variant={geladen ? "ghost" : "primary"}
          onClick={onSpeichernNeu}
          disabled={loading || nameFehlt || gesperrt || (!geladen && !hatVorschau)}
        >
          <FloppyDisk size={15} weight="bold" />
          {geladen ? "Als neuen Plan speichern" : "Speichern"}
        </Button>

        {geladen && !geladen.istAktiv && (
          <Button variant="ghost" onClick={onAktivieren} disabled={loading || gesperrt}>
            Aktivieren
          </Button>
        )}

        {statusMsg && (
          <span className="flex items-center gap-1.5 text-[13px] text-done-tint">
            <CheckCircle size={15} weight="bold" />
            {statusMsg}
          </span>
        )}
      </div>

      {geladen && aenderungen.length > 0 && (
        <AenderungsListe aenderungen={aenderungen} />
      )}

      {geladen && !geladen.istAktiv && (
        <p className="text-[11px] text-ink-3">
          Dieser Plan ist nicht aktiv — Leitstand, Einsatzplan und Team-Ansicht
          arbeiten mit dem aktiven Zeitplan.
        </p>
      )}

      {warnungen.length > 0 && !neuaufbauGesperrt && (
        <div className="flex items-start gap-2.5 rounded-[10px] border border-[var(--warn-border)] bg-warn-dim px-3.5 py-2.5">
          <Warning size={15} weight="bold" className="mt-0.5 shrink-0 text-warn" />
          <div className="space-y-0.5 text-[12px] text-ink-2">
            <p className="font-semibold">Beim Aktualisieren wird der Zeitplan neu aufgebaut:</p>
            {warnungen.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        </div>
      )}

      {neuaufbauGesperrt && grund && (
        <div className="flex items-start gap-2.5 rounded-[10px] border border-[var(--hot-border)] bg-hot-dim/50 px-3.5 py-2.5">
          <Warning size={15} weight="bold" className="mt-0.5 shrink-0 text-hot-tint" />
          <p className="text-[12px] text-ink-2">{grund}</p>
        </div>
      )}
    </section>
  );
}

function AenderungsListe({ aenderungen }: { aenderungen: ParameterAenderung[] }) {
  return (
    <div className="space-y-1.5 rounded-[10px] border border-line bg-action-row px-3.5 py-2.5">
      <p className="text-[12px] font-semibold text-ink">
        Ge&auml;nderte Parameter{" "}
        <span className="tnum text-ink-3">({aenderungen.length})</span> — noch
        nicht gespeichert
      </p>
      {aenderungen.map((a) => (
        <p key={a.feld} className="text-[12px] text-ink-2">
          {a.label}: <span className="tnum text-ink-3">{a.von}</span>{" "}
          <span className="text-faint">&rarr;</span>{" "}
          <span className="tnum font-medium text-ink">{a.nach}</span>
        </p>
      ))}
    </div>
  );
}
