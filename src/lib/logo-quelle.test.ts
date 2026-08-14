import { describe, it, expect } from "vitest";
import {
  istLokalerPfad,
  istAbsoluteHttpUrl,
  istGueltigeBildUrl,
  endungFuerContentType,
  istSvg,
  svgGroesseErgaenzen,
  svgBereinigen,
  svgAufbereiten,
  istPrivateAdresse,
} from "./logo-quelle";

describe("istLokalerPfad", () => {
  it("erkennt Upload-Pfade", () => {
    expect(istLokalerPfad("/api/uploads/logo-abc.png")).toBe(true);
  });

  it("weist fremde Adressen und ähnlich aussehende Pfade ab", () => {
    expect(istLokalerPfad("https://meinplatz.ch/logo.png")).toBe(false);
    expect(istLokalerPfad("/uploads/logo.png")).toBe(false);
    expect(istLokalerPfad("https://boese.ch/api/uploads/logo.png")).toBe(false);
  });
});

describe("istAbsoluteHttpUrl", () => {
  it("akzeptiert http und https mit Host", () => {
    expect(istAbsoluteHttpUrl("https://www.alesa.ch/Images/logo.svg")).toBe(true);
    expect(istAbsoluteHttpUrl("http://meinplatz.ch/a.png")).toBe(true);
  });

  it("weist ab, was der Browser nicht laden kann", () => {
    expect(istAbsoluteHttpUrl("www.alesa.ch/logo.svg")).toBe(false);
    expect(istAbsoluteHttpUrl("/api/uploads/a.png")).toBe(false);
    expect(istAbsoluteHttpUrl("file:///etc/passwd")).toBe(false);
    expect(istAbsoluteHttpUrl("javascript:alert(1)")).toBe(false);
    expect(istAbsoluteHttpUrl("")).toBe(false);
  });
});

describe("istGueltigeBildUrl", () => {
  it("lässt beide Welten zu — lokal und absolut", () => {
    expect(istGueltigeBildUrl("/api/uploads/logo-abc.png")).toBe(true);
    expect(istGueltigeBildUrl("https://meinplatz.ch/logo.png")).toBe(true);
    expect(istGueltigeBildUrl("meinplatz.ch/logo.png")).toBe(false);
  });
});

describe("endungFuerContentType", () => {
  it("übersetzt die gängigen Bildtypen", () => {
    expect(endungFuerContentType("image/png")).toBe(".png");
    expect(endungFuerContentType("image/jpeg")).toBe(".jpg");
    expect(endungFuerContentType("image/svg+xml")).toBe(".svg");
    expect(endungFuerContentType("image/webp")).toBe(".webp");
    expect(endungFuerContentType("image/gif")).toBe(".gif");
  });

  it("verträgt Zusätze und Grossschreibung", () => {
    expect(endungFuerContentType("image/svg+xml; charset=utf-8")).toBe(".svg");
    expect(endungFuerContentType("IMAGE/PNG")).toBe(".png");
  });

  it("gibt null zurück, wenn es kein ausliefbares Bild ist", () => {
    expect(endungFuerContentType("text/html")).toBeNull();
    expect(endungFuerContentType("image/avif")).toBeNull();
    expect(endungFuerContentType(null)).toBeNull();
  });
});

describe("istSvg", () => {
  it("erkennt Content-Type und Endung", () => {
    expect(istSvg("image/svg+xml")).toBe(true);
    expect(istSvg(".svg")).toBe(true);
    expect(istSvg("image/png")).toBe(false);
  });
});

