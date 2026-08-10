"use client";

import { useEffect, useRef } from "react";
import { parseScrollY, scrollKey } from "@/lib/view-state";

/**
 * Wie viele Frames maximal auf das endgueltige Layout gewartet wird.
 * Listen bekommen ihre Hoehe teils erst nach dem ersten Paint (Bilder, Fonts);
 * ohne diese Nachfassversuche landet die Wiederherstellung am Seitenende.
 */
const MAX_LAYOUT_FRAMES = 10;

/** Storage ist Komfort — faellt er aus, laeuft die Seite ohne Gedaechtnis weiter. */
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

/**
 * Merkt sich die Scrollposition einer Seite und stellt sie wieder her, sobald
 * der Inhalt steht.
 *
 * Noetig, weil der "Zurueck"-Knopf in dieser App ein normaler Link ist: Next.js
 * behandelt das als Vorwaertsnavigation und springt bewusst nach oben. Und
 * selbst die Wiederherstellung des Browsers kaeme zu frueh, weil die Listen
 * ihre Daten erst clientseitig nachladen.
 *
 * @param id    Stabiler Name der Ansicht, z.B. "admin:materials".
 * @param ready `true`, sobald die Liste gerendert ist (also nach dem Laden).
 */
export function useScrollRestore(id: string, ready: boolean): void {
  const key = scrollKey(id);
  const restoredRef = useRef(false);

  // Phase 1: Position wiederherstellen, sobald der Inhalt da ist.
  useEffect(() => {
    if (!ready || restoredRef.current) return;

    const target = parseScrollY(readRaw(key));
    if (target === 0) {
      restoredRef.current = true;
      return;
    }

    let frame = 0;
    let handle = 0;

    const attempt = () => {
      window.scrollTo(0, target);
      frame += 1;
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll < target && frame < MAX_LAYOUT_FRAMES) {
        handle = window.requestAnimationFrame(attempt);
        return;
      }
      restoredRef.current = true;
    };

    handle = window.requestAnimationFrame(attempt);
    return () => window.cancelAnimationFrame(handle);
  }, [ready, key]);

  // Phase 2: Position mitschreiben — erst nach der Wiederherstellung, sonst
  // ueberschreibt die 0 vom Seitenanfang den gemerkten Wert.
  useEffect(() => {
    if (!ready) return;

    let handle = 0;
    let pending = false;

    const persist = () => {
      pending = false;
      if (!restoredRef.current) return;
      writeRaw(key, String(Math.round(window.scrollY)));
    };

    const onScroll = () => {
      if (pending) return;
      pending = true;
      handle = window.requestAnimationFrame(persist);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    // Beim Verlassen (Tab-Wechsel, Schliessen) den letzten Stand sichern.
    window.addEventListener("pagehide", persist);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", persist);
      if (pending) window.cancelAnimationFrame(handle);
      persist();
    };
  }, [ready, key]);
}
