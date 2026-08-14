/**
 * Holt ein fremdes Logo einmalig auf unseren Server.
 *
 * Warum überhaupt: siehe `logo-quelle.ts` — fremd eingebundene Logos fallen im
 * Badge-Export durch die CORS-Prüfung und landen nie im PNG. Nach dem Import
 * liegt das Bild unter `/api/uploads/…`, also auf demselben Origin: kein CORS,
 * kein Hotlink-Schutz, und der Badge-Druck am Eventtag hängt nicht mehr an
 * fremden Webservern.
 *
 * Der Abruf geschieht serverseitig und mit einer vom Benutzer eingegebenen
 * Adresse — deshalb die Absicherungen: nur http(s), keine Adressen ins eigene
 * Netz (auch nicht über eine Weiterleitung), Zeitlimit, Grössenlimit und nur
 * Antworten, die wirklich ein Bild sind.
 */

import { createHash } from "crypto";
import { lookup } from "dns/promises";
import { mkdir, writeFile } from "fs/promises";
import { UPLOADS_DIR, safeUploadPath } from "./uploads";
import {
  UPLOAD_PREFIX,
  endungFuerContentType,
  istAbsoluteHttpUrl,
  istLokalerPfad,
  istPrivateAdresse,
  istSvg,
  svgAufbereiten,
} from "./logo-quelle";

export type LogoErgebnis = { pfad: string } | { fehler: string };

/** Logos sind klein. Alles darüber ist ein Versehen oder ein Angriff. */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

const ZEITLIMIT_MS = 10_000;
const MAX_WEITERLEITUNGEN = 3;

const ABRUF_HEADER = {
  // Manche Server liefern Bilder nur an "richtige" Browser aus. Der Zusatz
  // sagt trotzdem ehrlich, wer fragt.
  "User-Agent": "Mozilla/5.0 (compatible; CompanyGames2026/1.0; +https://games.arvuna.ch)",
  Accept: "image/*,*/*;q=0.8",
};

/** Löst den Hostnamen auf und lässt nur öffentliche Adressen durch. */
async function netzPruefen(hostname: string): Promise<string | null> {
  const host = hostname.replace(/^\[|\]$/g, "");
  try {
    const adressen = await lookup(host, { all: true });
    if (adressen.length === 0) return "Adresse konnte nicht aufgelöst werden";
    // Eine einzige interne Adresse genügt zum Sperren: bei mehreren Einträgen
    // sucht sich der Verbindungsaufbau sonst womöglich genau die aus.
    if (adressen.some((a) => istPrivateAdresse(a.address))) {
      return "Adresse zeigt in ein internes Netz";
    }
    return null;
  } catch {
    return "Adresse konnte nicht aufgelöst werden";
  }
}

function netzFehlerText(fehler: unknown): string {
  const name = fehler instanceof Error ? fehler.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return `Zeitüberschreitung nach ${ZEITLIMIT_MS / 1000} Sekunden`;
  }
  return "Server nicht erreichbar";
}

/**
 * Ruft die Adresse ab und folgt Weiterleitungen von Hand.
 *
 * Von Hand, weil jeder einzelne Sprung wieder gegen interne Netze geprüft
 * werden muss — ein automatisches `redirect: "follow"` würde eine
 * Weiterleitung auf `http://169.254.169.254/` ungeprüft mitmachen.
 */
async function abrufen(start: string): Promise<{ res: Response } | { fehler: string }> {
  let adresse = start;

  for (let sprung = 0; sprung <= MAX_WEITERLEITUNGEN; sprung++) {
    let ziel: URL;
    try {
      ziel = new URL(adresse);
    } catch {
      return { fehler: "Ungültige Adresse" };
    }
    if (ziel.protocol !== "http:" && ziel.protocol !== "https:") {
      return { fehler: "Nur http- und https-Adressen" };
    }

    const netzFehler = await netzPruefen(ziel.hostname);
    if (netzFehler) return { fehler: netzFehler };

    let res: Response;
    try {
      res = await fetch(ziel, {
        redirect: "manual",
        signal: AbortSignal.timeout(ZEITLIMIT_MS),
        // Referer der Zielseite selbst: hebelt den üblichen Hotlink-Schutz aus,
        // der fremde Einbindungen blockt, den Aufruf von der eigenen Seite aber
        // erlaubt.
        headers: { ...ABRUF_HEADER, Referer: ziel.origin },
      });
    } catch (fehler) {
      return { fehler: netzFehlerText(fehler) };
    }

    if (res.status >= 300 && res.status < 400) {
      const ort = res.headers.get("location");
      if (!ort) return { fehler: `Server antwortete mit ${res.status} ohne Weiterleitungsziel` };
      adresse = new URL(ort, ziel).toString();
      continue;
    }

    if (!res.ok) return { fehler: `Server antwortete mit ${res.status}` };
    return { res };
  }

  return { fehler: "Zu viele Weiterleitungen" };
}

