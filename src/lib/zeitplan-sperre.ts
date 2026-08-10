/**
 * Schutzregeln für den Zeitplan.
 *
 * Zwei unabhängige Sperren:
 *
 * 1. Gameday-Sperre — sobald ein Gameday (TEST oder HOT) läuft, darf der
 *    Zeitplan nicht mehr strukturell verändert, aktiviert oder gelöscht
 *    werden. Am laufenden Tag hängen Einsatzplan, Zeitachse, QR-Scans und
 *    Ergebnisse an konkreten Slot-IDs; ein Neuaufbau würde sie entwerten.
 *
 * 2. Abhängigkeits-Sperre — ein Zeitplan, an dessen Slots bereits QR-Scans
 *    hängen, kann auch ausserhalb eines Gamedays nicht neu aufgebaut werden
 *    (QRVerifikation.zeitplanSlotId ist NOT NULL, das Löschen der Slots würde
 *    an der Fremdschlüssel-Restriktion scheitern).
 *
 * Reine Funktionen ohne DB-Zugriff, damit sie testbar bleiben.
 */

/** Was am Zeitplan geändert werden soll. */
export type ZeitplanAenderung =
  | "STRUKTUR" // Slots neu aufbauen (generieren/aktualisieren)
  | "AKTIVIERUNG" // anderen Plan als aktiv setzen
  | "NAME" // nur umbenennen
  | "LOESCHEN";

export type SperrEntscheid = {
  erlaubt: boolean;
  /** Klartext für die UI; null wenn erlaubt. */
  grund: string | null;
};

/** Abhängigkeiten, die an den Slots eines Zeitplans hängen. */
export type ZeitplanAbhaengigkeiten = {
  /** QR-Verifikationen — harte Blockade, Fremdschlüssel ist NOT NULL. */
  qrScans: number;
  /** Ergebnisse mit Slot-Referenz — Referenz ginge beim Neuaufbau verloren. */
  ergebnisse: number;
  /** Schiedsrichter-/Helfer-Zuweisungen aus dem Einsatzplan. */
  einsaetze: number;
};

export const LEERE_ABHAENGIGKEITEN: ZeitplanAbhaengigkeiten = {
  qrScans: 0,
  ergebnisse: 0,
  einsaetze: 0,
};

const GAMEDAY_GRUND: Record<ZeitplanAenderung, string> = {
  STRUKTUR:
    "Gameday läuft — der Zeitplan ist gesperrt. Beende den Gameday, um ihn neu aufzubauen.",
  AKTIVIERUNG:
    "Gameday läuft — der aktive Zeitplan kann nicht gewechselt werden.",
  NAME: "",
  LOESCHEN: "Gameday läuft — Zeitpläne können nicht gelöscht werden.",
};

/**
 * Läuft ein Gameday? `modus` kommt aus GamedayConfig; null/INAKTIV = kein Gameday.
 */
export function gamedayLaeuft(modus: string | null | undefined): boolean {
  return modus === "TEST" || modus === "HOT";
}

/**
 * Darf die Änderung bei diesem Gameday-Modus ausgeführt werden?
 * Umbenennen bleibt immer erlaubt — es berührt keine Slot-Struktur.
 */
export function pruefeGamedaySperre(
  modus: string | null | undefined,
  aenderung: ZeitplanAenderung,
): SperrEntscheid {
  if (!gamedayLaeuft(modus)) return { erlaubt: true, grund: null };
  if (aenderung === "NAME") return { erlaubt: true, grund: null };
  return { erlaubt: false, grund: GAMEDAY_GRUND[aenderung] };
}

/**
 * Darf die Slot-Struktur angesichts bestehender Abhängigkeiten ersetzt werden?
 * QR-Scans blockieren hart, alles andere ist eine Warnung (siehe {@link warnungen}).
 */
export function pruefeAbhaengigkeiten(
  abh: ZeitplanAbhaengigkeiten,
): SperrEntscheid {
  if (abh.qrScans > 0) {
    return {
      erlaubt: false,
      grund: `Am Zeitplan hängen ${abh.qrScans} QR-Verifikationen. Der Zeitplan kann nicht mehr neu aufgebaut werden — lege stattdessen einen neuen an.`,
    };
  }
  return { erlaubt: true, grund: null };
}

/**
 * Was der Benutzer vor einem Neuaufbau wissen muss (auch wenn er erlaubt ist).
 */
export function warnungen(abh: ZeitplanAbhaengigkeiten): string[] {
  const texte: string[] = [];
  if (abh.einsaetze > 0) {
    texte.push(
      `${abh.einsaetze} Einsatzplan-Zuweisungen (Schiedsrichter/Helfer) gehen verloren.`,
    );
  }
  if (abh.ergebnisse > 0) {
    texte.push(
      `${abh.ergebnisse} bereits erfasste Ergebnisse verlieren ihre Slot-Zuordnung.`,
    );
  }
  return texte;
}

/**
 * Gesamturteil für einen Struktur-Neuaufbau: Gameday zuerst, dann Abhängigkeiten.
 */
export function pruefeNeuaufbau(
  modus: string | null | undefined,
  abh: ZeitplanAbhaengigkeiten,
): SperrEntscheid {
  const gameday = pruefeGamedaySperre(modus, "STRUKTUR");
  if (!gameday.erlaubt) return gameday;
  return pruefeAbhaengigkeiten(abh);
}
