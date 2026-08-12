import { describe, expect, it } from "vitest";
import {
  darfBenutzerVerwalten,
  darfRolleVergeben,
  rollenAblehnung,
  vergebbareRollen,
} from "./benutzer-rechte";

describe("darfRolleVergeben", () => {
  it("lässt den Owner alles unterhalb seiner Stufe vergeben", () => {
    expect(darfRolleVergeben("OWNER", "ADMIN")).toBe(true);
    expect(darfRolleVergeben("OWNER", "SCHIEDSRICHTER")).toBe(true);
  });

  it("verhindert einen zweiten Owner", () => {
    expect(darfRolleVergeben("OWNER", "OWNER")).toBe(false);
  });

  it("lässt Admins Schiedsrichter und Helfer anlegen", () => {
    expect(darfRolleVergeben("ADMIN", "SCHIEDSRICHTER")).toBe(true);
    expect(darfRolleVergeben("ADMIN", "HELFER")).toBe(true);
    expect(darfRolleVergeben("ADMIN", "ORGA")).toBe(true);
  });

  it("verhindert, dass ein Admin Admins oder Owner macht", () => {
    expect(darfRolleVergeben("ADMIN", "ADMIN")).toBe(false);
    expect(darfRolleVergeben("ADMIN", "OWNER")).toBe(false);
  });

  it("sperrt Rollen unterhalb von Admin komplett aus", () => {
    expect(darfRolleVergeben("ORGA", "HELFER")).toBe(true);
    expect(darfRolleVergeben("SCHIEDSRICHTER", "HELFER")).toBe(true);
    expect(darfRolleVergeben("HELFER", "HELFER")).toBe(false);
  });

  it("weist unbekannte Rollen ab, statt sie durchzulassen", () => {
    expect(darfRolleVergeben("GAST", "HELFER")).toBe(false);
    expect(darfRolleVergeben("ADMIN", "SUPERUSER")).toBe(false);
    expect(darfRolleVergeben("", "")).toBe(false);
  });
});

describe("darfBenutzerVerwalten", () => {
  it("erlaubt Bearbeiten und Löschen nur unterhalb der eigenen Stufe", () => {
    expect(darfBenutzerVerwalten("ADMIN", "SCHIEDSRICHTER")).toBe(true);
    expect(darfBenutzerVerwalten("ADMIN", "ADMIN")).toBe(false);
    expect(darfBenutzerVerwalten("ADMIN", "OWNER")).toBe(false);
    expect(darfBenutzerVerwalten("OWNER", "ADMIN")).toBe(true);
  });
});

describe("vergebbareRollen", () => {
  it("listet für den Owner alles ausser Owner, absteigend sortiert", () => {
    expect(vergebbareRollen("OWNER")).toEqual([
      "ADMIN",
      "ORGA",
      "SCHIEDSRICHTER",
      "HELFER",
    ]);
  });

  it("listet für den Admin nur die Stufen darunter", () => {
    expect(vergebbareRollen("ADMIN")).toEqual(["ORGA", "SCHIEDSRICHTER", "HELFER"]);
  });

  it("ist leer für Rollen ohne Verwaltungsrecht", () => {
    expect(vergebbareRollen("HELFER")).toEqual([]);
  });
});

describe("rollenAblehnung", () => {
  it("nennt eine unbekannte Rolle beim Namen", () => {
    expect(rollenAblehnung("ADMIN", "SUPERUSER")).toContain("SUPERUSER");
  });

  it("erklärt die Stufenregel", () => {
    expect(rollenAblehnung("ADMIN", "OWNER")).toContain("unterhalb der eigenen");
  });
});
