/**
 * Fehlerantworten der API in einen Satz übersetzen, den die Orga versteht.
 *
 * Der Auslöser: Löschen scheiterte still. Die Route antwortete mit 409 und
 * einer Begründung, die Oberfläche prüfte `res.ok` nicht und lud die
 * unveränderte Liste neu — für den Benutzer sah es aus, als passiere nichts.
 *
 * Reine Funktionen, damit jede Seite dieselbe Übersetzung benutzt.
 */

export type ApiFehlerAntwort = {
  error?: string;
  details?: { field?: string; message?: string }[];
};

/** Zod-Details zu einer Zeile zusammenziehen. */
function detailText(details: ApiFehlerAntwort["details"]): string {
  if (!Array.isArray(details)) return "";
  return details
    .map((d) => (d.field ? `${d.field}: ${d.message ?? ""}` : (d.message ?? "")))
    .filter((t) => t.length > 0)
    .join("; ");
}

/** Extrahiert den Klartext-Grund (error + Zod-details) aus einer Fehlerantwort. */
export function fehlerText(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const { error, details } = data as ApiFehlerAntwort;
    const detail = detailText(details);
    if (error && detail) return `${error} — ${detail}`;
    if (error) return error;
    if (detail) return detail;
  }
  return fallback;
}

/** Fehler jeder Herkunft (Error, String, unbekannt) auf einen Satz bringen. */
export function meldung(fehler: unknown, fallback = "Unbekannter Fehler"): string {
  if (fehler instanceof Error && fehler.message) return fehler.message;
  if (typeof fehler === "string" && fehler.length > 0) return fehler;
  return fallback;
}
