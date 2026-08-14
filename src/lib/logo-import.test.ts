import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const lookupMock = vi.hoisted(() => vi.fn());
const writeFileMock = vi.hoisted(() => vi.fn());
const mkdirMock = vi.hoisted(() => vi.fn());

vi.mock("dns/promises", () => ({ lookup: lookupMock }));
vi.mock("fs/promises", () => ({ writeFile: writeFileMock, mkdir: mkdirMock }));

import { logoUebernehmen, LOGO_MAX_BYTES } from "./logo-import";

/** Antwort wie ein echter Server sie schickt. */
function bildAntwort(
  inhalt: string | Uint8Array | ReadableStream,
  contentType = "image/png",
  extra: Record<string, string> = {},
): Response {
  return new Response(inhalt as BodyInit, {
    status: 200,
    headers: { "content-type": contentType, ...extra },
  });
}

function fetchGibt(...antworten: (Response | Error)[]): void {
  const fetchMock = vi.fn();
  for (const antwort of antworten) {
    if (antwort instanceof Error) fetchMock.mockRejectedValueOnce(antwort);
    else fetchMock.mockResolvedValueOnce(antwort);
  }
  vi.stubGlobal("fetch", fetchMock);
}

beforeEach(() => {
  lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  writeFileMock.mockResolvedValue(undefined);
  mkdirMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("logoUebernehmen – Erfolgsfall", () => {
  it("speichert ein PNG lokal und gibt den Upload-Pfad zurück", async () => {
    fetchGibt(bildAntwort(new Uint8Array([137, 80, 78, 71])));

    const ergebnis = await logoUebernehmen("https://meinplatz.ch/storage/logo.png");

    expect(ergebnis).toEqual({ pfad: expect.stringMatching(/^\/api\/uploads\/logo-[0-9a-f]{24}\.png$/) });
    expect(writeFileMock).toHaveBeenCalledOnce();
  });

  it("gibt für dieselbe Adresse denselben Dateinamen — kein Kopien-Wildwuchs", async () => {
    fetchGibt(bildAntwort("a"), bildAntwort("a"));

    const a = await logoUebernehmen("https://meinplatz.ch/logo.png");
    const b = await logoUebernehmen("https://meinplatz.ch/logo.png");

    expect(a).toEqual(b);
  });

  it("übernimmt bereits lokale Pfade unverändert, ohne Netzzugriff", async () => {
    fetchGibt();

    const ergebnis = await logoUebernehmen("/api/uploads/logo-abc.png");

    expect(ergebnis).toEqual({ pfad: "/api/uploads/logo-abc.png" });
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("leitet den Content-Type auf die Endung durch, nicht die Adresse", async () => {
    fetchGibt(bildAntwort("x", "image/jpeg"));

    const ergebnis = await logoUebernehmen("https://firma.ch/media/12345");

    expect(ergebnis).toEqual({ pfad: expect.stringContaining(".jpg") });
  });

  it("schickt einen Referer der Zielseite — gegen Hotlink-Schutz", async () => {
    fetchGibt(bildAntwort("x"));

    await logoUebernehmen("https://firma.ch/bilder/logo.png");

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers.Referer).toBe("https://firma.ch");
  });
});

describe("logoUebernehmen – SVG", () => {
  it("ergänzt fehlende Grösse und entfernt Skripte vor dem Speichern", async () => {
    fetchGibt(bildAntwort('<svg viewBox="0 0 200 60"><script>x</script></svg>', "image/svg+xml"));

    const ergebnis = await logoUebernehmen("https://www.alesa.ch/Images/logo.svg");

    expect(ergebnis).toEqual({ pfad: expect.stringContaining(".svg") });
    const gespeichert = String(writeFileMock.mock.calls[0][1]);
    expect(gespeichert).toContain('width="200"');
    expect(gespeichert).toContain('height="60"');
    expect(gespeichert).not.toContain("script");
  });
});

describe("logoUebernehmen – Eingabefehler", () => {
  it("weist leere und relative Adressen ab", async () => {
    fetchGibt();
    expect(await logoUebernehmen("   ")).toEqual({ fehler: expect.stringContaining("Keine Adresse") });
    expect(await logoUebernehmen("www.alesa.ch/logo.svg")).toEqual({
      fehler: expect.stringContaining("https://"),
    });
  });

  it("weist andere Protokolle ab", async () => {
    fetchGibt();
    expect(await logoUebernehmen("file:///etc/passwd")).toEqual({
      fehler: expect.stringContaining("https://"),
    });
  });
});

describe("logoUebernehmen – Netzgrenzen", () => {
  it("blockiert Adressen im internen Netz", async () => {
    lookupMock.mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);
    fetchGibt(bildAntwort("x"));

    const ergebnis = await logoUebernehmen("https://metadaten.intern/logo.png");

    expect(ergebnis).toEqual({ fehler: "Adresse zeigt in ein internes Netz" });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("blockiert auch, wenn nur eine von mehreren Adressen intern ist", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ]);
    fetchGibt(bildAntwort("x"));

    expect(await logoUebernehmen("https://doppelt.ch/logo.png")).toEqual({
      fehler: "Adresse zeigt in ein internes Netz",
    });
  });

  it("meldet einen unauflösbaren Hostnamen", async () => {
    lookupMock.mockRejectedValue(new Error("ENOTFOUND"));
    fetchGibt(bildAntwort("x"));

    expect(await logoUebernehmen("https://gibtsnicht.example/logo.png")).toEqual({
      fehler: "Adresse konnte nicht aufgelöst werden",
    });
  });

  it("prüft auch das Ziel einer Weiterleitung", async () => {
    lookupMock
      .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }])
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    fetchGibt(new Response(null, { status: 302, headers: { location: "http://localhost/geheim" } }));

    expect(await logoUebernehmen("https://umleiter.ch/logo.png")).toEqual({
      fehler: "Adresse zeigt in ein internes Netz",
    });
  });

  it("folgt einer normalen Weiterleitung", async () => {
    fetchGibt(
      new Response(null, { status: 301, headers: { location: "/final/logo.png" } }),
      bildAntwort("x"),
    );

    expect(await logoUebernehmen("https://firma.ch/logo.png")).toEqual({
      pfad: expect.stringContaining("/api/uploads/"),
    });
  });

  it("bricht bei einer Weiterleitungsschleife ab", async () => {
    const schleife = () =>
      new Response(null, { status: 302, headers: { location: "https://firma.ch/logo.png" } });
    fetchGibt(schleife(), schleife(), schleife(), schleife(), schleife());

    expect(await logoUebernehmen("https://firma.ch/logo.png")).toEqual({
      fehler: "Zu viele Weiterleitungen",
    });
  });

  it("meldet einen Zeitüberschreitungs-Abbruch verständlich", async () => {
    const abbruch = new Error("abgelaufen");
    abbruch.name = "TimeoutError";
    fetchGibt(abbruch);

    expect(await logoUebernehmen("https://langsam.ch/logo.png")).toEqual({
      fehler: expect.stringContaining("Zeitüberschreitung"),
    });
  });

  it("meldet einen nicht erreichbaren Server", async () => {
    fetchGibt(new Error("ECONNREFUSED"));

    expect(await logoUebernehmen("https://tot.ch/logo.png")).toEqual({
      fehler: "Server nicht erreichbar",
    });
  });
});

