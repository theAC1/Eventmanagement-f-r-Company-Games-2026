import { describe, it, expect } from "vitest";
import {
  GameCreateSchema,
  GameUpdateSchema,
  TeamCreateSchema,
  MaterialCreateSchema,
  ErgebnisCreateSchema,
  UserCreateSchema,
  UserUpdateSchema,
  zodValidationError,
} from "./schemas";

// ─── GameCreateSchema ───

describe("GameCreateSchema", () => {
  it("sollte valides Game akzeptieren", () => {
    const result = GameCreateSchema.safeParse({
      name: "XXL Basketball",
      typ: "RETURNEE",
      modus: "SOLO",
    });
    expect(result.success).toBe(true);
  });

  it("sollte leeren Namen ablehnen", () => {
    const result = GameCreateSchema.safeParse({
      name: "",
      typ: "RETURNEE",
      modus: "SOLO",
    });
    expect(result.success).toBe(false);
  });

  it("sollte fehlenden Namen ablehnen", () => {
    const result = GameCreateSchema.safeParse({
      typ: "RETURNEE",
      modus: "SOLO",
    });
    expect(result.success).toBe(false);
  });

  it("sollte ungültigen Typ ablehnen", () => {
    const result = GameCreateSchema.safeParse({
      name: "Test",
      typ: "INVALID",
      modus: "SOLO",
    });
    expect(result.success).toBe(false);
  });

  it("sollte ungültigen Modus ablehnen", () => {
    const result = GameCreateSchema.safeParse({
      name: "Test",
      typ: "NEU",
      modus: "TRIPLE",
    });
    expect(result.success).toBe(false);
  });

  it("sollte teamsProSlot auf 1-4 beschränken", () => {
    expect(GameCreateSchema.safeParse({ name: "T", typ: "NEU", modus: "SOLO", teamsProSlot: 0 }).success).toBe(false);
    expect(GameCreateSchema.safeParse({ name: "T", typ: "NEU", modus: "SOLO", teamsProSlot: 5 }).success).toBe(false);
    expect(GameCreateSchema.safeParse({ name: "T", typ: "NEU", modus: "SOLO", teamsProSlot: 2 }).success).toBe(true);
  });

  it("sollte optionale Felder akzeptieren", () => {
    const result = GameCreateSchema.safeParse({
      name: "Test",
      typ: "NEU",
      modus: "DUELL",
      kurzbeschreibung: "Eine Beschreibung",
      einfuehrungMin: 5,
      playtimeMin: 15,
      stromNoetig: true,
    });
    expect(result.success).toBe(true);
  });

  it("sollte Name über 100 Zeichen ablehnen", () => {
    const result = GameCreateSchema.safeParse({
      name: "A".repeat(101),
      typ: "NEU",
      modus: "SOLO",
    });
    expect(result.success).toBe(false);
  });
});

// ─── GameUpdateSchema ───

