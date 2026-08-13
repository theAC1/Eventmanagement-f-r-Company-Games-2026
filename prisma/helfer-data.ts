/**
 * Konsolidierte Helfer- und Orga-Liste für den Turniertag.
 *
 * Zusammengeführt aus zwei Quellen im Ordner `Helfer/`:
 *  - `Comany Games.xlsx` — Mitgliederliste mit E-Mail und Natel (41 Personen)
 *  - `einsatzplan_company_games_2026.xlsx` — wer wo eingeteilt ist (41 Personen)
 *
 * Die Schnittmenge ist nicht deckungsgleich: 5 Personen aus dem Einsatzplan
 * fehlen in der Mitgliederliste und haben darum keine E-Mail, 5 Mitglieder
 * haben im Einsatzplan (noch) keine Aufgabe. Zusammen 46 Personen.
 *
 * Schreibweise: bei Abweichungen gilt die Mitgliederliste, weil dort auch die
 * Kontaktdaten hängen (Einsatzplan «Nadja Mäder» → Liste «Nadia Mäder», die
 * E-Mail nadia.maeder@ bestätigt sie; ebenso Hausheer→Hausherr,
 * Dominic→Dominique, Janine→Janin).
 *
 * `rolle` ist ausnahmslos die Rolle laut Einsatzplan — Kampfrichter werden
 * SCHIEDSRICHTER, alle übrigen HELFER. Auch bei Juan, Luca, Gian, Levin,
 * Roger und Sven, die längst Accounts haben: was sie in der App tatsächlich
 * sind, entscheidet die Datenbank, nicht diese Datei. Der Import stuft nie
 * herunter, und heraufstufen darf er nur, was der Einsatzplan begründet.
 *
 * Das ist bewusst so: eine frühere Fassung übernahm hier die Rollen aus
 * `scripts/create-initial-users.ts` (dort stehen alle als ADMIN). Die
 * Vorschau vom 13.08.2026 zeigte, dass die Datenbank inzwischen weiter ist —
 * der Import hätte fünf Leute stillschweigend zu Admins gemacht.
 *
 * `postenSlug` verweist auf `prisma/games-data.ts`. Drei Posten des
 * Einsatzplans gibt es seit dem Protokoll vom 10.08.2026 nicht mehr
 * (xxl-basketball, geschicklichkeits-parcour, eierfall) — der Einsatzplan ist
 * älter als das Protokoll. Ihre sechs Kampfrichter hat Juan am 13.08.2026 so
 * verteilt:
 *
 *   XXL Basketball            → XXL Viergewinnt     (Näpflin, Nardelli)
 *   Geschicklichkeits Parkour → Menschenkugelbahn   (Bohl, Rebsamen)
 *   Der grosse Eierfall       → ersatzlos gestrichen, die beiden bleiben
 *                               als Reserve ohne Posten (Steimen, Keusch)
 *
 * Damit sind alle zehn Posten doppelt besetzt. `postenAusgemustert` bleibt als
 * Herkunftsvermerk stehen: es sagt, was im Einsatzplan stand, `postenSlug`
 * sagt, wo die Person heute eingeteilt ist.
 *
 * Ausführen:  npm run helfer:import            (Vorschau, ändert nichts)
 *             npm run helfer:import -- --apply (schreibt)
 */

import type { PersonRolle } from "@prisma/client";

export type HelferEintrag = {
  /** Anzeigename, «Vorname Nachname» in der Schreibweise der Mitgliederliste. */
  name: string;
  /** Login. Für bestehende Accounts deren aktueller Username, sonst vorname.nachname. */
  username: string;
  /** Fehlt bei den fünf Personen, die nur im Einsatzplan stehen. */
  email: string | null;
  rolle: PersonRolle;
  /** Bereiche aus dem Einsatzplan; leer = im Plan noch nicht eingeteilt. */
  einsatz: string[];
  /** Posten-Slug für Kampfrichter, sonst null. */
  postenSlug: string | null;
  /** Zusatz aus dem Plan, z. B. «Platzkomitee», «Verkehr». */
  funktion?: string;
  /**
   * Herkunftsvermerk: der Posten, der im Einsatzplan stand und inzwischen
   * ausgemustert ist. `postenSlug` daneben sagt, wo die Person heute steht —
   * oder ist null, wenn sie als Reserve ohne Posten geführt wird.
   */
  postenAusgemustert?: string;
};

