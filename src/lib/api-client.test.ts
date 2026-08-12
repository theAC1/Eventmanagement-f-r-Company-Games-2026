import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, apiSend, aufDatenAenderung, meldeDatenAenderung } from "./api-client";

type FetchAufruf = [input: string, init?: RequestInit];

function antwort(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  // jsdom-freier Ersatz: die Event-Helfer brauchen nur addEventListener/dispatchEvent.
  const hoerer = new Map<string, Set<EventListener>>();
  globalThis.window = {
    addEventListener: (typ: string, fn: EventListener) => {
      if (!hoerer.has(typ)) hoerer.set(typ, new Set());
      hoerer.get(typ)!.add(fn);
    },
    removeEventListener: (typ: string, fn: EventListener) => hoerer.get(typ)?.delete(fn),
    dispatchEvent: (ev: Event) => {
      hoerer.get(ev.type)?.forEach((fn) => fn(ev));
      return true;
    },
  } as unknown as Window & typeof globalThis;
  globalThis.Event = class {
    constructor(public type: string) {}
  } as unknown as typeof Event;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  // @ts-expect-error Testaufbau zurückräumen
  delete globalThis.window;
});

describe("apiFetch", () => {
  it("gibt den Rumpf einer erfolgreichen Antwort zurück", async () => {
    globalThis.fetch = vi.fn(async () => antwort(200, { id: "t1" })) as typeof fetch;
    await expect(apiFetch("/api/teams")).resolves.toEqual({ id: "t1" });
  });

  it("wirft mit der Begründung der API", async () => {
    globalThis.fetch = vi.fn(async () =>
      antwort(409, { error: "Team hat Ergebnisse" }),
    ) as typeof fetch;
    await expect(apiFetch("/api/teams/t1", { method: "DELETE" })).rejects.toThrow(
      "Team hat Ergebnisse",
    );
  });

  it("wirft mit dem Statuscode, wenn die API nichts erklärt", async () => {
    globalThis.fetch = vi.fn(async () => antwort(500, null)) as typeof fetch;
    await expect(apiFetch("/api/teams")).rejects.toThrow("Fehler 500");
  });

  it("meldet Änderungen nur bei schreibenden Aufrufen", async () => {
    const gemeldet = vi.fn();
    const ab = aufDatenAenderung(gemeldet);

    globalThis.fetch = vi.fn(async () => antwort(200, {})) as typeof fetch;
    await apiFetch("/api/teams");
    expect(gemeldet).not.toHaveBeenCalled();

    await apiFetch("/api/teams", { method: "POST" });
    expect(gemeldet).toHaveBeenCalledTimes(1);

    ab();
    await apiFetch("/api/teams", { method: "POST" });
    expect(gemeldet).toHaveBeenCalledTimes(1);
  });
});

describe("apiSend", () => {
  it("setzt Methode, Header und Body", async () => {
    const gerufen = vi.fn(async () => antwort(201, { ok: true }));
    globalThis.fetch = gerufen as unknown as typeof fetch;

    await apiSend("/api/teams", "POST", { name: "Alpha" });

    expect(gerufen).toHaveBeenCalledWith(
      "/api/teams",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Alpha" }),
      }),
    );
  });

  it("lässt den Body weg, wenn es keinen gibt", async () => {
    const gerufen = vi.fn(async () => antwort(200, {}));
    globalThis.fetch = gerufen as unknown as typeof fetch;

    await apiSend("/api/teams/t1", "DELETE");

    const [, init] = gerufen.mock.calls[0] as unknown as FetchAufruf;
    expect(init?.body).toBeUndefined();
    expect(init?.method).toBe("DELETE");
  });
});

describe("meldeDatenAenderung", () => {
  it("läuft ohne Fenster durch (Server-Rendering)", () => {
    // @ts-expect-error Serverfall nachstellen
    delete globalThis.window;
    expect(() => meldeDatenAenderung()).not.toThrow();
    expect(aufDatenAenderung(() => {})()).toBeUndefined();
  });
});
