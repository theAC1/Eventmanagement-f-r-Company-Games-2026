import { describe, it, expect } from "vitest";
import { hasMinRole, ROLE_HIERARCHY } from "./auth";

describe("ROLE_HIERARCHY", () => {
  it("sollte korrekte Hierarchie haben", () => {
    expect(ROLE_HIERARCHY.ADMIN).toBeGreaterThan(ROLE_HIERARCHY.ORGA);
    expect(ROLE_HIERARCHY.ORGA).toBeGreaterThan(ROLE_HIERARCHY.SCHIEDSRICHTER);
    expect(ROLE_HIERARCHY.SCHIEDSRICHTER).toBeGreaterThan(ROLE_HIERARCHY.HELFER);
  });

  it("sollte 4 Rollen definieren", () => {
    expect(Object.keys(ROLE_HIERARCHY)).toHaveLength(4);
  });
});

describe("hasMinRole", () => {
  it("sollte ADMIN alle Rollen erlauben", () => {
    expect(hasMinRole("ADMIN", "ADMIN")).toBe(true);
    expect(hasMinRole("ADMIN", "ORGA")).toBe(true);
    expect(hasMinRole("ADMIN", "SCHIEDSRICHTER")).toBe(true);
    expect(hasMinRole("ADMIN", "HELFER")).toBe(true);
  });

  it("sollte ORGA alles ausser ADMIN erlauben", () => {
    expect(hasMinRole("ORGA", "ADMIN")).toBe(false);
    expect(hasMinRole("ORGA", "ORGA")).toBe(true);
    expect(hasMinRole("ORGA", "SCHIEDSRICHTER")).toBe(true);
    expect(hasMinRole("ORGA", "HELFER")).toBe(true);
  });

  it("sollte SCHIEDSRICHTER nur SCHIEDSRICHTER und HELFER erlauben", () => {
    expect(hasMinRole("SCHIEDSRICHTER", "ADMIN")).toBe(false);
    expect(hasMinRole("SCHIEDSRICHTER", "ORGA")).toBe(false);
    expect(hasMinRole("SCHIEDSRICHTER", "SCHIEDSRICHTER")).toBe(true);
    expect(hasMinRole("SCHIEDSRICHTER", "HELFER")).toBe(true);
  });

  it("sollte HELFER nur HELFER erlauben", () => {
    expect(hasMinRole("HELFER", "ADMIN")).toBe(false);
    expect(hasMinRole("HELFER", "ORGA")).toBe(false);
    expect(hasMinRole("HELFER", "SCHIEDSRICHTER")).toBe(false);
    expect(hasMinRole("HELFER", "HELFER")).toBe(true);
  });

  it("sollte unbekannte Rollen ablehnen", () => {
    expect(hasMinRole("UNKNOWN", "ADMIN")).toBe(false);
    expect(hasMinRole("ADMIN", "UNKNOWN")).toBe(false);
    expect(hasMinRole("", "ADMIN")).toBe(false);
    expect(hasMinRole("ADMIN", "")).toBe(false);
  });
});