/** Liest den Antwortkörper, bricht aber ab, sobald `max` überschritten ist. */
async function bytesLesen(res: Response, max: number): Promise<Buffer | null> {
  const angabe = Number(res.headers.get("content-length"));
  if (Number.isFinite(angabe) && angabe > max) return null;

  const koerper = res.body;
  if (!koerper) {
    const puffer = Buffer.from(await res.arrayBuffer());
    return puffer.byteLength > max ? null : puffer;
  }

  // Stückweise lesen statt arrayBuffer(): ein Server ohne Content-Length
  // könnte sonst beliebig viel in den Speicher schieben.
  const teile: Buffer[] = [];
  let gesamt = 0;
  const leser = koerper.getReader();
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    if (!value) continue;
    gesamt += value.byteLength;
    if (gesamt > max) {
      await leser.cancel().catch(() => {});
      return null;
    }
    teile.push(Buffer.from(value));
  }
  return Buffer.concat(teile);
}

/** Gleiche Adresse → gleicher Dateiname: mehrfaches Speichern legt keine Kopien an. */
function dateiName(url: string, endung: string): string {
  return `logo-${createHash("sha256").update(url).digest("hex").slice(0, 24)}${endung}`;
}

/**
 * Holt das Logo und gibt den lokalen Pfad zurück — oder einen Klartext-Grund,
 * warum es nicht ging. Wirft bewusst nie: ein unerreichbares Logo darf das
 * Speichern eines Teams nicht verhindern.
 */
export async function logoUebernehmen(url: string): Promise<LogoErgebnis> {
  const adresse = url.trim();
  if (adresse.length === 0) return { fehler: "Keine Adresse angegeben" };
  if (istLokalerPfad(adresse)) return { pfad: adresse };
  if (!istAbsoluteHttpUrl(adresse)) {
    return { fehler: "Adresse muss mit https:// oder http:// beginnen" };
  }

  const geholt = await abrufen(adresse);
  if ("fehler" in geholt) return geholt;

  const contentType = geholt.res.headers.get("content-type");
  const endung = endungFuerContentType(contentType);
  if (!endung) {
    return {
      fehler: `Antwort ist kein unterstütztes Bild (${contentType ?? "ohne Typ"}) — PNG, JPG, WEBP, GIF oder SVG nötig`,
    };
  }

  const rohdaten = await bytesLesen(geholt.res, LOGO_MAX_BYTES);
  if (!rohdaten) return { fehler: `Bild ist grösser als ${LOGO_MAX_BYTES / 1024 / 1024} MB` };
  if (rohdaten.byteLength === 0) return { fehler: "Bild ist leer" };

  const inhalt = istSvg(endung)
    ? Buffer.from(svgAufbereiten(rohdaten.toString("utf8")), "utf8")
    : rohdaten;

  const name = dateiName(adresse, endung);
  const ziel = safeUploadPath(name);
  if (!ziel) return { fehler: "Dateiname konnte nicht gebildet werden" };

  try {
    await mkdir(UPLOADS_DIR, { recursive: true });
    await writeFile(ziel, inhalt);
  } catch (fehler) {
    console.error("Logo-Import: Schreiben fehlgeschlagen", fehler);
    return { fehler: "Bild konnte auf dem Server nicht gespeichert werden" };
  }

  return { pfad: `${UPLOAD_PREFIX}${name}` };
}
