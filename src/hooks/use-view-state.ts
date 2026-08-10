"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  parseViewState,
  serializeViewState,
  viewStateKey,
} from "@/lib/view-state";

/**
 * sessionStorage ist nicht ueberall verfuegbar (privater Modus, volle Quota,
 * gesperrte Cookies). Der Zustand ist Komfort, kein Datenbestand — faellt der
 * Speicher aus, arbeitet die Seite einfach ohne Gedaechtnis weiter.
 */
function readRaw(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Nicht speicherbar: bewusst folgenlos, siehe Kommentar oben.
  }
}

export interface ViewStateHandle<T extends object> {
  /** Aktueller Ansichts-Zustand. Vor `ready` sind das die Standardwerte. */
  view: T;
  /** Aendert einzelne Felder — immer als neues Objekt, nie in-place. */
  setView: (patch: Partial<T> | ((prev: T) => Partial<T>)) => void;
  /** Setzt die Ansicht auf die Standardwerte zurueck. */
  resetView: () => void;
  /**
   * `true`, sobald der gespeicherte Zustand geladen ist.
   * Seiten, die anhand der Filter laden, warten darauf — sonst laeuft der erste
   * Fetch mit den Standardfiltern und wird sofort wieder verworfen.
   */
  ready: boolean;
}

/**
 * Haelt den Ansichts-Zustand einer Seite (Filter, Suche, zugeklappte Gruppen,
 * aktiver Tab) im sessionStorage — er ueberlebt damit Navigation und Reload,
 * aber nicht das Schliessen des Tabs.
 *
 * Der erste Render liefert bewusst die Standardwerte, damit Server- und
 * Client-Markup identisch sind; der gespeicherte Zustand kommt direkt danach.
 *
 * @param id     Stabiler Name der Ansicht, z.B. "admin:materials".
 * @param defaults Standardwerte. Muss eine stabile Referenz sein (Modul-Konstante).
 */
export function useViewState<T extends object>(
  id: string,
  defaults: T,
): ViewStateHandle<T> {
  const [view, setViewState] = useState<T>(defaults);
  const [ready, setReady] = useState(false);

  // Standardwerte bleiben ueber die Lebensdauer gleich; die Ref haelt sie aus
  // den Effect-Dependencies heraus, falls ein Aufrufer doch inline uebergibt.
  const defaultsRef = useRef(defaults);
  const key = viewStateKey(id);

  useEffect(() => {
    setViewState(parseViewState(readRaw(key), defaultsRef.current));
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    writeRaw(key, serializeViewState(view));
  }, [ready, key, view]);

  const setView = useCallback(
    (patch: Partial<T> | ((prev: T) => Partial<T>)) => {
      setViewState((prev) => ({
        ...prev,
        ...(typeof patch === "function" ? patch(prev) : patch),
      }));
    },
    [],
  );

  const resetView = useCallback(() => {
    setViewState({ ...defaultsRef.current });
  }, []);

  return { view, setView, resetView, ready };
}
