/**
 * Rohdaten-Aufbereitung für die Bestätigungs- und Anzeige-Screens:
 * pro Wertungstyp verständliche Label/Wert-Zeilen.
 */

import {
  berechneTuermeMaximum,
  berechneTurmPunkte,
  parseKleinbegegnungen,
  parseRunden,
  parseTuerme,
} from "@/lib/game-punkte-berechnung";
import { ZEIT_DNF_SENTINEL, type Wertungslogik } from "@/lib/wertungslogik-types";
import { formatSekundenMSS } from "./format";

export type RohdatenZeile = { label: string; value: string };

export function formatRohdaten(
  rohdaten: Record<string, unknown>,
  wl: Wertungslogik | null,
): RohdatenZeile[] {
  if (!wl) return [];
  const items: RohdatenZeile[] = [];

  // Eingabefelder (max_value, formel, punkte_duell, sieg_zuege, …)
  for (const f of wl.eingabefelder ?? []) {
    if (rohdaten[f.name] !== undefined) {
      items.push({ label: f.label ?? f.name, value: String(rohdaten[f.name]) });
    }
  }

  // Zeit: m:ss, bei "nicht geschafft" die Maximalzeit, Sentinel 99999 als DNF
  if (wl.typ === "zeit") {
    if (rohdaten.nicht_geschafft === true && wl.maxSekunden !== undefined) {
      items.push({
        label: "Zeit",
        value: `${formatSekundenMSS(wl.maxSekunden)} · nicht geschafft`,
      });
    } else if (rohdaten.zeit_sekunden !== undefined) {
      const sek = Number(rohdaten.zeit_sekunden);
      items.push({
        label: "Zeit",
        value: sek === ZEIT_DNF_SENTINEL ? "DNF" : `${formatSekundenMSS(sek)} min`,
      });
    }
  }

  // Kleinbegegnungen (Cornhole): eine Zeile pro Begegnung
  if (wl.typ === "duell_kleinbegegnungen") {
    parseKleinbegegnungen(rohdaten).forEach((kb, i) => {
      items.push({ label: `Begegnung ${i + 1}`, value: `${kb.eigene} : ${kb.gegner}` });
    });
  }

  // Runden + Strafpunkte (ChaosQuadrant)
  if (wl.typ === "runden_strafpunkte") {
    const runden = parseRunden(rohdaten);
    runden.forEach((r, i) => {
      items.push({
        label: `Runde ${i + 1}`,
        value: `${r.baelle} Bälle · ${r.strafpunkte} Strafpunkte`,
      });
    });
    if (runden.length > 0) {
      const total = runden.reduce((summe, r) => summe + r.baelle + r.strafpunkte, 0);
      items.push({ label: "Total", value: `${total} Punkte` });
    }
  }

  // Türme (Robert Huber Radio): Teilpunkte inkl. abgeleitetem 100%-Bonus
  if (wl.typ === "tuerme_punkte" && wl.tuerme?.length) {
    const roh = parseTuerme(rohdaten);
    let gesamt = 0;
    wl.tuerme.forEach((config, i) => {
      const wert = roh[i] ?? { sektionen: 0, bonus: 0 };
      const punkte = berechneTurmPunkte(wert, config);
      gesamt += punkte;
      const teile = [`${wert.sektionen}/${config.sektionen} Sektionen`];
      if (config.bonus > 0) {
        teile.push(`${wert.bonus}/${config.bonus} ${config.bonusLabel ?? "Bonusklötze"}`);
      }
      items.push({ label: config.name, value: `${teile.join(" · ")} → ${punkte} P` });
    });
    items.push({ label: "Total", value: `${gesamt} / ${berechneTuermeMaximum(wl.tuerme)} P` });
  }

  // Level
  if (wl.typ === "multi_level" && rohdaten.level) {
    items.push({ label: "Level", value: String(rohdaten.level) });
  }

  // Option + Erfolg
  if (wl.typ === "risiko_wahl") {
    if (rohdaten.option) items.push({ label: "Wahl", value: String(rohdaten.option) });
    if (rohdaten.erfolg !== undefined) {
      items.push({ label: "Erfolg", value: rohdaten.erfolg ? "Ja" : "Nein" });
    }
  }

  // Strafen (Zähler × Sekunden)
  if (wl.strafen) {
    for (const [key, sek] of Object.entries(wl.strafen)) {
      const count = Number(rohdaten[key] ?? 0);
      if (count > 0) {
        items.push({
          label: key.replace(/_/g, " "),
          value: `${count}x (+${count * sek}s)`,
        });
      }
    }
  }

  // Nicht geschafft (ausser die Zeit-Zeile zeigt es bereits an)
  if (
    rohdaten.nicht_geschafft === true &&
    !(wl.typ === "zeit" && wl.maxSekunden !== undefined)
  ) {
    items.push({ label: "Status", value: "Nicht geschafft" });
  }

  return items;
}
