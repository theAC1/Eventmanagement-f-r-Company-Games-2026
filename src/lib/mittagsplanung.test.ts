import { describe, expect, it } from "vitest";
import {
  MITTAG_DEFAULT,
  maximaleWellen,
  personenGesamt,
  planeMittag,
  spitzenBelegung,
  type MittagsfensterConfig,
} from "./mittagsplanung";

function teams(anzahl: number, kopfzahl = 6) {
  return Array.from({ length: anzahl }, (_, i) => ({
    id: `t${i + 1}`,
    name: `Team ${i + 1}`,
    teilnehmerAnzahl: kopfzahl,
  }));
}

describe("maximaleWellen", () => {
  it("rechnet Fenster minus Essenszeit auf dem Versatz-Raster ab", () => {
    // 11:30–13:30 = 120 min, davon 30 min Essenszeit ⇒ 90 min Spielraum,
    // alle 10 min eine Welle ⇒ 9 Versätze + die erste Welle = 10.
    expect(maximaleWellen(MITTAG_DEFAULT)).toBe(10);
  });

  it("gibt 0 zurück, wenn die Essenszeit nicht ins Fenster passt", () => {
    expect(maximaleWellen({ ...MITTAG_DEFAULT, bis: "11:45" })).toBe(0);
  });

  it("kommt mit Versatz 0 klar (alle gleichzeitig)", () => {
    expect(maximaleWellen({ ...MITTAG_DEFAULT, versatzMin: 0 })).toBe(1);
  });
});

describe("planeMittag", () => {
  it("verteilt 17 Teams zu dritt in Wellen mit 10 min Versatz", () => {
    const plan = planeMittag({ fenster: MITTAG_DEFAULT, teams: teams(17) });

    expect(plan.wellen).toHaveLength(6); // ceil(17/3)
    expect(plan.hinweise.filter((h) => h.startsWith("WARN"))).toHaveLength(0);
    expect(plan.wellen[0].startZeit).toBe("11:30");
    expect(plan.wellen[1].startZeit).toBe("11:40");
    expect(plan.wellen[0].endZeit).toBe("12:00");

    const zugeteilt = plan.wellen.flatMap((w) => w.teamIds);
    expect(new Set(zugeteilt).size).toBe(17);
    for (const welle of plan.wellen) {
      expect(welle.teamIds.length).toBeLessThanOrEqual(3);
    }
  });

  it("bleibt im Fenster und vergrössert stattdessen die Gruppen", () => {
    const eng: MittagsfensterConfig = {
      von: "12:00",
      bis: "12:50",
      dauerMin: 30,
      teamsProWelle: 2,
      versatzMin: 10,
    };
    const plan = planeMittag({ fenster: eng, teams: teams(20) });

    expect(plan.wellen).toHaveLength(3); // (50-30)/10 + 1
    expect(plan.teamsProWelle).toBe(7);
    expect(plan.hinweise.some((h) => h.startsWith("WARN"))).toBe(true);
    const letzte = plan.wellen[plan.wellen.length - 1];
    expect(letzte.endZeit).toBe("12:50");
  });

  it("zählt Teilnehmer, Posten-Crew und freie Helfer zur Kopfzahl", () => {
    const plan = planeMittag({
      fenster: { ...MITTAG_DEFAULT, teamsProWelle: 2 },
      teams: teams(4, 5),
      posten: [
        { id: "g1", name: "Cornhole", crewGroesse: 3 },
        { id: "g2", name: "Human Soccer", crewGroesse: 4 },
      ],
      freieHelfer: [{ id: "h1", name: "Helfer 1" }],
    });

    expect(plan.wellen).toHaveLength(2);
    // 4 Teams à 5 = 20, Crew 3+4 = 7, 1 freier Helfer
    expect(personenGesamt(plan.wellen)).toBe(28);
    expect(plan.wellen[0].postenNamen).toEqual(["Cornhole"]);
    expect(plan.wellen[1].postenNamen).toEqual(["Human Soccer"]);
  });

  it("meldet Teams ohne Teilnehmerzahl, statt sie stillschweigend zu zählen", () => {
    const plan = planeMittag({
      fenster: MITTAG_DEFAULT,
      teams: [{ id: "t1", name: "Team 1", teilnehmerAnzahl: null }],
    });
    expect(plan.hinweise.some((h) => h.startsWith("INFO"))).toBe(true);
    expect(personenGesamt(plan.wellen)).toBe(0);
  });

  it("weist ein unbrauchbares Fenster zurück, statt zu raten", () => {
    const plan = planeMittag({
      fenster: { ...MITTAG_DEFAULT, von: "13:00", bis: "13:10" },
      teams: teams(4),
    });
    expect(plan.wellen).toHaveLength(0);
    expect(plan.hinweise[0]).toContain("kürzer als die Essenszeit");
  });

  it("erkennt eine ungültige Zeitangabe", () => {
    const plan = planeMittag({
      fenster: { ...MITTAG_DEFAULT, von: "elf uhr" },
      teams: teams(4),
    });
    expect(plan.wellen).toHaveLength(0);
    expect(plan.hinweise[0]).toContain("keine gültige Zeitangabe");
  });

  it("liefert nichts zurück, wenn niemand zu verpflegen ist", () => {
    const plan = planeMittag({ fenster: MITTAG_DEFAULT, teams: [] });
    expect(plan.wellen).toHaveLength(0);
    expect(plan.hinweise).toHaveLength(0);
  });
});

describe("spitzenBelegung", () => {
  it("misst die gleichzeitige Belegung über überlappende Wellen", () => {
    // Essenszeit 30 min, Versatz 10 min ⇒ bis zu drei Wellen überlappen sich.
    const plan = planeMittag({
      fenster: { ...MITTAG_DEFAULT, teamsProWelle: 2 },
      teams: teams(6, 10),
    });
    expect(plan.wellen).toHaveLength(3);
    expect(spitzenBelegung(plan.wellen)).toBe(60);
  });
});
