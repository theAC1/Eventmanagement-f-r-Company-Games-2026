# PRODUCT.md — Company Games 2026

> Abgeleitet aus dem Redesign-Brief, Repo-Dokumentation und Projektgedächtnis.
> Mit **[Annahme]** markierte Punkte sind nicht explizit bestätigt.

## Was das Produkt ist

Event-Management-Plattform für die Company Games 2026 (Firmen-Sportevent,
September 2026): Games, Teams, Material, Zeitplan, Einsatzplan, Lageplan,
Live-Ergebniserfassung durch Schiedsrichter und Team-/Gast-Ansichten.

## Wer es benutzt, wo, unter welchen Bedingungen

- **Orga/Leitstand (Admin):** Desktop/Laptop, drinnen; überwacht am Eventtag
  Stationen, Ergebnisse, Rangkampf. Dichte Tabellen, schnelle Scanbarkeit.
- **Schiedsrichter:** Handy (390er-Breite) und Tablet, draussen, teils in
  praller Sonne, mit einer Hand bedient. Grosse Trefferflächen (56–76 px),
  Live-Erfassung mit Zählern; Offline-Queue existiert bereits.
- **Teams/Gäste:** Handy, per Token-Link/QR; sehen Tagesplan, Regeln, Rang.
- Sprache: Deutsch (Schweiz), "ss" statt "ß". Ziffern in Mono mit
  tabular-nums (Zeiten, Punkte).

## Modus

Operate — alle Flächen dienen der Aufgabenerledigung am Eventtag.
Scanbarkeit und Zustandsklarheit schlagen Expression.

## Visuelle Autorität

`Redesign/Company-Games-2026-Redesign.html` (Claude-Design-Comp, 8 Screens)
ist der massgebliche Look: dunkles Leitstand-Theme (#0A111C-Welt), Geist +
JetBrains Mono, Himmelblau #3DA5E5 als Aktionsfarbe, Statusfarben
HOT #E23B30 / Fertig #34C77B / Läuft #E7A83A. Dazu kommt eine helle
Theme-Variante mit Umschalter (Dark ist Standard). **[Annahme]** Screens
ohne Redesign-Vorlage (Login, Benutzer, KVP, Zeitplan, Einsatzplan,
Scoreboard) übernehmen dasselbe System sinngemäss.

## Technische Leitplanken

- Next.js 16 App Router, Tailwind v4 (Token via `@theme` in `globals.css`),
  next-auth v4, Prisma/Postgres, Docker-Deploy auf eigenem Server.
- Motion: CSS-first (Transitions/Keyframes), Feedback und Zustandswechsel,
  keine Ladechoreografie; `prefers-reduced-motion` wird respektiert.
- Keine neuen Laufzeit-Abhängigkeiten für Design/Motion. **[Annahme]**
