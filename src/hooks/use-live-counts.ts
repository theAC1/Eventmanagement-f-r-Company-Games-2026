"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, aufDatenAenderung } from "@/lib/api-client";
import type { AdminCounts } from "@/app/api/admin/counts/route";

export type { AdminCounts };

/**
 * Hält die Zahlen der Navigation aktuell.
 *
 * Das Layout ist eine Server-Komponente — ihre Zahlen frieren beim ersten
 * Rendern ein und blieben auch nach dem Anlegen oder Löschen eines Teams
 * stehen. Der Hook nimmt sie als Startwert und lädt neu, sobald irgendwo eine
 * Änderung gemeldet wird (siehe `meldeDatenAenderung`) oder das Fenster wieder
 * in den Vordergrund kommt.
 */
export function useLiveCounts(initial: AdminCounts): AdminCounts {
  const [counts, setCounts] = useState(initial);

  const laden = useCallback(async () => {
    try {
      setCounts(await apiFetch<AdminCounts>("/api/admin/counts"));
    } catch {
      // Die Navigation darf an einer fehlgeschlagenen Zahl nicht scheitern —
      // der letzte bekannte Stand bleibt stehen.
    }
  }, []);

  useEffect(() => {
    const ab = aufDatenAenderung(() => void laden());

    const beiFokus = () => {
      if (document.visibilityState === "visible") void laden();
    };
    window.addEventListener("focus", beiFokus);
    document.addEventListener("visibilitychange", beiFokus);

    // Erstabgleich nach dem ersten Render: die serverseitigen Startwerte kennen
    // den Zeitplan-Status noch nicht. Bewusst ausserhalb des Effekt-Rumpfs,
    // damit daraus kein Render direkt im Effekt wird.
    const start = window.setTimeout(() => void laden(), 0);

    return () => {
      ab();
      window.clearTimeout(start);
      window.removeEventListener("focus", beiFokus);
      document.removeEventListener("visibilitychange", beiFokus);
    };
  }, [laden]);

  return counts;
}
