/**
 * Ein Weg, die API aufzurufen — mit Fehlerprüfung und Nachricht ans UI.
 *
 * Zwei Dinge passierten vorher an jeder Aufrufstelle einzeln (oder gar nicht):
 * `res.ok` prüfen und die Oberfläche über die Änderung informieren. Beides
 * steckt jetzt hier, damit kein Aufruf es vergessen kann.
 */

import { fehlerText } from "@/lib/api-fehler";

/** Signal an alle Ansichten: die Datenlage hat sich geändert. */
export const DATEN_EVENT = "cg:daten-geaendert";

/** Nach jeder erfolgreichen Änderung — Navigation und Listen ziehen nach. */
export function meldeDatenAenderung(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DATEN_EVENT));
}

/** Auf Datenänderungen hören; gibt die Abmelde-Funktion zurück. */
export function aufDatenAenderung(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(DATEN_EVENT, handler);
  return () => window.removeEventListener(DATEN_EVENT, handler);
}

/**
 * GET/POST/PUT/DELETE mit Klartext-Fehler. Wirft bei jedem Nicht-2xx-Status,
 * damit ein fehlgeschlagener Aufruf nicht als Erfolg durchgeht.
 */
export async function apiFetch<T>(
  url: string,
  init?: RequestInit & { fehlerText?: string },
): Promise<T> {
  const { fehlerText: fallback, ...request } = init ?? {};
  const res = await fetch(url, request);
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(fehlerText(data, fallback ?? `Fehler ${res.status}`));
  }

  const methode = (request.method ?? "GET").toUpperCase();
  if (methode !== "GET") meldeDatenAenderung();

  return data as T;
}

/** Kurzform für schreibende Aufrufe mit JSON-Body. */
export function apiSend<T>(
  url: string,
  methode: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
  fehlerTextFallback?: string,
): Promise<T> {
  return apiFetch<T>(url, {
    method: methode,
    ...(body !== undefined
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : {}),
    fehlerText: fehlerTextFallback,
  });
}
