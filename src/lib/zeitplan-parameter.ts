/**
 * Vergleich der Zeitplan-Parameter zwischen gespeichertem Stand und aktueller
 * Eingabe. Damit sieht die Orga vor dem Aktualisieren genau, was sich ändert —
 * statt nur "es ist etwas anders".
 */

export type MittagspauseParameter = {
  nachRunde: number;
  dauerMin: number;
  maxTeamsGleichzeitig: number;
  versatzMin: number;
};

export type ZeitplanParameter = {
  blockDauerMin: number;
  wechselzeitMin: number;
  startZeit: string;
  mittagspause: MittagspauseParameter | null;
};

export type ParameterAenderung = {
  /** Technischer Schlüssel, eindeutig pro Zeile (React-Key). */
  feld: string;
  label: string;
  von: string;
  nach: string;
};

const MITTAG_FELDER: {
  key: keyof MittagspauseParameter;
  label: string;
  einheit: string;
}[] = [
  { key: "nachRunde", label: "Mittagspause nach Runde", einheit: "" },
  { key: "dauerMin", label: "Mittagspause Dauer", einheit: " min" },
  { key: "maxTeamsGleichzeitig", label: "Mittagspause max. Teams", einheit: "" },
  { key: "versatzMin", label: "Mittagspause Versatz", einheit: " min" },
];

/**
 * Welche Parameter unterscheiden sich? Leeres Array = identisch.
 */
export function parameterDiff(
  basis: ZeitplanParameter,
  aktuell: ZeitplanParameter,
): ParameterAenderung[] {
  const aenderungen: ParameterAenderung[] = [];

  if (basis.blockDauerMin !== aktuell.blockDauerMin) {
    aenderungen.push({
      feld: "blockDauerMin",
      label: "Blockdauer",
      von: `${basis.blockDauerMin} min`,
      nach: `${aktuell.blockDauerMin} min`,
    });
  }

  if (basis.wechselzeitMin !== aktuell.wechselzeitMin) {
    aenderungen.push({
      feld: "wechselzeitMin",
      label: "Wechselzeit",
      von: `${basis.wechselzeitMin} min`,
      nach: `${aktuell.wechselzeitMin} min`,
    });
  }

  if (basis.startZeit !== aktuell.startZeit) {
    aenderungen.push({
      feld: "startZeit",
      label: "Startzeit",
      von: basis.startZeit,
      nach: aktuell.startZeit,
    });
  }

  const basisMittag = basis.mittagspause;
  const aktuellMittag = aktuell.mittagspause;

  if (!basisMittag !== !aktuellMittag) {
    aenderungen.push({
      feld: "mittagspause",
      label: "Mittagspause",
      von: basisMittag ? "aktiv" : "aus",
      nach: aktuellMittag ? "aktiv" : "aus",
    });
    return aenderungen;
  }

  if (basisMittag && aktuellMittag) {
    for (const { key, label, einheit } of MITTAG_FELDER) {
      if (basisMittag[key] !== aktuellMittag[key]) {
        aenderungen.push({
          feld: `mittagspause.${key}`,
          label,
          von: `${basisMittag[key]}${einheit}`,
          nach: `${aktuellMittag[key]}${einheit}`,
        });
      }
    }
  }

  return aenderungen;
}

/** Kurzform von {@link parameterDiff} für Dirty-Anzeigen. */
export function istGeaendert(
  basis: ZeitplanParameter,
  aktuell: ZeitplanParameter,
): boolean {
  return parameterDiff(basis, aktuell).length > 0;
}

/** Takt = Blockdauer + Wechselzeit, die Länge eines vollen Rundenschritts. */
export function taktMin(parameter: ZeitplanParameter): number {
  return parameter.blockDauerMin + parameter.wechselzeitMin;
}