export const helfer: HelferEintrag[] = [
  { name: "Vanessa Abt", username: "vanessa.abt", email: "vanessa.abt@icloud.com", rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: "radio-runner" },
  { name: "Sofia Barranca", username: "sofia.barranca", email: "sbarranca@gmx.ch", rolle: "HELFER", einsatz: [], postenSlug: null },
  { name: "Silvio Bartucca", username: "silvio.bartucca", email: "silvio.bartucca@gmail.com", rolle: "HELFER", einsatz: ["Eintrichten Platz"], postenSlug: null, funktion: "Verkehr" },
  { name: "Simone Baumann", username: "simone.baumann", email: "mettler.sim@gmail.com", rolle: "HELFER", einsatz: ["Festwirtschaft"], postenSlug: null },
  { name: "Elin Bohl", username: "elin.bohl", email: "elin@bohl.org", rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: "menschenkugelbahn", postenAusgemustert: "geschicklichkeits-parcour" },
  { name: "Danja Bühlmann", username: "danja.buehlmann", email: "danja.buehlmann@gmx.ch", rolle: "HELFER", einsatz: ["Festwirtschaft"], postenSlug: null },
  { name: "Raffael Del Mese", username: "raffael.delmese", email: "raffael.del.mese@gmail.com", rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: "cornhole" },
  { name: "Levin Fischer", username: "levin", email: "levin.robin.fischer@gmail.com", rolle: "HELFER", einsatz: ["Betreuung Teams"], postenSlug: null },
  { name: "Lorena Fischer", username: "lorena.fischer", email: "lori_93_fischer@hotmail.com", rolle: "HELFER", einsatz: ["Aufräumen"], postenSlug: null },
  { name: "Dominique Garmier", username: "dominique.garmier", email: "domi.garmier@gmail.com", rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: "human-soccer" },
  { name: "Jessica Geiger", username: "jessica.geiger", email: "jessica.geiger@gmx.ch", rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: "kisten-stappeln" },
  { name: "Jodie Geiger", username: "jodie.geiger", email: "jodie.geiger@gmx.ch", rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: "kisten-stappeln" },
  { name: "Sarah Geissmann", username: "sarah.geissmann", email: "sarah@geissmann.info", rolle: "HELFER", einsatz: [], postenSlug: null },
  { name: "Corina Haller", username: "corina.haller", email: null, rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: "quadrant-chaos" },
  { name: "Marco Hard", username: "marco.hard", email: "marco.hard96@proton.me", rolle: "HELFER", einsatz: [], postenSlug: null },
  { name: "Juan Hausherr", username: "juan", email: "juan.hausherr@gmail.com", rolle: "HELFER", einsatz: ["Eintrichten Platz"], postenSlug: null, funktion: "Platzkomitee" },
  { name: "Janin Herren", username: "janin.herren", email: "j.herren.11@gmx.ch", rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: "lava-becken" },
  { name: "Muriel Hofer", username: "muriel.hofer", email: "muriel.hofer@besonet.ch", rolle: "HELFER", einsatz: ["Eintrichten Platz"], postenSlug: null },
  { name: "Miriam Hug", username: "miriam.hug", email: "miri_wey@hotmail.com", rolle: "HELFER", einsatz: ["Aufräumen"], postenSlug: null },
  { name: "Sven Keusch", username: "sven", email: null, rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: null, postenAusgemustert: "eierfall" },
  { name: "Ronja Koch", username: "ronja.koch", email: "ronja.koch@gmx.ch", rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: "lava-becken" },
  { name: "Tanja Koller", username: "tanja.koller", email: "koller.tanja@gmx.ch", rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: "radio-runner" },
  { name: "Sophia Lynn Küng", username: "sophia.kueng", email: "sophialynnkung@icloud.com", rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: "schwebender-architekt" },
  { name: "Adelina Lanfranconi", username: "adelina.lanfranconi", email: "adelina.lanfranconi@bluewin.ch", rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: "schwebender-architekt" },
  { name: "Stefan Leuthard", username: "stefan.leuthard", email: "stefanleuthard@bluewin.ch", rolle: "HELFER", einsatz: ["Eintrichten Platz"], postenSlug: null },
  { name: "Nadine Lüscher", username: "nadine.luescher", email: "nadine-l@bluewin.ch", rolle: "HELFER", einsatz: ["Festwirtschaft"], postenSlug: null },
  { name: "Sabrina Lüthy", username: "sabrina.luethy", email: "sabrina_luethy@hotmail.com", rolle: "HELFER", einsatz: ["Festwirtschaft"], postenSlug: null },
  { name: "Nadia Mäder", username: "nadia.maeder", email: "nadia.maeder@gmx.ch", rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: "stack-attack" },
  { name: "Tanja Moser", username: "tanja.moser", email: "moser-tanja@hotmail.com", rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: "quadrant-chaos" },
  { name: "Lara Müller", username: "lara.mueller", email: "lari.mueller2011@gmail.com", rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: "stack-attack" },
  { name: "Sabine Näpflin", username: "sabine.naepflin", email: "sabine_jelena@gmx.ch", rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: "xxl-viergewinnt", postenAusgemustert: "xxl-basketball" },
  { name: "Micaela Nardelli", username: "micaela.nardelli", email: "micaela.nardelli@gmx.ch", rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: "xxl-viergewinnt", postenAusgemustert: "xxl-basketball" },
  { name: "Lena Niederberger", username: "lena.niederberger", email: "lena.niederberger@quickline.ch", rolle: "HELFER", einsatz: [], postenSlug: null },
  { name: "Pia Oswald", username: "pia.oswald", email: "pia.oswald07@gmail.com", rolle: "HELFER", einsatz: ["Festwirtschaft"], postenSlug: null },
  { name: "Salome Peterhans", username: "salome.peterhans", email: "salomepeterhans2@gmail.com", rolle: "HELFER", einsatz: ["Eintrichten Platz"], postenSlug: null },
  { name: "Luca Raffi", username: "luca", email: null, rolle: "HELFER", einsatz: ["Rechnungsbüro"], postenSlug: null },
  { name: "Michèle Rast", username: "michele.rast", email: "michele.rast@hotmail.com", rolle: "HELFER", einsatz: ["Festwirtschaft"], postenSlug: null },
  { name: "Leonie Rebsamen", username: "leonie.rebsamen", email: "rebsamenleonie@gmail.com", rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: "menschenkugelbahn", postenAusgemustert: "geschicklichkeits-parcour" },
  { name: "Naomi Sarbach", username: "naomi.sarbach", email: "naomi.sarbach@hotmail.com", rolle: "HELFER", einsatz: ["Aufräumen"], postenSlug: null },
  { name: "Cyrill Schreiber", username: "cyrill.schreiber", email: "cyrillschreiber@gmx.ch", rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: "human-soccer" },
  { name: "Gregor Siegrist", username: "gregor.siegrist", email: "gregor.siegrist@bluewin.ch", rolle: "HELFER", einsatz: ["Eintrichten Platz"], postenSlug: null },
  { name: "Andrine Steimen", username: "andrine.steimen", email: "andrinesteimen@icloud.com", rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: null, postenAusgemustert: "eierfall" },
  { name: "Aline Stierli", username: "aline.stierli", email: "aline.stierli@hotmail.com", rolle: "HELFER", einsatz: [], postenSlug: null },
  { name: "Roger Strasser", username: "roger", email: "roger.strasser@gmx.de", rolle: "HELFER", einsatz: ["Speaker"], postenSlug: null },
  { name: "Kevin Vazquez", username: "kevin.vazquez", email: null, rolle: "SCHIEDSRICHTER", einsatz: ["Kampfrichter"], postenSlug: "cornhole" },
  { name: "Gian Widmer", username: "gian", email: null, rolle: "HELFER", einsatz: ["Speaker", "Betreuung Teams"], postenSlug: null },
];
