/**
 * API Input-Validierung
 * Einfache Validierung ohne Zod-Dependency (Zod als Verbesserung für v2)
 */

export type ValidationError = { field: string; message: string };

export function validateRequired(
  body: Record<string, unknown>,
  fields: string[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const field of fields) {
    const value = body[field];
    if (value === undefined || value === null || value === "") {
      errors.push({ field, message: `${field} ist erforderlich` });
    }
  }
  return errors;
}

export function validateGameCreate(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    errors.push({ field: "name", message: "Name ist erforderlich" });
  }
  if (body.name && typeof body.name === "string" && body.name.length > 100) {
    errors.push({ field: "name", message: "Name darf maximal 100 Zeichen haben" });
  }
  if (body.typ && !["RETURNEE", "NEU"].includes(body.typ as string)) {
    errors.push({ field: "typ", message: "Typ muss RETURNEE oder NEU sein" });
  }
  if (body.modus && !["SOLO", "DUELL"].includes(body.modus as string)) {
    errors.push({ field: "modus", message: "Modus muss SOLO oder DUELL sein" });
  }
  if (body.teamsProSlot !== undefined) {
    const n = Number(body.teamsProSlot);
    if (!Number.isInteger(n) || n < 1 || n > 4) {
      errors.push({ field: "teamsProSlot", message: "Teams pro Slot muss 1-4 sein" });
    }
  }
  return errors;
}

export function validateMaterialCreate(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    errors.push({ field: "name", message: "Name ist erforderlich" });
  }
  if (body.kategorie && !["SPONSOR", "MIETE", "KAUF", "EIGENBAU", "VERBRAUCH", "INFRASTRUKTUR"].includes(body.kategorie as string)) {
    errors.push({ field: "kategorie", message: "Ungültige Kategorie" });
  }
  return errors;
}

export function validateErgebnisCreate(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!body.gameId) errors.push({ field: "gameId", message: "gameId ist erforderlich" });
  if (!body.teamId) errors.push({ field: "teamId", message: "teamId ist erforderlich" });
  if (!body.rohdaten || typeof body.rohdaten !== "object") {
    errors.push({ field: "rohdaten", message: "rohdaten muss ein Objekt sein" });
  }
  return errors;
}

export function validationResponse(errors: ValidationError[]) {
  return { error: "Validierungsfehler", details: errors };
}
