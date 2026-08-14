// Offline-Warteschlange für Schiedsrichter-Ergebnisse.
//
// Einträge werden in localStorage persistiert und automatisch erneut
// übermittelt, bis der Server sie annimmt. Jeder Eintrag trägt eine
// client-generierte commitId (Idempotenz-Schlüssel), damit ein Retry nach
// Verbindungsabbruch serverseitig nie ein Duplikat erzeugen kann.
//
// Achtung: Die commitId identifiziert die EINREICHUNG, nicht den Eintrag —
// bei einem Duell hängen beide Teams an derselben. Innerhalb der Queue wird
// deshalb konsequent über {@link entryKey} (Game + Team) adressiert.

export type PendingErgebnis = {
  /**
   * Idempotenz-Schlüssel für den Server — bei einer Duell-Begegnung tragen
   * BEIDE Teams denselben Wert (darüber findet die Duell-Route das
   * Partner-Ergebnis). Er ist also bewusst NICHT eindeutig pro Eintrag und
   * darf nie als Queue-Schlüssel benutzt werden — siehe {@link entryKey}.
   */
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
  /**
   * Endgültig vom Server abgelehnt (4xx) — wird nicht mehr erneut gesendet.
   *
   * Der Eintrag bleibt trotzdem erhalten: Ihn stillschweigend zu löschen würde
   * ein erfasstes Resultat verschwinden lassen, ihn weiter zu senden würde das
   * Handy dauerhaft "wartet auf Übermittlung" anzeigen. Beides ist falsch —
   * also aufbewahren und als abgelehnt kennzeichnen.
   */
  abgelehnt?: boolean;
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

/**
 * Endgültige Ablehnung — ein erneuter Versuch kann nie gelingen.
 *
 * Bewusst eine kurze Positivliste statt "alles ausser retryable": 401 (Sitzung
 * abgelaufen, nach dem nächsten Login wieder gültig) und 400 "Kein aktiver
 * Gameday" (die Orga schaltet den Gameday gerade um) sehen aus wie
 * Client-Fehler, sind aber vorübergehend. Würden sie als endgültig gelten,
 * wäre das erfasste Ergebnis verloren, obwohl es Sekunden später
 * durchgegangen wäre.
 */
export function isPermanentStatus(status: number): boolean {
  return status === 403 || status === 404 || status === 409 || status === 410;
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

/**
 * Eindeutiger Schlüssel eines Queue-Eintrags.
 *
 * Game + Team ist die echte Identität eines Eintrags (upsertEntry dedupliziert
 * genau danach, und die Datenbank hat denselben Unique-Key). Die commitId taugt
 * dafür NICHT: Bei einer Duell-Begegnung werden beide Teams mit derselben
 * commitId eingereiht — ein Löschen darüber hätte das Ergebnis des Partnerteams
 * gleich mitgelöscht, sobald das erste Team erfolgreich übermittelt war.
 */
export function entryKey(entry: Pick<PendingErgebnis, "gameId" | "teamId">): string {
  return `${entry.gameId}:${entry.teamId}`;
}

export function removeEntry(key: string): void {
  save(load().filter((e) => entryKey(e) !== key));
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
    // Endgültig abgelehnte Einträge bleiben liegen, werden aber nicht mehr
    // gesendet — sonst liefe alle 15 s ein Versuch, der nie gelingen kann.
    for (const entry of load().filter((e) => !e.abgelehnt)) {
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
          removeEntry(entryKey(entry));
          synced++;
          continue;
        }

        const data = await res.json().catch(() => null);
        const grund = data?.error ?? `HTTP ${res.status}`;
        if (isPermanentStatus(res.status)) {
          // Endgültige Ablehnung (abgelaufene Korrekturfrist, fremdes
          // Ergebnis, vom Reset gelöschtes Spiel): Weitere Versuche sind
          // zwecklos, der Eintrag bleibt aber als Beleg sichtbar.
          markFailed(entryKey(entry), grund, true);
          continue;
        }
        // Alles andere (Serverfehler, Überlast, abgelaufene Sitzung, gerade
        // umgeschalteter Gameday) kann beim nächsten Anlauf klappen.
        markFailed(entryKey(entry), grund);
        break;
      } catch (err) {
        // Netzwerkfehler — weiterhin offline, Rest der Queue später versuchen.
        markFailed(
          entryKey(entry),
          err instanceof Error ? err.message : "Keine Verbindung",
        );
        break;
      }
    }
  } finally {
    flushing = false;
    // Nur noch abgelehnte Einträge übrig? Dann gibt es nichts mehr zu senden.
    if (load().every((e) => e.abgelehnt)) stopAutoFlush();
  }
  return synced;
}

function markFailed(key: string, lastError: string, abgelehnt = false) {
  save(
    load().map((e) =>
      entryKey(e) === key
        ? { ...e, attempts: e.attempts + 1, lastError, ...(abgelehnt ? { abgelehnt } : {}) }
        : e,
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
