// Offline-Warteschlange für Schiedsrichter-Ergebnisse.
//
// Einträge werden in localStorage persistiert und automatisch erneut
// übermittelt, bis der Server sie annimmt. Jeder Eintrag trägt eine
// client-generierte commitId (Idempotenz-Schlüssel), damit ein Retry nach
// Verbindungsabbruch serverseitig nie ein Duplikat erzeugen kann.

export type PendingErgebnis = {
  /** Idempotenz-Schlüssel, dient zugleich als Queue-Eintrags-ID. */
  commitId: string;
  gameId: string;
  teamId: string;
  zeitplanSlotId: string | null;
  gameName: string;
  teamName: string;
  rohdaten: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

const STORAGE_KEY = "cg26-pending-ergebnisse";
const RETRY_INTERVAL_MS = 15_000;

type Listener = (queue: PendingErgebnis[]) => void;

let listeners: Listener[] = [];
let flushing = false;
let timer: ReturnType<typeof setInterval> | null = null;

/** Netzwerk-Fehler (kein HTTP-Response) oder retry-sicherer Serverfehler. */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/** Ersetzt einen bestehenden Eintrag für dasselbe Game/Team (der neuste gewinnt). */
export function upsertEntry(
  queue: PendingErgebnis[],
  entry: PendingErgebnis,
): PendingErgebnis[] {
  const rest = queue.filter(
    (e) => !(e.gameId === entry.gameId && e.teamId === entry.teamId),
  );
  return [...rest, entry];
}

function load(): PendingErgebnis[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingErgebnis[]) : [];
  } catch {
    return [];
  }
}

function save(queue: PendingErgebnis[]) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {
      // Persistenz-Fehler: Listener trotzdem informieren, Retries laufen weiter.
    }
  }
  listeners.forEach((l) => l(queue));
}

export function getQueue(): PendingErgebnis[] {
  return load();
}

export function subscribeQueue(listener: Listener): () => void {
  listeners.push(listener);
  listener(load());
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function enqueueErgebnis(
  entry: Omit<PendingErgebnis, "createdAt" | "attempts">,
): void {
  const queue = load();
  save(upsertEntry(queue, { ...entry, createdAt: Date.now(), attempts: 0 }));
  startAutoFlush();
}

export function removeEntry(commitId: string): void {
  save(load().filter((e) => e.commitId !== commitId));
}

/**
 * Versucht alle Einträge zu übermitteln. Erfolgreiche werden entfernt,
 * fehlgeschlagene bleiben mit aktualisiertem Versuchszähler in der Queue.
 * Gibt die Anzahl synchronisierter Einträge zurück.
 */
export async function flushQueue(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let synced = 0;
  try {
    for (const entry of load()) {
      try {
        const res = await fetch("/api/ergebnisse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameId: entry.gameId,
            teamId: entry.teamId,
            zeitplanSlotId: entry.zeitplanSlotId,
            rohdaten: entry.rohdaten,
            commitId: entry.commitId,
          }),
        });

        if (res.ok) {
          removeEntry(entry.commitId);
          synced++;
          continue;
        }

        const data = await res.json().catch(() => null);
        markFailed(entry.commitId, data?.error ?? `HTTP ${res.status}`);
        if (isRetryableStatus(res.status)) {
          // Server nicht erreichbar/überlastet — restliche Einträge später versuchen.
          break;
        }
        // Endgültige Ablehnung (4xx): Eintrag bleibt sichtbar, weiter mit den anderen.
      } catch (err) {
        // Netzwerkfehler — weiterhin offline, Rest der Queue später versuchen.
        markFailed(
          entry.commitId,
          err instanceof Error ? err.message : "Keine Verbindung",
        );
        break;
      }
    }
  } finally {
    flushing = false;
    if (load().length === 0) stopAutoFlush();
  }
  return synced;
}

function markFailed(commitId: string, lastError: string) {
  save(
    load().map((e) =>
      e.commitId === commitId ? { ...e, attempts: e.attempts + 1, lastError } : e,
    ),
  );
}

function startAutoFlush() {
  if (timer || typeof window === "undefined") return;
  timer = setInterval(() => {
    void flushQueue();
  }, RETRY_INTERVAL_MS);
  window.addEventListener("online", onOnline);
}

function stopAutoFlush() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (typeof window !== "undefined") {
    window.removeEventListener("online", onOnline);
  }
}

function onOnline() {
  void flushQueue();
}

/** Retries für Einträge aus einer früheren Session wieder aufnehmen. */
export function initOfflineQueue(): void {
  if (load().length > 0) {
    startAutoFlush();
    void flushQueue();
  }
}
