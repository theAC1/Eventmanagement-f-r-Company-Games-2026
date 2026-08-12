import { describe, expect, it } from "vitest";
import { fehlerText, meldung } from "./api-fehler";

describe("fehlerText", () => {
  it("nimmt die Begründung der API", () => {
    expect(fehlerText({ error: "Team hat Ergebnisse" }, "Fallback")).toBe(
      "Team hat Ergebnisse",
    );
  });

  it("hängt Zod-Details an die Begründung", () => {
    expect(
      fehlerText(
        {
          error: "Validierungsfehler",
          details: [{ field: "startZeit", message: "Format HH:MM" }],
        },
        "Fallback",
      ),
    ).toBe("Validierungsfehler — startZeit: Format HH:MM");
  });

  it("kommt mit Details ohne Feldnamen klar", () => {
    expect(fehlerText({ details: [{ message: "zu kurz" }] }, "Fallback")).toBe(
      "zu kurz",
    );
  });

  it("fällt auf den Standardtext zurück", () => {
    expect(fehlerText(null, "Fallback")).toBe("Fallback");
    expect(fehlerText({}, "Fallback")).toBe("Fallback");
    expect(fehlerText("kaputt", "Fallback")).toBe("Fallback");
    expect(fehlerText({ details: [] }, "Fallback")).toBe("Fallback");
  });
});

describe("meldung", () => {
  it("liest die Nachricht eines Errors", () => {
    expect(meldung(new Error("Netzwerk weg"))).toBe("Netzwerk weg");
  });

  it("nimmt Strings direkt", () => {
    expect(meldung("kaputt")).toBe("kaputt");
  });

  it("fällt bei allem anderen auf den Standardtext zurück", () => {
    expect(meldung(undefined)).toBe("Unbekannter Fehler");
    expect(meldung(new Error(""), "Nix")).toBe("Nix");
    expect(meldung({ seltsam: true }, "Nix")).toBe("Nix");
  });
});
