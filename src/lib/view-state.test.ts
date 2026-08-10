import { describe, it, expect } from "vitest";
import {
  parseScrollY,
  parseViewState,
  scrollKey,
  serializeViewState,
  toggleInList,
  viewStateKey,
} from "./view-state";

const DEFAULTS = {
  filterGame: "",
  filterStatus: "",
  search: "",
  collapsed: [] as string[],
  expandedId: null as string | null,
  page: 1,
  compact: false,
};

describe("viewStateKey / scrollKey", () => {
  it("sollte Schlüssel mit App-Präfix bilden", () => {
    expect(viewStateKey("admin:materials")).toBe("cg26:view:admin:materials");
    expect(scrollKey("admin:materials")).toBe("cg26:scroll:admin:materials");
  });

  it("sollte Ansicht und Scrollposition getrennt halten", () => {
    expect(viewStateKey("admin:kvp")).not.toBe(scrollKey("admin:kvp"));
  });
});

describe("parseViewState", () => {
  it("sollte bei fehlendem Eintrag die Standardwerte liefern", () => {
    expect(parseViewState(null, DEFAULTS)).toEqual(DEFAULTS);
    expect(parseViewState(undefined, DEFAULTS)).toEqual(DEFAULTS);
    expect(parseViewState("", DEFAULTS)).toEqual(DEFAULTS);
  });

  it("sollte die Standardwerte nicht mutieren", () => {
    const result = parseViewState('{"search":"zelt","collapsed":["a"]}', DEFAULTS);
    expect(result).not.toBe(DEFAULTS);
    expect(DEFAULTS.search).toBe("");
    expect(DEFAULTS.collapsed).toEqual([]);
    expect(result.search).toBe("zelt");
  });

  it("sollte gespeicherte Werte über die Standardwerte legen", () => {
    const raw = serializeViewState({
      ...DEFAULTS,
      filterStatus: "OFFEN",
      search: "bierbank",
      collapsed: ["game-1", "game-2"],
      page: 3,
      compact: true,
    });
    expect(parseViewState(raw, DEFAULTS)).toEqual({
      filterGame: "",
      filterStatus: "OFFEN",
      search: "bierbank",
      collapsed: ["game-1", "game-2"],
      expandedId: null,
      page: 3,
      compact: true,
    });
  });

  it("sollte fehlende Schlüssel aus den Standardwerten ergänzen", () => {
    const result = parseViewState('{"search":"zelt"}', DEFAULTS);
    expect(result.search).toBe("zelt");
    expect(result.filterStatus).toBe("");
    expect(result.collapsed).toEqual([]);
    expect(result.page).toBe(1);
  });

  it("sollte unbekannte Schlüssel verwerfen", () => {
    const result = parseViewState(
      '{"search":"zelt","__proto__":"x","fremdesFeld":42}',
      DEFAULTS,
    );
    expect(result).toEqual({ ...DEFAULTS, search: "zelt" });
    expect(Object.keys(result).sort()).toEqual(Object.keys(DEFAULTS).sort());
  });

  it("sollte kaputtes JSON auf die Standardwerte zurückfallen lassen", () => {
    expect(parseViewState("{nicht wirklich json", DEFAULTS)).toEqual(DEFAULTS);
  });

  it("sollte Nicht-Objekte auf die Standardwerte zurückfallen lassen", () => {
    expect(parseViewState('"text"', DEFAULTS)).toEqual(DEFAULTS);
    expect(parseViewState("42", DEFAULTS)).toEqual(DEFAULTS);
    expect(parseViewState("null", DEFAULTS)).toEqual(DEFAULTS);
    expect(parseViewState('["a"]', DEFAULTS)).toEqual(DEFAULTS);
  });

  it("sollte typfremde Werte einzeln ignorieren, den Rest aber behalten", () => {
    const result = parseViewState(
      '{"search":123,"filterStatus":"OFFEN","collapsed":"kein array","page":"drei"}',
      DEFAULTS,
    );
    expect(result.search).toBe("");
    expect(result.collapsed).toEqual([]);
    expect(result.page).toBe(1);
    expect(result.filterStatus).toBe("OFFEN");
  });

  it("sollte Arrays mit Objekt-Elementen ablehnen", () => {
    const result = parseViewState('{"collapsed":[{"a":1}]}', DEFAULTS);
    expect(result.collapsed).toEqual([]);
  });

  it("sollte gespeicherte Arrays kopieren statt zu referenzieren", () => {
    const raw = '{"collapsed":["a","b"]}';
    const first = parseViewState(raw, DEFAULTS);
    const second = parseViewState(raw, DEFAULTS);
    first.collapsed.push("c");
    expect(second.collapsed).toEqual(["a", "b"]);
  });

  it("sollte bei nullbarem Standardwert String und null zulassen", () => {
    expect(parseViewState('{"expandedId":"erg-1"}', DEFAULTS).expandedId).toBe(
      "erg-1",
    );
    expect(parseViewState('{"expandedId":null}', DEFAULTS).expandedId).toBeNull();
    expect(
      parseViewState('{"expandedId":{"a":1}}', DEFAULTS).expandedId,
    ).toBeNull();
  });

  it("sollte verschachtelte Objekte als Standardwert nie übernehmen", () => {
    // Der Ansichts-Zustand ist bewusst flach — alles Tiefere bleibt der Standard.
    const nested = { filter: { typ: "" } };
    expect(parseViewState('{"filter":{"typ":"BUG"}}', nested)).toEqual(nested);
  });

  it("sollte einen Rundlauf durch serialize/parse unverändert überstehen", () => {
    const state = {
      ...DEFAULTS,
      filterGame: "game-7",
      collapsed: ["__allgemein__"],
      expandedId: "erg-9",
      compact: true,
    };
    expect(parseViewState(serializeViewState(state), DEFAULTS)).toEqual(state);
  });
});

describe("parseScrollY", () => {
  it("sollte gültige Positionen als Zahl liefern", () => {
    expect(parseScrollY("0")).toBe(0);
    expect(parseScrollY("1280")).toBe(1280);
    expect(parseScrollY("42.7")).toBe(43);
  });

  it("sollte fehlende oder unbrauchbare Werte als 0 behandeln", () => {
    expect(parseScrollY(null)).toBe(0);
    expect(parseScrollY(undefined)).toBe(0);
    expect(parseScrollY("")).toBe(0);
    expect(parseScrollY("oben")).toBe(0);
    expect(parseScrollY("-500")).toBe(0);
    expect(parseScrollY("Infinity")).toBe(0);
  });
});

describe("toggleInList", () => {
  it("sollte einen fehlenden Schlüssel hinzufügen", () => {
    expect(toggleInList([], "game-1")).toEqual(["game-1"]);
    expect(toggleInList(["a"], "b")).toEqual(["a", "b"]);
  });

  it("sollte einen vorhandenen Schlüssel entfernen", () => {
    expect(toggleInList(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("sollte die Ursprungsliste nicht verändern", () => {
    const original = ["a"];
    const added = toggleInList(original, "b");
    const removed = toggleInList(original, "a");
    expect(original).toEqual(["a"]);
    expect(added).not.toBe(original);
    expect(removed).toEqual([]);
  });
});