describe("svgGroesseErgaenzen", () => {
  it("ergänzt width und height aus der viewBox", () => {
    const ergebnis = svgGroesseErgaenzen('<svg viewBox="0 0 200 60" xmlns="x"><path/></svg>');
    expect(ergebnis).toContain('width="200"');
    expect(ergebnis).toContain('height="60"');
    expect(ergebnis).toContain("<path/>");
  });

  it("lässt vorhandene Grössen unangetastet", () => {
    const original = '<svg width="10" height="4" viewBox="0 0 200 60"></svg>';
    expect(svgGroesseErgaenzen(original)).toBe(original);
  });

  it("ergänzt nur das fehlende Attribut — doppelte wären ungültiges XML", () => {
    const ergebnis = svgGroesseErgaenzen('<svg width="200" viewBox="0 0 200 60"></svg>');
    expect(ergebnis.match(/width=/g)).toHaveLength(1);
    expect(ergebnis).toContain('height="60"');
  });

  it("verträgt Kommas und Dezimalzahlen in der viewBox", () => {
    const ergebnis = svgGroesseErgaenzen('<svg viewBox="0,0,133.5,40.25"></svg>');
    expect(ergebnis).toContain('width="133.5"');
    expect(ergebnis).toContain('height="40.25"');
  });

  it("lässt SVG ohne brauchbare viewBox unverändert", () => {
    const ohne = "<svg></svg>";
    expect(svgGroesseErgaenzen(ohne)).toBe(ohne);
    const kaputt = '<svg viewBox="0 0 abc 60"></svg>';
    expect(svgGroesseErgaenzen(kaputt)).toBe(kaputt);
    const null_gross = '<svg viewBox="0 0 0 60"></svg>';
    expect(svgGroesseErgaenzen(null_gross)).toBe(null_gross);
  });

  it("behandelt $ im Original als Text, nicht als Ersetzungsmuster", () => {
    const mitDollar = '<svg viewBox="0 0 10 10" data-x="a$&b"></svg>';
    expect(svgGroesseErgaenzen(mitDollar)).toContain('data-x="a$&b"');
  });

  it("lässt Nicht-SVG in Ruhe", () => {
    expect(svgGroesseErgaenzen("kein svg")).toBe("kein svg");
  });
});

describe("svgBereinigen", () => {
  it("entfernt Skripte", () => {
    const ergebnis = svgBereinigen('<svg><script>alert(1)</script><path/></svg>');
    expect(ergebnis).not.toContain("alert");
    expect(ergebnis).toContain("<path/>");
  });

  it("entfernt selbstschliessende Skript-Tags", () => {
    expect(svgBereinigen('<svg><script src="b.js"/></svg>')).not.toContain("b.js");
  });

  it("entfernt Ereignis-Attribute", () => {
    const ergebnis = svgBereinigen('<svg onload="boese()"><rect onclick=\'x\'/></svg>');
    expect(ergebnis).not.toContain("onload");
    expect(ergebnis).not.toContain("onclick");
  });

  it("entfernt foreignObject", () => {
    const ergebnis = svgBereinigen("<svg><foreignObject><body/></foreignObject></svg>");
    expect(ergebnis).not.toContain("foreignObject");
  });

  it("entfernt javascript:-Verweise", () => {
    expect(svgBereinigen('<svg><a href="javascript:alert(1)"/></svg>')).not.toContain("javascript:");
    expect(svgBereinigen('<svg><a xlink:href="javascript:x"/></svg>')).not.toContain("javascript:");
  });

  it("lässt harmlose Attribute stehen", () => {
    const harmlos = '<svg fill="none" stroke="#fff"><path d="M0 0h1"/></svg>';
    expect(svgBereinigen(harmlos)).toBe(harmlos);
  });
});

describe("svgAufbereiten", () => {
  it("bereinigt und ergänzt in einem Schritt", () => {
    const ergebnis = svgAufbereiten('<svg viewBox="0 0 200 60"><script>x</script></svg>');
    expect(ergebnis).toContain('width="200"');
    expect(ergebnis).not.toContain("script");
  });
});

describe("istPrivateAdresse", () => {
  it("erkennt private IPv4-Netze", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // Cloud-Metadaten
      "0.0.0.0",
      "100.64.0.1",
      "198.18.0.1",
      "224.0.0.1",
    ]) {
      expect(istPrivateAdresse(ip), ip).toBe(true);
    }
  });

  it("lässt öffentliche IPv4-Adressen durch", () => {
    for (const ip of ["1.1.1.1", "172.32.0.1", "8.8.8.8", "192.167.1.1"]) {
      expect(istPrivateAdresse(ip), ip).toBe(false);
    }
  });

  it("erkennt private IPv6-Adressen", () => {
    for (const ip of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1"]) {
      expect(istPrivateAdresse(ip), ip).toBe(true);
    }
  });

  it("lässt öffentliche IPv6-Adressen durch", () => {
    expect(istPrivateAdresse("2606:4700:4700::1111")).toBe(false);
    expect(istPrivateAdresse("::ffff:8.8.8.8")).toBe(false);
  });

  it("sperrt, was es nicht lesen kann", () => {
    expect(istPrivateAdresse("")).toBe(true);
    expect(istPrivateAdresse("kaputt")).toBe(true);
    expect(istPrivateAdresse("999.1.1.1")).toBe(true);
  });
});
