/**
 * Wer darf welche Accounts anlegen und ändern?
 *
 * Bisher konnte das nur der OWNER — für den Turniertag zu eng: die Admins
 * müssen ihre Schiedsrichter und Helfer selbst erfassen können, ohne dass
 * dabei jemand seine eigene Stufe erreichen oder überschreiten kann.
 *
 * Eine Regel deckt beides ab: **echt unterhalb der eigenen Stufe**.
 * - OWNER (200) verwaltet ADMIN und darunter — nie einen zweiten OWNER.
 * - ADMIN (100) verwaltet ORGA, SCHIEDSRICHTER, HELFER — keine anderen Admins.
 * - ORGA und darunter verwalten niemanden.
 *
 * Damit ist Rechte-Eskalation strukturell ausgeschlossen statt per Sonderfall.
 */

import { ROLE_HIERARCHY } from "@/lib/roles";

/** Mindeststufe, ab der die Benutzerverwaltung überhaupt offen steht. */
export const BENUTZER_MIN_ROLLE = "ADMIN";

function stufe(rolle: string): number {
  return ROLE_HIERARCHY[rolle] ?? -1;
}

/**
 * Darf `akteur` einem Account die Rolle `ziel` geben (beim Anlegen oder Ändern)?
 */
export function darfRolleVergeben(akteur: string, ziel: string): boolean {
  const eigene = stufe(akteur);
  const zielStufe = stufe(ziel);
  if (eigene < 0 || zielStufe < 0) return false;
  return zielStufe < eigene;
}

/**
 * Darf `akteur` einen Account mit der Rolle `ziel` bearbeiten oder löschen?
 */
export function darfBenutzerVerwalten(akteur: string, ziel: string): boolean {
  return darfRolleVergeben(akteur, ziel);
}

/** Rollen, die `akteur` im Formular zur Auswahl bekommt. */
export function vergebbareRollen(akteur: string): string[] {
  return Object.keys(ROLE_HIERARCHY)
    .filter((rolle) => darfRolleVergeben(akteur, rolle))
    .sort((a, b) => stufe(b) - stufe(a));
}

/** Klartext-Begründung für eine abgelehnte Rollenvergabe. */
export function rollenAblehnung(akteur: string, ziel: string): string {
  if (stufe(ziel) < 0) return `Unbekannte Rolle "${ziel}".`;
  return `Als ${akteur} kannst du die Rolle ${ziel} nicht vergeben — nur Rollen unterhalb der eigenen.`;
}
