import AsyncStorage from '@react-native-async-storage/async-storage';
import { createErgebnis, type ErgebnisCreate } from '@workspace/api-client-react';

/**
 * Offline queue for referee score submissions.
 *
 * Entries are persisted in AsyncStorage and retried automatically until the
 * server accepts them. Every entry carries a client-generated `commitId`
 * (idempotency key), so a retry after a dropped connection can never create
 * a duplicate result on the server.
 */

export type PendingErgebnis = {
  /** Idempotency key, doubles as queue entry id. */
  commitId: string;
  gameId: string;
  teamId: string;
  gameName: string;
  teamName: string;
  slug: string;
  rohdaten: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

const STORAGE_KEY = 'cg26-pending-ergebnisse';
const RETRY_INTERVAL_MS = 15_000;

type Listener = (queue: PendingErgebnis[]) => void;

let cache: PendingErgebnis[] | null = null;
let listeners: Listener[] = [];
let flushing = false;
let timer: ReturnType<typeof setInterval> | null = null;

export function makeCommitId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** A network-level failure (no HTTP response). HTTP errors from the API are ApiError. */
export function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'ApiError') {
    // Gateway/service hiccups are safe to retry thanks to idempotent submit.
    const status = (err as unknown as { status?: number }).status ?? 0;
    return status === 408 || status === 429 || status >= 500;
  }
  return true; // TypeError "Network request failed" / "Failed to fetch", aborts, etc.
}

async function load(): Promise<PendingErgebnis[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as PendingErgebnis[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function save(queue: PendingErgebnis[]) {
  cache = queue;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Persistence failure: keep the in-memory queue so retries still happen.
  }
  listeners.forEach((l) => l(queue));
}

export async function getQueue(): Promise<PendingErgebnis[]> {
  return load();
}

export function subscribeQueue(listener: Listener): () => void {
  listeners.push(listener);
  load().then(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export async function enqueueErgebnis(
  entry: Omit<PendingErgebnis, 'createdAt' | 'attempts'>,
): Promise<void> {
  const queue = await load();
  // Replace an existing pending entry for the same game/team (latest wins).
  const rest = queue.filter((e) => !(e.gameId === entry.gameId && e.teamId === entry.teamId));
  await save([...rest, { ...entry, createdAt: Date.now(), attempts: 0 }]);
  startAutoFlush();
}

export async function removeEntry(commitId: string): Promise<void> {
  const queue = await load();
  await save(queue.filter((e) => e.commitId !== commitId));
}

/**
 * Try to submit every queued entry. Successful entries are removed; failed
 * ones stay queued with an updated attempt count / error message.
 * Returns the number of entries that were synced.
 */
export async function flushQueue(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let synced = 0;
  try {
    const queue = await load();
    for (const entry of [...queue]) {
      try {
        const data: ErgebnisCreate = {
          gameId: entry.gameId,
          teamId: entry.teamId,
          rohdaten: entry.rohdaten,
          commitId: entry.commitId,
        };
        await createErgebnis(data);
        await removeEntry(entry.commitId);
        synced++;
      } catch (err) {
        const current = await load();
        await save(
          current.map((e) =>
            e.commitId === entry.commitId
              ? {
                  ...e,
                  attempts: e.attempts + 1,
                  lastError: err instanceof Error ? err.message : 'Unbekannter Fehler',
                }
              : e,
          ),
        );
        if (isNetworkError(err)) {
          // Still offline — no point trying the remaining entries right now.
          break;
        }
        // Permanent server rejection (4xx): keep the entry so the referee
        // sees the error, but continue with the others.
      }
    }
  } finally {
    flushing = false;
    const remaining = await load();
    if (remaining.length === 0) stopAutoFlush();
  }
  return synced;
}

function startAutoFlush() {
  if (timer) return;
  timer = setInterval(() => {
    void flushQueue();
  }, RETRY_INTERVAL_MS);
  // On web, retry immediately when the browser reports connectivity again.
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('online', onOnline);
  }
}

function stopAutoFlush() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
    window.removeEventListener('online', onOnline);
  }
}

function onOnline() {
  void flushQueue();
}

/** Resume retries for anything left over from a previous session. */
export async function initOfflineQueue(): Promise<void> {
  const queue = await load();
  if (queue.length > 0) {
    startAutoFlush();
    void flushQueue();
  }
}
