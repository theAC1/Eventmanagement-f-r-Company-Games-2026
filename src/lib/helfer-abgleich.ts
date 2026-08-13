/**
 * Abgleich der konsolidierten Helferliste mit den Accounts, die schon in der
 * Datenbank liegen — ohne Datenbank, damit die Regeln testbar bleiben.
 *
 * Der Import ist eine Zusammenführung, kein Überschreiben: Accounts, die die
 * Orga von Hand angelegt hat, sollen ihre Rolle und ihre Kontaktdaten
 * behalten. Ergänzt wird nur, was fehlt.
 */

import type { PersonRolle } from "@prisma/client";

/** Rangfolge der Rollen — der Import stuft nie herunter. */
export const ROLLEN_RANG: Record<PersonRolle, number> = {
  HELFER: 1,
  SCHIEDSRICHTER: 2,
  ORGA: 3,
  ADMIN: 4,
  OWNER: 5,
};

/** Soll-Zustand einer Person, wie er aus den Excel-Listen hervorgeht. */
export type HelferSoll = {
  name: string;
  username: string;
  email: string | null;
  rolle: PersonRolle;
};

/** Ist-Zustand eines Accounts in der Datenbank. */
export type BestandsPerson = {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  rolle: PersonRolle;
};

/** Was an einem bestehenden Account geändert werden muss. */
export type Aenderungen = {
  name?: string;
  email?: string;
  rolle?: PersonRolle;
  username?: string;
};

export type Abgleich = {
  anlegen: HelferSoll[];
  aktualisieren: { person: BestandsPerson; soll: HelferSoll; aenderungen: Aenderungen }[];
  unveraendert: { person: BestandsPerson; soll: HelferSoll }[];
  /** Fälle, die ein Mensch anschauen muss — der Import fasst sie nicht an. */
  konflikte: { soll: HelferSoll; grund: string }[];
  /** Accounts in der Datenbank, die in keiner der beiden Listen vorkommen. */
  unbekannt: BestandsPerson[];
};

/**
 * Vergleichsform eines Namens: klein, ohne Umlaut-Eigenheiten, ohne doppelte
 * Leerzeichen. «Müller» und «Mueller» sollen dieselbe Person finden, weil die
 * beiden Excel-Listen sich darin nicht einig sind.
 */
export function normalisiereName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

/** Die höhere der beiden Rollen — Grundlage der Regel «nie herunterstufen». */
export function hoehereRolle(a: PersonRolle, b: PersonRolle): PersonRolle {
  return ROLLEN_RANG[a] >= ROLLEN_RANG[b] ? a : b;
}

/**
 * Sucht den passenden Account: erst über den Username, dann über den Namen,
 * zuletzt über die E-Mail. Der Username hat Vorrang, weil die bestehenden
 * Orga-Accounts nur Vornamen tragen («juan») und über den Namen nicht zu
 * finden wären.
 */
export function findeBestand(
  soll: HelferSoll,
  bestand: readonly BestandsPerson[],
): BestandsPerson | null {
  const perUsername = bestand.find(
    (p) => p.username && p.username.toLowerCase() === soll.username.toLowerCase(),
  );
  if (perUsername) return perUsername;

  const gesucht = normalisiereName(soll.name);
  const perName = bestand.find((p) => normalisiereName(p.name) === gesucht);
  if (perName) return perName;

  if (!soll.email) return null;
  const mail = soll.email.toLowerCase();
  return bestand.find((p) => p.email && p.email.toLowerCase() === mail) ?? null;
}

/**
 * Was an einem gefundenen Account zu ändern ist.
 *
 * Ergänzt wird nur Fehlendes: eine bereits hinterlegte, abweichende E-Mail
 * bleibt stehen (sie kann die aktuellere sein), ebenso ein bestehender
 * Username — Logins umzubenennen würde Leute aussperren.
 */
export function berechneAenderungen(
  person: BestandsPerson,
  soll: HelferSoll,
): Aenderungen {
  const aenderungen: Aenderungen = {};

  if (person.name !== soll.name) aenderungen.name = soll.name;
  if (!person.email && soll.email) aenderungen.email = soll.email;
  if (!person.username) aenderungen.username = soll.username;

  const ziel = hoehereRolle(person.rolle, soll.rolle);
  if (ziel !== person.rolle) aenderungen.rolle = ziel;

  return aenderungen;
}

/**
 * Stellt den vollständigen Abgleich zusammen. Reine Funktion: sie liest
 * nichts und schreibt nichts, sie beschreibt nur, was zu tun wäre.
 */
export function planeAbgleich(
  soll: readonly HelferSoll[],
  bestand: readonly BestandsPerson[],
): Abgleich {
  const abgleich: Abgleich = {
    anlegen: [],
    aktualisieren: [],
    unveraendert: [],
    konflikte: [],
    unbekannt: [],
  };
  const verbraucht = new Set<string>();

  for (const eintrag of soll) {
    const person = findeBestand(eintrag, bestand);

    if (!person) {
      abgleich.anlegen.push(eintrag);
      continue;
    }

    if (verbraucht.has(person.id)) {
      abgleich.konflikte.push({
        soll: eintrag,
        grund: `Account "${person.name}" passt auf mehrere Listeneinträge — bitte von Hand klären.`,
      });
      continue;
    }
    verbraucht.add(person.id);

    if (person.email && eintrag.email && person.email.toLowerCase() !== eintrag.email.toLowerCase()) {
      abgleich.konflikte.push({
        soll: eintrag,
        grund: `E-Mail weicht ab: gespeichert "${person.email}", Liste "${eintrag.email}" — gespeicherte bleibt.`,
      });
    }

    const aenderungen = berechneAenderungen(person, eintrag);
    if (Object.keys(aenderungen).length === 0) {
      abgleich.unveraendert.push({ person, soll: eintrag });
    } else {
      abgleich.aktualisieren.push({ person, soll: eintrag, aenderungen });
    }
  }

  abgleich.unbekannt = bestand.filter((p) => !verbraucht.has(p.id));
  return abgleich;
}