describe("logoUebernehmen – Antwort taugt nicht", () => {
  it("meldet den Statuscode im Klartext", async () => {
    fetchGibt(new Response("weg", { status: 404 }));

    expect(await logoUebernehmen("https://firma.ch/alt.png")).toEqual({
      fehler: "Server antwortete mit 404",
    });
  });

  it("weist HTML ab — der häufigste Fall ist ein Link auf die Seite statt aufs Bild", async () => {
    fetchGibt(bildAntwort("<html>", "text/html; charset=utf-8"));

    const ergebnis = await logoUebernehmen("https://firma.ch/ueber-uns");

    expect(ergebnis).toEqual({ fehler: expect.stringContaining("kein unterstütztes Bild") });
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("weist ein leeres Bild ab", async () => {
    fetchGibt(bildAntwort(new Uint8Array()));

    expect(await logoUebernehmen("https://firma.ch/leer.png")).toEqual({ fehler: "Bild ist leer" });
  });

  it("weist ein zu grosses Bild anhand der Längenangabe ab", async () => {
    fetchGibt(bildAntwort("x", "image/png", { "content-length": String(LOGO_MAX_BYTES + 1) }));

    expect(await logoUebernehmen("https://firma.ch/riesig.png")).toEqual({
      fehler: expect.stringContaining("grösser als"),
    });
  });

  it("bricht auch ohne Längenangabe ab, sobald zu viel kommt", async () => {
    const stueck = new Uint8Array(256 * 1024);
    let uebrig = 10;
    const strom = new ReadableStream({
      pull(controller) {
        if (uebrig-- <= 0) controller.close();
        else controller.enqueue(stueck);
      },
    });
    fetchGibt(bildAntwort(strom));

    expect(await logoUebernehmen("https://firma.ch/strom.png")).toEqual({
      fehler: expect.stringContaining("grösser als"),
    });
  });
});

describe("logoUebernehmen – Speicherfehler", () => {
  it("meldet, wenn die Datei nicht geschrieben werden kann", async () => {
    writeFileMock.mockRejectedValue(new Error("EACCES"));
    fetchGibt(bildAntwort("x"));
    const stille = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await logoUebernehmen("https://firma.ch/logo.png")).toEqual({
      fehler: expect.stringContaining("nicht gespeichert"),
    });

    stille.mockRestore();
  });
});
