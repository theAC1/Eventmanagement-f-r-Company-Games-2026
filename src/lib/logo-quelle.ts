/**
 * Reine Regeln rund um Logo-Adressen — ohne Netz, ohne Dateisystem.
 *
 * Hintergrund: Team-Logos wurden als fremde URL gespeichert und direkt vom
 * Server der Firma geladen. Auf dem Bildschirm ging das gut, im Badge-Export
 * nicht: Der Export zeichnet auf eine Canvas und muss die Bilder deshalb mit
 * `crossOrigin="anonymous"` laden (sonst ist die Canvas "tainted" und der
 * PNG-Export stirbt). Wer keinen `Access-Control-Allow-Origin`-Header schickt
 * — und das sind die meisten Firmen-Webserver — liefert das Bild dann gar
 * nicht mehr aus, und auf dem Badge stand statt des Logos die Startnummer.
 *
 * Die Lösung: Logos einmal auf unseren Server holen und von dort ausliefern.
 * Gleicher Origin heisst kein CORS, kein Hotlink-Schutz und keine Abhängigkeit
 * vom fremden Server, wenn am Eventtag die Badges gedruckt werden.
 *
 * Dieses Modul enthält die Entscheidungen, `logo-import.ts` die Ausführung.
 */

/** Präfix, unter dem der eigene Server hochgeladene Bilder ausliefert. */
export const UPLOAD_PREFIX = "/api/uploads/";

/** Liegt das Bild schon bei uns? Dann ist nichts zu holen. */
export function istLokalerPfad(url: string): boolean {
  return url.startsWith(UPLOAD_PREFIX);
}

/** Absolute http(s)-Adresse mit Hostnamen — alles andere kann niemand laden. */
export function istAbsoluteHttpUrl(wert: string): boolean {
  try {
    const url = new URL(wert);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.length > 0;
  } catch {
    return false;
  }
}

/** Bild-Adresse, die wir speichern dürfen: lokal oder absolut http(s). */
export function istGueltigeBildUrl(wert: string): boolean {
  return istLokalerPfad(wert) || istAbsoluteHttpUrl(wert);
}

// ─── Dateitypen ───

const ENDUNG_NACH_TYP: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

/**
 * Endung zum Content-Type der Antwort — `null`, wenn wir den Typ nicht
 * ausliefern können. Bewusst nach Content-Type statt nach Endung in der URL:
 * viele Logo-Adressen tragen gar keine Endung (`/media/12345`), und was der
 * Server sagt, ist verlässlicher als was in der Adresse steht.
 */
export function endungFuerContentType(contentType: string | null): string | null {
  if (!contentType) return null;
  const typ = contentType.split(";")[0].trim().toLowerCase();
  return ENDUNG_NACH_TYP[typ] ?? null;
}

export function istSvg(contentTypeOderEndung: string): boolean {
  const wert = contentTypeOderEndung.toLowerCase();
  return wert.startsWith("image/svg") || wert === ".svg";
}

// ─── SVG aufbereiten ───

const SVG_TAG = /<svg\b[^>]*>/i;

/**
 * Ergänzt fehlende `width`/`height` aus der `viewBox`.
 *
 * Warum das nötig ist: Der Badge-Export rechnet "objectFit: contain" von Hand
 * über `naturalWidth`/`naturalHeight`. Ein SVG ohne feste Grösse liefert dort
 * je nach Browser 0 oder einen Standardwert — das Logo würde ins Quadrat
 * gequetscht. Mit Grösse am Tag stimmt das Seitenverhältnis überall.
 *
 * Es wird nur ergänzt, was fehlt: ein doppeltes Attribut wäre ungültiges XML
 * und der Browser würde das ganze Bild verwerfen.
 */
export function svgGroesseErgaenzen(svg: string): string {
  const treffer = svg.match(SVG_TAG);
  if (!treffer) return svg;

  const tag = treffer[0];
  const hatBreite = /\swidth\s*=/i.test(tag);
  const hatHoehe = /\sheight\s*=/i.test(tag);
  if (hatBreite && hatHoehe) return svg;

  const viewBox = tag.match(/\sviewBox\s*=\s*["']([^"']+)["']/i);
  if (!viewBox) return svg;

  const zahlen = viewBox[1].trim().split(/[\s,]+/).map(Number);
  if (zahlen.length !== 4 || zahlen.some((n) => !Number.isFinite(n))) return svg;

  const [, , breite, hoehe] = zahlen;
  if (breite <= 0 || hoehe <= 0) return svg;

  const zusatz = `${hatBreite ? "" : ` width="${breite}"`}${hatHoehe ? "" : ` height="${hoehe}"`}`;
  const ergaenzt = tag.replace(/^<svg\b/i, (s) => `${s}${zusatz}`);
  // Ersetzungs-Funktion statt String: sonst würde ein `$` im Original
  // (etwa in einer eingebetteten Data-URI) als Ersetzungsmuster gelesen.
  return svg.replace(tag, () => ergaenzt);
}

/**
 * Entfernt aktive Inhalte aus einem fremden SVG.
 *
 * Als `<img>` eingebunden führt ein SVG ohnehin nichts aus — gefährlich wäre
 * nur der direkte Aufruf der Bild-Adresse im Browser. Die eigentliche Grenze
 * dafür ist der CSP-Header in `GET /api/uploads/[name]`; das hier ist die
 * zweite Schicht und bewusst grob: lieber ein Stück zu viel entfernt als ein
 * Skript im Bild.
 */
export function svgBereinigen(svg: string): string {
  return svg
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*\/>/gi, "")
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(?:xlink:)?href\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, "");
}

/** Fremdes SVG in die Form bringen, in der wir es ausliefern. */
export function svgAufbereiten(svg: string): string {
  return svgGroesseErgaenzen(svgBereinigen(svg));
}

// ─── Netz-Grenzen (SSRF-Schutz) ───

function istPrivateIpv4(ip: string): boolean {
  const teile = ip.split(".").map(Number);
  if (teile.length !== 4 || teile.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true; // Unlesbar heisst: nicht freigeben.
  }
  const [a, b] = teile;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // Link-local, u.a. Cloud-Metadaten
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 + 192.0.2.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // Benchmark-Netze
  if (a === 100 && b >= 64 && b <= 127) return true; // Carrier-NAT
  if (a >= 224) return true; // Multicast und reserviert
  return false;
}

/**
 * Zeigt die Adresse ins eigene Netz? Dann darf der Server sie nicht abrufen —
 * sonst wird das Logo-Feld zum Fernrohr in unsere Docker-Umgebung
 * (Datenbank, Metadaten-Dienste, Nachbar-Container).
 */
export function istPrivateAdresse(ip: string): boolean {
  const wert = ip.trim().toLowerCase();
  if (wert.length === 0) return true;

  // IPv4-in-IPv6 (::ffff:10.0.0.1) auf den v4-Teil zurückführen.
  const eingebettet = wert.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (eingebettet) return istPrivateIpv4(eingebettet[1]);

  if (wert.includes(":")) {
    if (wert === "::" || wert === "::1") return true;
    if (/^f[cd][0-9a-f]{2}:/.test(wert)) return true; // Unique-local fc00::/7
    if (/^fe[89ab][0-9a-f]:/.test(wert)) return true; // Link-local fe80::/10
    if (/^ff[0-9a-f]{2}:/.test(wert)) return true; // Multicast
    return false;
  }

  return istPrivateIpv4(wert);
}
