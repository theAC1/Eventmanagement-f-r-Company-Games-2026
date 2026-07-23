// Sperrfrist für Ergebnis-Korrekturen durch Schiedsrichter.
// Nach Ablauf kann nur noch Admin/Orga über die Korrekturfreigabe ändern.

export const KORREKTUR_FENSTER_MS = 10 * 60 * 1000; // 10 Minuten (Entscheid Juan 2026-07-23)

export function istGesperrt(eingetragenUm: Date | null, now: number = Date.now()): boolean {
  if (!eingetragenUm) return false;
  return now - eingetragenUm.getTime() > KORREKTUR_FENSTER_MS;
}
