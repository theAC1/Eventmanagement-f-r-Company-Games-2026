/**
 * Prüft die aus den beiden Excel-Listen erzeugte Helferliste gegen sich selbst
 * und gegen die Game-Stammdaten. Die Datei ist generiert — diese Tests sind
 * die Absicherung dagegen, dass beim nächsten Nachführen etwas verrutscht.
 */

import { describe, it, expect } from "vitest";
import { helfer } from "../../prisma/helfer-data";
import { games, ausgemusterteSlugs } from "../../prisma/games-data";
import { planeAbgleich } from "./helfer-abgleich";

const slugs = new Set(games.map((g) => g.slug));

describe("helfer-data", () => {
  it("sollte alle 46 konsolidierten Personen enthalten", () => {
    expect(helfer).toHaveLength(46);
  });

  it("sollte eindeutige Usernames haben — sonst kollidiert der Import", () => {
    const namen = helfer.map((e) => e.username);
    expect(new Set(namen).size).toBe(namen.length);
  });

  it("sollte keine E-Mail doppelt vergeben", () => {
    const mails = helfer.map((e) => e.email).filter((m): m is string => Boolean(m));
    expect(new Set(mails.map((m) => m.toLowerCase())).size).toBe(mails.length);
  });

  it("sollte 41 Adressen kennen und 5 offen lassen", () => {
    // Die fünf stehen nur im Einsatzplan, nicht auf der Mitgliederliste.
    expect(helfer.filter((e) => e.email).length).toBe(41);
    expect(helfer.filter((e) => !e.email).length).toBe(5);
  });

  it("sollte nur plausible E-Mail-Adressen enthalten", () => {
    for (const e of helfer) {
      if (e.email) expect(e.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    }
  });

  it("sollte nur auf existierende Posten verweisen", () => {
    for (const e of helfer) {
      if (e.postenSlug) expect(slugs).toContain(e.postenSlug);
    }
  });

  it("sollte ausgemusterte Posten als solche kennzeichnen statt sie zuzuweisen", () => {
    for (const e of helfer) {
      if (!e.postenAusgemustert) continue;
      expect(ausgemusterteSlugs).toContain(e.postenAusgemustert);
      expect(e.postenSlug).toBeNull();
    }
  });

  it("sollte jedem Kampfrichter einen Posten geben — gültig oder ausgemustert", () => {
    const kampfrichter = helfer.filter((e) => e.einsatz.includes("Kampfrichter"));
    expect(kampfrichter).toHaveLength(22);
    for (const e of kampfrichter) {
      expect(Boolean(e.postenSlug) || Boolean(e.postenAusgemustert)).toBe(true);
    }
  });

  it("sollte jeden gültigen Posten doppelt besetzen", () => {
    const proPosten = new Map<string, number>();
    for (const e of helfer) {
      if (e.postenSlug) proPosten.set(e.postenSlug, (proPosten.get(e.postenSlug) ?? 0) + 1);
    }
    for (const [slug, anzahl] of proPosten) {
      expect(anzahl, `Posten ${slug}`).toBe(2);
    }
  });

  it("sollte auf einer leeren Datenbank alle Personen anlegen wollen", () => {
    const plan = planeAbgleich(helfer, []);
    expect(plan.anlegen).toHaveLength(46);
    expect(plan.konflikte).toHaveLength(0);
  });

  it("sollte die bestehenden Orga-Accounts über den Username treffen", () => {
    // Stand aus scripts/create-initial-users.ts: Vorname als Name und Username.
    const bestand = ["juan", "luca", "gian", "levin", "roger", "sven"].map((u) => ({
      id: u,
      name: u.charAt(0).toUpperCase() + u.slice(1),
      username: u,
      email: null,
      rolle: "ADMIN" as const,
    }));
    const plan = planeAbgleich(helfer, bestand);
    expect(plan.anlegen).toHaveLength(40);
    expect(plan.aktualisieren).toHaveLength(6);
    expect(plan.unbekannt).toHaveLength(0);
    // Jeder der sechs bekommt mindestens den vollen Namen nachgetragen.
    for (const a of plan.aktualisieren) {
      expect(a.aenderungen.name).toContain(" ");
    }
  });
});
