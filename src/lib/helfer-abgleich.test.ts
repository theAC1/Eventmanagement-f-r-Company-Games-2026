import { describe, it, expect } from "vitest";
import {
  normalisiereName,
  hoehereRolle,
  findeBestand,
  berechneAenderungen,
  planeAbgleich,
  type BestandsPerson,
  type HelferSoll,
} from "./helfer-abgleich";

const soll = (u: Partial<HelferSoll> = {}): HelferSoll => ({
  name: "Lara Müller",
  username: "lara.mueller",
  email: "lari@example.ch",
  rolle: "SCHIEDSRICHTER",
  ...u,
});

const bestand = (u: Partial<BestandsPerson> = {}): BestandsPerson => ({
  id: "p1",
  name: "Lara Müller",
  username: "lara.mueller",
  email: "lari@example.ch",
  rolle: "SCHIEDSRICHTER",
  ...u,
});

describe("normalisiereName", () => {
  it("sollte Umlaute auf die Ersatzschreibweise bringen", () => {
    expect(normalisiereName("Lara Müller")).toBe("lara mueller");
    expect(normalisiereName("Lara Mueller")).toBe("lara mueller");
    expect(normalisiereName("Sabine Näpflin")).toBe("sabine naepflin");
  });

  it("sollte Akzente entfernen — die Listen setzen sie uneinheitlich", () => {
    expect(normalisiereName("Michèle Rast")).toBe("michele rast");
  });

  it("sollte Gross-/Kleinschreibung und Mehrfach-Leerzeichen einebnen", () => {
    expect(normalisiereName("  JUAN   HAUSHERR ")).toBe("juan hausherr");
  });
});

describe("hoehereRolle", () => {
  it("sollte die stärkere Rolle zurückgeben, unabhängig von der Reihenfolge", () => {
    expect(hoehereRolle("HELFER", "ADMIN")).toBe("ADMIN");
    expect(hoehereRolle("ADMIN", "HELFER")).toBe("ADMIN");
    expect(hoehereRolle("OWNER", "SCHIEDSRICHTER")).toBe("OWNER");
    expect(hoehereRolle("HELFER", "HELFER")).toBe("HELFER");
  });
});

describe("findeBestand", () => {
  it("sollte über den Username finden — Orga-Accounts tragen nur Vornamen", () => {
    const juan = bestand({ id: "j", name: "Juan", username: "juan", email: null, rolle: "OWNER" });
    const treffer = findeBestand(
      soll({ name: "Juan Hausherr", username: "juan", email: "juan@example.ch" }),
      [juan],
    );
    expect(treffer?.id).toBe("j");
  });

  it("sollte über den Namen finden, wenn der Username abweicht", () => {
    const p = bestand({ id: "x", username: "lmueller" });
    expect(findeBestand(soll(), [p])?.id).toBe("x");
  });

  it("sollte über die E-Mail finden, wenn Username und Name abweichen", () => {
    const p = bestand({ id: "y", name: "L. Mueller-Neu", username: "lmn" });
    expect(findeBestand(soll(), [p])?.id).toBe("y");
  });

  it("sollte null liefern, wenn nichts passt", () => {
    expect(findeBestand(soll(), [bestand({ id: "z", name: "Ganz Anders", username: "ga", email: "a@b.ch" })])).toBeNull();
  });

  it("sollte ohne E-Mail im Soll nicht über die E-Mail suchen", () => {
    const p = bestand({ id: "q", name: "Anders", username: "anders", email: null });
    expect(findeBestand(soll({ email: null }), [p])).toBeNull();
  });
});

describe("berechneAenderungen", () => {
  it("sollte den Vornamen-Account auf den vollen Namen heben", () => {
    const p = bestand({ name: "Juan", username: "juan", email: null, rolle: "OWNER" });
    const a = berechneAenderungen(p, soll({ name: "Juan Hausherr", username: "juan", email: "juan@example.ch", rolle: "HELFER" }));
    expect(a.name).toBe("Juan Hausherr");
    expect(a.email).toBe("juan@example.ch");
  });

  it("sollte eine Rolle nie herunterstufen", () => {
    const admin = bestand({ rolle: "ADMIN" });
    expect(berechneAenderungen(admin, soll({ rolle: "HELFER" })).rolle).toBeUndefined();
  });

  it("sollte eine Rolle anheben, wenn der Plan mehr verlangt", () => {
    const helfer = bestand({ rolle: "HELFER" });
    expect(berechneAenderungen(helfer, soll({ rolle: "SCHIEDSRICHTER" })).rolle).toBe("SCHIEDSRICHTER");
  });

  it("sollte eine bereits gespeicherte E-Mail nicht überschreiben", () => {
    const p = bestand({ email: "alt@example.ch" });
    expect(berechneAenderungen(p, soll({ email: "neu@example.ch" })).email).toBeUndefined();
  });

  it("sollte einen fehlenden Username ergänzen, einen bestehenden aber behalten", () => {
    expect(berechneAenderungen(bestand({ username: null }), soll()).username).toBe("lara.mueller");
    expect(berechneAenderungen(bestand({ username: "eigener" }), soll()).username).toBeUndefined();
  });

  it("sollte bei identischem Stand nichts melden", () => {
    expect(berechneAenderungen(bestand(), soll())).toEqual({});
  });
});

describe("planeAbgleich", () => {
  it("sollte Neue anlegen und Bestehende zuordnen", () => {
    const plan = planeAbgleich(
      [soll(), soll({ name: "Neu Person", username: "neu.person", email: "neu@example.ch" })],
      [bestand()],
    );
    expect(plan.anlegen.map((e) => e.name)).toEqual(["Neu Person"]);
    expect(plan.unveraendert).toHaveLength(1);
    expect(plan.aktualisieren).toHaveLength(0);
  });

  it("sollte abweichende E-Mails als Konflikt melden, ohne zu überschreiben", () => {
    const plan = planeAbgleich([soll({ email: "neu@example.ch" })], [bestand({ email: "alt@example.ch" })]);
    expect(plan.konflikte).toHaveLength(1);
    expect(plan.konflikte[0].grund).toContain("alt@example.ch");
    expect(plan.aktualisieren).toHaveLength(0);
  });

  it("sollte einen doppelt passenden Account nur einmal verbrauchen", () => {
    // Zwei Listeneinträge, die auf denselben Account zeigen: der zweite darf
    // den ersten nicht überschreiben, sondern muss auffallen.
    const plan = planeAbgleich(
      [soll(), soll({ name: "Lara Mueller", username: "andere", email: null })],
      [bestand()],
    );
    expect(plan.unveraendert).toHaveLength(1);
    expect(plan.konflikte).toHaveLength(1);
    expect(plan.konflikte[0].grund).toContain("mehrere Listeneinträge");
  });

  it("sollte Accounts melden, die in keiner Liste stehen", () => {
    const fremd = bestand({ id: "fremd", name: "Rahel", username: "rahel", email: null, rolle: "ADMIN" });
    const plan = planeAbgleich([soll()], [bestand(), fremd]);
    expect(plan.unbekannt.map((p) => p.name)).toEqual(["Rahel"]);
  });

  it("sollte Änderungen als solche führen", () => {
    const plan = planeAbgleich([soll()], [bestand({ email: null })]);
    expect(plan.aktualisieren).toHaveLength(1);
    expect(plan.aktualisieren[0].aenderungen.email).toBe("lari@example.ch");
  });
});