describe("GameUpdateSchema", () => {
  it("sollte partielle Updates akzeptieren", () => {
    const result = GameUpdateSchema.safeParse({ name: "Neuer Name" });
    expect(result.success).toBe(true);
  });

  it("sollte leeres Objekt akzeptieren", () => {
    const result = GameUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("sollte Status-Feld akzeptieren", () => {
    const result = GameUpdateSchema.safeParse({ status: "BEREIT" });
    expect(result.success).toBe(true);
  });

  it("sollte ungültigen Status ablehnen", () => {
    const result = GameUpdateSchema.safeParse({ status: "DELETED" });
    expect(result.success).toBe(false);
  });
});

// ─── TeamCreateSchema ───

describe("TeamCreateSchema", () => {
  it("sollte valides Team akzeptieren", () => {
    const result = TeamCreateSchema.safeParse({
      name: "Die Adler",
      nummer: 1,
    });
    expect(result.success).toBe(true);
  });

  it("sollte fehlenden Namen ablehnen", () => {
    const result = TeamCreateSchema.safeParse({ nummer: 1 });
    expect(result.success).toBe(false);
  });

  it("sollte fehlende Nummer ablehnen", () => {
    const result = TeamCreateSchema.safeParse({ name: "Test" });
    expect(result.success).toBe(false);
  });

  it("sollte Nummer 0 ablehnen", () => {
    const result = TeamCreateSchema.safeParse({ name: "Test", nummer: 0 });
    expect(result.success).toBe(false);
  });

  it("sollte optionale Felder akzeptieren", () => {
    const result = TeamCreateSchema.safeParse({
      name: "Test",
      nummer: 5,
      captainName: "Max",
      captainEmail: "max@test.ch",
      farbe: "#ff0000",
      motto: "Wir gewinnen!",
    });
    expect(result.success).toBe(true);
  });

  it("sollte ungültige Email ablehnen", () => {
    const result = TeamCreateSchema.safeParse({
      name: "Test",
      nummer: 1,
      captainEmail: "nicht-eine-email",
    });
    expect(result.success).toBe(false);
  });
});

// ─── MaterialCreateSchema ───

describe("MaterialCreateSchema", () => {
  it("sollte valides Material akzeptieren", () => {
    const result = MaterialCreateSchema.safeParse({
      name: "Basketball",
      kategorie: "SPONSOR",
    });
    expect(result.success).toBe(true);
  });

  it("sollte ungültige Kategorie ablehnen", () => {
    const result = MaterialCreateSchema.safeParse({
      name: "Test",
      kategorie: "GESCHENK",
    });
    expect(result.success).toBe(false);
  });
});

// ─── ErgebnisCreateSchema ───

describe("ErgebnisCreateSchema", () => {
  it("sollte valides Ergebnis akzeptieren", () => {
    const result = ErgebnisCreateSchema.safeParse({
      gameId: "game123",
      teamId: "team456",
      rohdaten: { punkte: 42 },
    });
    expect(result.success).toBe(true);
  });

  it("sollte fehlende gameId ablehnen", () => {
    const result = ErgebnisCreateSchema.safeParse({
      teamId: "team456",
      rohdaten: { punkte: 42 },
    });
    expect(result.success).toBe(false);
  });

  it("sollte leere gameId ablehnen", () => {
    const result = ErgebnisCreateSchema.safeParse({
      gameId: "",
      teamId: "team456",
      rohdaten: { punkte: 42 },
    });
    expect(result.success).toBe(false);
  });
});

// ─── UserCreateSchema ───

describe("UserCreateSchema", () => {
  it("sollte validen User akzeptieren", () => {
    const result = UserCreateSchema.safeParse({
      name: "Juan Hausherr",
      username: "juan",
      password: "sicher123",
      rolle: "ADMIN",
    });
    expect(result.success).toBe(true);
  });

  it("sollte zu kurzes Passwort ablehnen", () => {
    const result = UserCreateSchema.safeParse({
      name: "Test",
      username: "te",
      password: "ab",
      rolle: "ORGA",
    });
    expect(result.success).toBe(false);
  });

  it("sollte ungültige Rolle ablehnen", () => {
    const result = UserCreateSchema.safeParse({
      name: "Test",
      username: "test",
      password: "passwort123",
      rolle: "SUPERADMIN",
    });
    expect(result.success).toBe(false);
  });
});

// ─── UserUpdateSchema ───

describe("UserUpdateSchema", () => {
  it("sollte partielle Updates akzeptieren", () => {
    expect(UserUpdateSchema.safeParse({ name: "Neuer Name" }).success).toBe(true);
    expect(UserUpdateSchema.safeParse({ istAktiv: false }).success).toBe(true);
    expect(UserUpdateSchema.safeParse({}).success).toBe(true);
  });
});

// ─── zodValidationError ───

describe("zodValidationError", () => {
  it("sollte Fehler korrekt formatieren", () => {
    const result = GameCreateSchema.safeParse({});
    if (!result.success) {
      const formatted = zodValidationError(result.error);
      expect(formatted.error).toBe("Validierungsfehler");
      expect(formatted.details).toBeInstanceOf(Array);
      expect(formatted.details.length).toBeGreaterThan(0);
      expect(formatted.details[0]).toHaveProperty("field");
      expect(formatted.details[0]).toHaveProperty("message");
    }
  });
});
