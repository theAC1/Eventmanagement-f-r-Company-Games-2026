/**
 * Reine Logik hinter dem persistenten Ansichts-Zustand (Filter, Suche,
 * zugeklappte Gruppen, aktiver Tab, Scrollposition).
 *
 * Bewusst frei von React und `window`, damit sie im node-Testlauf pruefbar ist —
 * die Anbindung an den sessionStorage passiert in `src/hooks/use-view-state.ts`.
 */

const VIEW_PREFIX = "cg26:view:";
const SCROLL_PREFIX = "cg26:scroll:";

/** Storage-Schluessel fuer den Ansichts-Zustand einer Seite, z.B. "admin:materials". */
export function viewStateKey(id: string): string {
  return `${VIEW_PREFIX}${id}`;
}

/** Storage-Schluessel fuer die Scrollposition einer Seite. */
export function scrollKey(id: string): string {
  return `${SCROLL_PREFIX}${id}`;
}

type Primitive = string | number | boolean | null;

function isPrimitive(value: unknown): value is Primitive {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/**
 * Passt der gespeicherte Wert zur Form des Standardwerts?
 *
 * Der Storage ist eine Systemgrenze: Inhalte koennen aus einer aelteren
 * App-Version stammen oder von Hand manipuliert sein. Nur formgleiche Werte
 * werden uebernommen, alles andere faellt auf den Standardwert zurueck.
 */
function isCompatible(defaultValue: unknown, storedValue: unknown): boolean {
  if (defaultValue === null) return isPrimitive(storedValue);
  if (Array.isArray(defaultValue)) {
    return Array.isArray(storedValue) && storedValue.every(isPrimitive);
  }
  if (!isPrimitive(defaultValue)) return false;
  return typeof defaultValue === typeof storedValue;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Liest einen gespeicherten Ansichts-Zustand und legt ihn ueber die Standardwerte.
 *
 * Unbekannte Schluessel werden verworfen, unpassende Werte einzeln ignoriert —
 * ein kaputter Eintrag kostet also hoechstens einen Filter, nie die ganze Seite.
 * Gibt immer ein neues Objekt zurueck, das Original bleibt unberuehrt.
 */
export function parseViewState<T extends object>(
  raw: string | null | undefined,
  defaults: T,
): T {
  if (!raw) return { ...defaults };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Beschaedigter Eintrag (abgebrochener Schreibvorgang, fremde Daten):
    // bewusst auf die Standardansicht zurueckfallen statt die Seite zu blockieren.
    return { ...defaults };
  }

  if (!isPlainObject(parsed)) return { ...defaults };

  const result = { ...defaults } as Record<string, unknown>;
  for (const key of Object.keys(defaults)) {
    if (!Object.prototype.hasOwnProperty.call(parsed, key)) continue;
    const stored = parsed[key];
    if (isCompatible(result[key], stored)) {
      result[key] = Array.isArray(stored) ? [...stored] : stored;
    }
  }
  return result as T;
}

/** Serialisiert den Ansichts-Zustand fuer den Storage. */
export function serializeViewState<T extends object>(state: T): string {
  return JSON.stringify(state);
}

/**
 * Liest eine gespeicherte Scrollposition.
 * Alles was keine endliche, nicht-negative Zahl ist, gilt als "kein Wert" (0).
 */
export function parseScrollY(raw: string | null | undefined): number {
  if (!raw) return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value);
}

/**
 * Schaltet einen Schluessel in einer Liste um — z.B. eine zugeklappte Gruppe.
 * Gibt immer eine neue Liste zurueck.
 */
export function toggleInList(list: readonly string[], key: string): string[] {
  return list.includes(key)
    ? list.filter((entry) => entry !== key)
    : [...list, key];
}
