"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "cg26-theme";

type Theme = "dark" | "light";

function subscribeToTheme(callback: () => void): () => void {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/**
 * Umschalter Dark/Light. Das Standard-Theme ist dunkel (Leitstand);
 * die Wahl wird in localStorage gehalten und vor der Hydration per
 * Inline-Script im Root-Layout angewendet (kein Aufblitzen).
 * Der Zustand wird direkt vom <html data-theme>-Attribut abgeleitet.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore<Theme>(subscribeToTheme, readTheme, () => "dark");

  const toggle = useCallback(() => {
    const next: Theme = readTheme() === "light" ? "dark" : "light";
    const root = document.documentElement;

    root.setAttribute("data-theme-transition", "");
    root.dataset.theme = next;
    window.setTimeout(() => root.removeAttribute("data-theme-transition"), 400);

    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Privater Modus ohne Storage — Wahl gilt nur für diese Seite */
    }
  }, []);

  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Zu dunklem Design wechseln" : "Zu hellem Design wechseln"}
      title={isLight ? "Dunkles Design" : "Helles Design"}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-2 transition-colors duration-200 hover:border-line-strong hover:text-ink ${className}`}
    >
      {/* Sonne/Mond — bewusst schlicht, 16px Strichzeichnung */}
      {isLight ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8Z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )}
    </button>
  );
}
