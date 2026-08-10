/**
 * Struktur-Validierung der Schiedsrichter-Rohdaten an der API-Grenze.
 *
 * Für die strukturierten Wertungstypen (Listen/Objekte) wird die Form geprüft,
 * damit fehlerhafte Eingaben mit einer klaren Meldung abgewiesen werden statt
 * still als 0 Punkte gewertet zu werden. Die flachen Bestandstypen bleiben
 * bewusst tolerant (Freitext-Felder, optionale Keys).
 */

import { z } from "zod/v4";
import type { Wertungslogik } from "@/lib/wertungslogik-types";

const zahlMin0 = z.number().min(0);

const KleinbegegnungenRohSchema = z.looseObject({
  kleinbegegnungen: z
    .array(z.looseObject({ eigene: zahlMin0, gegner: zahlMin0 }))
    .min(1, "Mindestens eine Kleinbegegnung erfassen"),
});

const RundenRohSchema = z.looseObject({
  runden: z
    .array(z.looseObject({ baelle: zahlMin0, strafpunkte: zahlMin0 }))
    .min(1, "Mindestens eine Runde erfassen"),
});

/**
 * zeit ohne eigene Eingabefelder: Ohne erfasste Zeit würden 0 Sekunden als
 * Bestzeit gewertet (richtung niedrigster_gewinnt) — deshalb eine Zeit > 0
 * oder ein DNF verlangen. Legacy-Games mit eingabefeldern bleiben ungeprüft.
 */
function validiereZeit(
  wertungslogik: Wertungslogik,
  rohdaten: Record<string, unknown>,
): RohdatenValidierung {
  if (wertungslogik.eingabefelder?.length) return { ok: true };
  const dnf = rohdaten.nicht_geschafft === true || rohdaten.geschafft === false;
  if (dnf) return { ok: true };
  const zeit = Number(rohdaten.zeit_sekunden ?? rohdaten.durchgang_1);
  if (Number.isFinite(zeit) && zeit > 0) return { ok: true };
  return { ok: false, fehler: "Zeit erfassen oder «Nicht geschafft» wählen" };
}

/**
 * Fixe Listen-Längen: Das Protokoll verlangt genau `wl.runden` Runden bzw.
 * genau einen Eintrag pro konfiguriertem Turm. Null-Ergebnisse (alle Werte 0)
 * bleiben gültig — nur die Länge muss stimmen.
 */
function pruefeExakteLaenge(
  wertungslogik: Wertungslogik,
  rohdaten: Record<string, unknown>,
): RohdatenValidierung {
  if (wertungslogik.typ === "runden_strafpunkte" && wertungslogik.runden !== undefined) {
    const anzahl = Array.isArray(rohdaten.runden) ? rohdaten.runden.length : 0;
    if (anzahl !== wertungslogik.runden) {
      return { ok: false, fehler: `Genau ${wertungslogik.runden} Runden erfassen` };
    }
  }
  if (wertungslogik.typ === "tuerme_punkte" && wertungslogik.tuerme !== undefined) {
    const soll = wertungslogik.tuerme.length;
    const anzahl = Array.isArray(rohdaten.tuerme) ? rohdaten.tuerme.length : 0;
    if (anzahl !== soll) {
      return {
        ok: false,
        fehler: soll === 1 ? "Genau 1 Turm erfassen" : `Genau ${soll} Türme erfassen`,
      };
    }
  }
  return { ok: true };
}

const TuermeRohSchema = z.looseObject({
  tuerme: z
    .array(z.looseObject({ sektionen: zahlMin0, bonus: zahlMin0 }))
    .min(1, "Mindestens einen Turm erfassen"),
});

const SiegZuegeRohSchema = z.looseObject({
  siege: zahlMin0,
  zuege: zahlMin0,
});

export type RohdatenValidierung =
  | { ok: true }
  | { ok: false; fehler: string };

/**
 * Prüft die Rohdaten gegen die Struktur, die der Wertungstyp erwartet.
 * Unbekannte oder flache Typen gelten als gültig (Bestandsverhalten).
 */
export function validiereRohdaten(
  wertungslogik: Wertungslogik | null,
  rohdaten: Record<string, unknown>,
): RohdatenValidierung {
  if (!wertungslogik) return { ok: true };

  if (wertungslogik.typ === "zeit") {
    return validiereZeit(wertungslogik, rohdaten);
  }

  const schema = {
    duell_kleinbegegnungen: KleinbegegnungenRohSchema,
    runden_strafpunkte: RundenRohSchema,
    tuerme_punkte: TuermeRohSchema,
    sieg_zuege: SiegZuegeRohSchema,
  }[wertungslogik.typ];

  if (!schema) return { ok: true };

  const result = schema.safeParse(rohdaten);
  if (result.success) {
    return pruefeExakteLaenge(wertungslogik, rohdaten);
  }

  const issue = result.error.issues[0];
  const pfad = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  return { ok: false, fehler: `Ungültige Rohdaten — ${pfad}${issue.message}` };
}
