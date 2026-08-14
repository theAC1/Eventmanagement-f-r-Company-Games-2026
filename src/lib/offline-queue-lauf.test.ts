/**
 * Verhalten der Offline-Warteschlange im Betrieb — mit localStorage und
 * Netzwerk als Attrappe.
 *
 * Die reinen Helfer stehen in offline-queue.test.ts. Hier geht es um das, was
 * am Turniertag zählt: nichts geht verloren, nichts wird doppelt geschickt,
 * und ein überlasteter Server bringt die Warteschlange nicht durcheinander.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueueErgebnis,
  flushQueue,
  getQueue,
  initOfflineQueue,
  removeEntry,
  entryKey,
  subscribeQueue,
} from "./offline-queue";

const STORAGE_KEY = "cg26-pending-ergebnisse";

function eintrag(nr: number) {
  return {
    commitId: `commit-${nr}`,
    gameId: `game-${nr}`,
    teamId: `team-${nr}`,
    zeitplanSlotId: null,
    gameName: `Game ${nr}`,
    teamName: `Team ${nr}`,
    rohdaten: { punkte: nr },
  };
}

function antwort(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

let speicher: Map<string, string>;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  speicher = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k: string) => speicher.get(k) ?? null,
      setItem: (k: string, v: string) => void speicher.set(k, v),
      removeItem: (k: string) => void speicher.delete(k),
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as Window & typeof globalThis;
  vi.useFakeTimers();
});

afterEach(async () => {
  // Warteschlange leeren, damit der Auto-Retry-Timer stoppt
  for (const e of getQueue()) removeEntry(entryKey(e));
  vi.useRealTimers();
  globalThis.fetch = originalFetch;
  // @ts-expect-error Testaufbau zurückräumen
  delete globalThis.window;
});

describe("enqueueErgebnis / getQueue", () => {
  it("legt einen Eintrag ab und liest ihn wieder", () => {
    enqueueErgebnis(eintrag(1));
    const queue = getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].commitId).toBe("commit-1");
    expect(queue[0].attempts).toBe(0);
    expect(queue[0].createdAt).toBeGreaterThan(0);
  });

  it("ersetzt einen Eintrag für dasselbe Game und Team", () => {
    enqueueErgebnis(eintrag(1));
    enqueueErgebnis({ ...eintrag(1), commitId: "commit-neu", rohdaten: { punkte: 9 } });
    expect(getQueue()).toHaveLength(1);
    expect(getQueue()[0].rohdaten).toEqual({ punkte: 9 });
  });

  it("überlebt kaputte Daten im Speicher, statt die Seite mitzureissen", () => {
    speicher.set(STORAGE_KEY, "{kein json");
    expect(getQueue()).toEqual([]);
  });
});

describe("subscribeQueue", () => {
  it("meldet den aktuellen Stand sofort und bei jeder Änderung", () => {
    const gesehen: number[] = [];
    const ab = subscribeQueue((q) => gesehen.push(q.length));

    expect(gesehen).toEqual([0]);
    enqueueErgebnis(eintrag(1));
    expect(gesehen).toEqual([0, 1]);

    ab();
    enqueueErgebnis(eintrag(2));
    expect(gesehen).toEqual([0, 1]);
  });
});

describe("flushQueue", () => {
  it("schickt jeden Eintrag mit seiner commitId als Idempotenz-Schlüssel", async () => {
    const gerufen = vi.fn(async () => antwort(201));
    globalThis.fetch = gerufen as unknown as typeof fetch;

    enqueueErgebnis(eintrag(1));
    const synced = await flushQueue();

    expect(synced).toBe(1);
    expect(getQueue()).toEqual([]);
    const [, init] = gerufen.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.commitId).toBe("commit-1");
    expect(body.gameId).toBe("game-1");
  });

  it("behält abgelehnte Einträge und merkt sich den Grund", async () => {
    globalThis.fetch = vi.fn(async () =>
      antwort(409, { error: "Ergebnis bereits verifiziert" }),
    ) as unknown as typeof fetch;

    enqueueErgebnis(eintrag(1));
    expect(await flushQueue()).toBe(0);

    const [offen] = getQueue();
    expect(offen.attempts).toBe(1);
    expect(offen.lastError).toBe("Ergebnis bereits verifiziert");
    // Endgültig abgelehnt: bleibt sichtbar, wird aber nicht mehr gesendet.
    expect(offen.abgelehnt).toBe(true);
  });

  it("REGRESSION: eine Duell-Einreichung verliert das Partnerteam nicht", async () => {
    // Beide Teams einer Duell-Begegnung werden mit DERSELBEN commitId
    // eingereiht (die Duell-Route findet darüber das Partner-Ergebnis).
    // Wird der erste Eintrag nach erfolgreicher Übermittlung entfernt, darf
    // das Ergebnis des Partnerteams nicht mitverschwinden.
    const geschickt: string[] = [];
    globalThis.fetch = vi.fn(async (_url: unknown, init: unknown) => {
      const body = JSON.parse((init as { body: string }).body);
      geschickt.push(body.teamId);
      return antwort(201);
    }) as unknown as typeof fetch;

    enqueueErgebnis({ ...eintrag(1), commitId: "duell-commit", teamId: "team-a" });
    enqueueErgebnis({ ...eintrag(1), commitId: "duell-commit", teamId: "team-b" });
    expect(getQueue()).toHaveLength(2);

    expect(await flushQueue()).toBe(2);
    expect(geschickt).toEqual(["team-a", "team-b"]);
    expect(getQueue()).toHaveLength(0);
  });

  it("sendet endgültig abgelehnte Einträge nicht erneut", async () => {
    const gerufen = vi.fn(async () => antwort(409, { error: "abgelehnt" }));
    globalThis.fetch = gerufen as unknown as typeof fetch;

    enqueueErgebnis(eintrag(1));
    await flushQueue();
    expect(gerufen).toHaveBeenCalledTimes(1);

    // Zweiter Durchlauf darf den abgelehnten Eintrag nicht nochmals schicken —
    // sonst läuft auf dem Handy dauerhaft ein zweckloser Retry.
    await flushQueue();
    expect(gerufen).toHaveBeenCalledTimes(1);
    expect(getQueue()).toHaveLength(1);
  });

  it("arbeitet nach einer endgültigen Ablehnung weiter", async () => {
    let aufruf = 0;
    globalThis.fetch = vi.fn(async () => {
      aufruf++;
      // 403 = Korrekturfrist abgelaufen: endgültig, ein Retry kann nie helfen.
      return aufruf === 1 ? antwort(403, { error: "Korrekturfrist abgelaufen" }) : antwort(201);
    }) as unknown as typeof fetch;

    enqueueErgebnis(eintrag(1));
    enqueueErgebnis(eintrag(2));

    expect(await flushQueue()).toBe(1);
    expect(getQueue().map((e) => e.commitId)).toEqual(["commit-1"]);
  });

  it("hält bei einem vorübergehenden 4xx an, statt das Ergebnis wegzuwerfen", async () => {
    // 400 "Kein aktiver Gameday" tritt auf, während die Orga den Gameday
    // umschaltet — Sekunden später geht dieselbe Eingabe durch. Solche
    // Antworten dürfen den Eintrag NICHT endgültig abweisen.
    globalThis.fetch = vi.fn(async () =>
      antwort(400, { error: "Kein aktiver Gameday" }),
    ) as unknown as typeof fetch;

    enqueueErgebnis(eintrag(1));
    expect(await flushQueue()).toBe(0);

    const [offen] = getQueue();
    expect(offen.abgelehnt).toBeUndefined();
    expect(offen.lastError).toBe("Kein aktiver Gameday");
  });

  it("hält bei einem überlasteten Server an, statt hinterherzufeuern", async () => {
    const gerufen = vi.fn(async () => antwort(503));
    globalThis.fetch = gerufen as unknown as typeof fetch;

    enqueueErgebnis(eintrag(1));
    enqueueErgebnis(eintrag(2));

    expect(await flushQueue()).toBe(0);
    // Nur der erste Eintrag wurde versucht — der Rest wartet auf den Retry
    expect(gerufen).toHaveBeenCalledTimes(1);
    expect(getQueue()).toHaveLength(2);
    expect(getQueue()[0].lastError).toBe("HTTP 503");
  });

  it("hält bei fehlender Verbindung an und merkt sich die Meldung", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("Failed to fetch");
    }) as unknown as typeof fetch;

    enqueueErgebnis(eintrag(1));
    enqueueErgebnis(eintrag(2));

    expect(await flushQueue()).toBe(0);
    expect(getQueue()[0].lastError).toBe("Failed to fetch");
    expect(getQueue()).toHaveLength(2);
  });

  it("läuft nicht zweimal gleichzeitig", async () => {
    let freigeben: (r: Response) => void = () => {};
    globalThis.fetch = vi.fn(
      () => new Promise<Response>((resolve) => { freigeben = resolve; }),
    ) as unknown as typeof fetch;

    enqueueErgebnis(eintrag(1));
    const ersterLauf = flushQueue();
    // Zweiter Aufruf während der erste noch offen ist
    expect(await flushQueue()).toBe(0);

    freigeben(antwort(201));
    expect(await ersterLauf).toBe(1);
  });

  it("tut nichts bei leerer Warteschlange", async () => {
    const gerufen = vi.fn(async () => antwort(201));
    globalThis.fetch = gerufen as unknown as typeof fetch;
    expect(await flushQueue()).toBe(0);
    expect(gerufen).not.toHaveBeenCalled();
  });
});

describe("removeEntry", () => {
  it("entfernt genau den einen Eintrag", () => {
    enqueueErgebnis(eintrag(1));
    enqueueErgebnis(eintrag(2));
    removeEntry(entryKey(eintrag(1)));
    expect(getQueue().map((e) => e.commitId)).toEqual(["commit-2"]);
  });
});

describe("initOfflineQueue", () => {
  it("nimmt Einträge aus einer früheren Sitzung wieder auf", async () => {
    const gerufen = vi.fn(async () => antwort(201));
    globalThis.fetch = gerufen as unknown as typeof fetch;

    // Stand aus einer früheren Sitzung
    speicher.set(
      STORAGE_KEY,
      JSON.stringify([{ ...eintrag(1), createdAt: 1, attempts: 2 }]),
    );

    initOfflineQueue();
    await vi.waitFor(() => expect(gerufen).toHaveBeenCalled());
  });

  it("startet nichts, wenn nichts offen ist", () => {
    const gerufen = vi.fn(async () => antwort(201));
    globalThis.fetch = gerufen as unknown as typeof fetch;
    initOfflineQueue();
    expect(gerufen).not.toHaveBeenCalled();
  });
});
