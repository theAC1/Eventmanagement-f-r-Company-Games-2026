/**
 * Vergleich der Zeitplan-Parameter zwischen gespeichertem Stand und aktueller
 * Eingabe. Damit sieht die Orga vor dem Aktualisieren genau, was sich ändert —
 * statt nur "es ist etwas anders".
 */

export type MittagsfensterParameter = {
  von: string;
  bis: string;
  dauerMin: number;
  teamsProWelle: number;
  versatzMin: number;
};

export type ZeitplanParameter = {
  blockDauerMin: number;
  wechselzeitMin: number;
  startZeit: string;
  /** Spätestes Turnierende; null = kein Fenster gesetzt. */
  fensterEndeZeit: string | null;
  /** Ziel-Posten vor der eigenen Mittagswelle; null = Automatik. */
  postenVormittag: number | null;
  mittagsfenster: MittagsfensterParameter | null;
};

export type ParameterAenderung = {
  /** Technischer Schlüssel, eindeutig pro Zeile (React-Key). */
  feld: string;
  label: string;
  von: string;
  nach: string;
};

type FeldBeschreibung<T> = {
  key: keyof T;
  label: string;
  einheit?: string;
};

const BASIS_FELDER: FeldBeschreibung<ZeitplanParameter>[] = [
  { key: "blockDauerMin", label: "Blockdauer", einheit: " min" },
  { key: "wechselzeitMin", label: "Wechselzeit", einheit: " min" },
  { key: "startZeit", label: "Turnierstart" },
  { key: "fensterEndeZeit", label: "Turnierende (spätestens)" },
  { key: "postenVormittag", label: "Posten vor dem Mittag" },
];

const MITTAG_FELDER: FeldBeschreibung<MittagsfensterParameter>[] = [
  { key: "von", label: "Mittagsfenster ab" },
  { key: "bis", label: "Mittagsfenster bis" },
  { key: "dauerMin", label: "Essenszeit pro Gruppe", einheit: " min" },
  { key: "teamsProWelle", label: "Teams pro Welle" },
  { key: "versatzMin", label: "Versatz zwischen Wellen", einheit: " min" },
];

/** null/undefined wird als "nicht gesetzt" angezeigt, nie als leerer String. */
function anzeige(wert: unknown, einheit = ""): string {
  if (wert === null || wert === undefined || wert === "") return "nicht gesetzt";
  return `${wert}${einheit}`;
}

/**
 * Welche Parameter unterscheiden sich? Leeres Array = identisch.
 */
export function parameterDiff(
  basis: ZeitplanParameter,
  aktuell: ZeitplanParameter,
): ParameterAenderung[] {
  const aenderungen: ParameterAenderung[] = [];

  for (const { key, label, einheit } of BASIS_FELDER) {
    if (basis[key] !== aktuell[key]) {
      aenderungen.push({
        feld: String(key),
        label,
        von: anzeige(basis[key], einheit),
        nach: anzeige(aktuell[key], einheit),
      });
    }
  }

  const basisMittag = basis.mittagsfenster;
  const aktuellMittag = aktuell.mittagsfenster;

  if (!basisMittag !== !aktuellMittag) {
    aenderungen.push({
      feld: "mittagsfenster",
      label: "Mittagsfenster",
      von: basisMittag ? "aktiv" : "aus",
      nach: aktuellMittag ? "aktiv" : "aus",
    });
    return aenderungen;
  }

  if (basisMittag && aktuellMittag) {
    for (const { key, label, einheit } of MITTAG_FELDER) {
      if (basisMittag[key] !== aktuellMittag[key]) {
        aenderungen.push({
          feld: `mittagsfenster.${key}`,
          label,
          von: anzeige(basisMittag[key], einheit),
          nach: anzeige(aktuellMittag[key], einheit),
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
