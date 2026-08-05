---
name: Company Games 2026
description: Dunkles Leitstand-Design für Event-Betrieb — dichte Tabellen drinnen, grosse Tasten draussen.
colors:
  bg: "#0a111c"
  sunken: "#0d1726"
  surface: "#101b2b"
  raised: "#16243a"
  track: "#1a2739"
  cell-empty: "#141f31"
  cell-empty-border: "#1e2e45"
  line: "#1d2c44"
  line-soft: "#16233a"
  line-strong: "#24395a"
  line-key: "#2c3e58"
  ink: "#e9f0f8"
  ink-2: "#c8d6e8"
  ink-3: "#8a9cb8"
  label: "#7c90ae"
  faint: "#6b7f9c"
  disabled: "#3a4c68"
  nav-idle: "#93a7c4"
  action: "#3da5e5"
  action-hover: "#7cc4ef"
  action-tint: "#8fcbf2"
  on-action: "#06121d"
  action-dim: "rgba(61, 165, 229, 0.14)"
  action-dim-strong: "rgba(61, 165, 229, 0.16)"
  action-row: "rgba(61, 165, 229, 0.07)"
  action-ring: "rgba(61, 165, 229, 0.25)"
  hot: "#e23b30"
  hot-tint: "#f58d85"
  on-hot: "#fff3f2"
  hot-dim: "rgba(226, 59, 48, 0.14)"
  hot-border: "rgba(226, 59, 48, 0.45)"
  done: "#34c77b"
  done-tint: "#7adca9"
  done-dim: "rgba(52, 199, 123, 0.12)"
  done-dim-strong: "rgba(52, 199, 123, 0.2)"
  warn: "#e7a83a"
  warn-dim: "rgba(231, 168, 58, 0.12)"
  warn-row: "rgba(231, 168, 58, 0.05)"
  warn-border: "rgba(231, 168, 58, 0.35)"
  neutral-dim: "rgba(138, 156, 184, 0.1)"
  solo: "rgba(20, 140, 90, 0.62)"
  solo-border: "rgba(52, 199, 123, 0.9)"
  duell: "rgba(30, 111, 168, 0.62)"
  duell-border: "rgba(61, 165, 229, 0.9)"
  bronze: "#c4783c"
  scrim: "rgba(4, 8, 14, 0.66)"
typography:
  display:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "56px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  kpi:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.12em"
rounded:
  chip: "5px"
  nav: "8px"
  control: "9px"
  card: "10px"
  cta: "12px"
  touch: "14px"
  modal: "16px"
  pill: "999px"
spacing:
  gutter-mobile: "16px"
  gutter-touch: "18px"
  gutter-desktop: "22px"
  grid-gap: "14px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.on-action}"
    rounded: "{rounded.control}"
    height: "34px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  button-ghost:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    height: "34px"
    padding: "0 12px"
  button-cta:
    backgroundColor: "{colors.action}"
    textColor: "{colors.on-action}"
    rounded: "{rounded.cta}"
    height: "60px"
    padding: "0 20px"
  button-danger:
    backgroundColor: "{colors.hot}"
    textColor: "{colors.on-hot}"
    rounded: "{rounded.touch}"
    height: "64px"
    padding: "0 24px"
  pill-status:
    rounded: "{rounded.pill}"
    padding: "4px 9px"
  counter-key-minus:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.touch}"
    size: "76px"
  counter-key-plus:
    backgroundColor: "{colors.action-dim-strong}"
    textColor: "{colors.action-tint}"
    rounded: "{rounded.touch}"
    size: "76px"
  input-desktop:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "34px"
    padding: "0 12px"
---

# Design System: Company Games 2026

## Overview

**Creative North Star: "Der Leitstand"**

Company Games 2026 ist ein Betriebswerkzeug für einen Eventtag, kein Schaufenster. Das System ist ein dunkler Leitstand (#0A111C-Welt): tiefe Navy-Flächen, Haarlinien statt Schatten, kühle Text-Leiter, und genau vier Stimmfarben mit fester Bedeutung — Himmelblau für Aktion, Amber für Läuft/Verzug, Grün für Fertig, Rot für HOT/Abbruch. Zahlen sind die Hauptdarsteller: Zeiten, Punkte und Zähler stehen immer in JetBrains Mono mit tabular-nums, gross und eng gesetzt.

Das System skaliert über Kontext, nicht über Stil: dieselben Tokens tragen dichte 62px-Tabellenzeilen im Orga-Desktop und 60–76px-Trefferflächen auf Schiedsrichter-Handys in praller Sonne. Dark ist der Standard (Leitstand); eine helle Tageslicht-Variante remappt sämtliche Tokens über `[data-theme="light"]` — Komponenten kennen nur die Token-Namen, nie das Theme. Motion ist CSS-first und rein funktional: einmalige Eintritte (`anim-rise`, `anim-pop`), Zähler-Feedback (`anim-count`), und `cgPulse` als einzige Endlos-Animation (der HOT-Punkt). `prefers-reduced-motion` schaltet global alles ab.

**Key Characteristics:**
- Dunkler Leitstand als Standard, helle Variante als vollständiges Token-Remapping
- Vier Statusfarben mit fester Semantik, immer als Text auf eigener Dim-Fläche
- Mono-Ziffern (`.tnum`) überall, ALL-CAPS-Mikrolabels (`.cg-label`) als Struktursignal
- Haarlinien statt Schatten; Schatten (`--shadow-pop`) nur für schwebende Ebenen
- Radius wächst mit der Trefferfläche: 9px Desktop-Controls, 12–14px Touch

## Colors

Eine kühle Navy-Leiter für Flächen und Text, darüber vier semantische Stimmfarben, jede mit Vollton, heller Tint-Stufe für Text und einer Low-Alpha-Dim-Fläche.

Alle Werte im Frontmatter sind die Dark-Theme-Werte (normativ). Die helle Variante definiert jeden Token in `globals.css` unter `:root[data-theme="light"]` neu — u. a. wird `on-action` dort weiss (#ffffff) und die Tints kippen dunkel. Komponenten referenzieren ausschliesslich Tokens (`var(--…)` bzw. Tailwind-`@theme`-Klassen wie `bg-action`, `text-ink-3`).

### Primary
- **Aktionsblau** (`action`, #3da5e5): Die einzige Handlungsfarbe — Primär-Buttons, CTAs, aktive Auswahl, Fokusring, Links. `action-hover` (#7cc4ef) beim Hover, `action-tint` (#8fcbf2) für Text auf blau getönten Chips und aktive Nav-Einträge, `action-dim`/`action-dim-strong` als getönte Füllungen, `action-row` (7 % Alpha) für selektierte Zeilen, `action-ring` für Auswahl-Ringe (Lageplan-Marker).
- **Auf Aktionsblau** (`on-action`, #06121d): Text auf blauen Flächen ist im Dark-Theme dunkles Navy — nicht weiss. (Light-Theme: weiss.)

### Secondary
- **HOT-Rot** (`hot`, #e23b30): Eskalation und Abbruch. `hot-tint` (#f58d85) für Rot-Text, `hot-dim` + `hot-border` für die HOT-Pill, `on-hot` (#fff3f2) auf Vollrot (Danger-Button, Stopp).
- **Fertig-Grün** (`done`, #34c77b): erledigt, erfasst, bestätigt. `done-tint` für Text, `done-dim` / `done-dim-strong` als Pill- und Button-Füllungen.
- **Läuft-Amber** (`warn`, #e7a83a): läuft, in Verzug, LIVE-Badge, Rang 1. `warn-dim` für Pills, `warn-row` (5 % Alpha) für die Live-Zeile, `warn-border` für Live-Rahmen.

### Tertiary
- **Lageplan-Flächen** (`solo` grünlich / `duell` bläulich, je mit `-border`): halbtransparente Stationsflächen auf dem Situationsplan.
- **Bronze** (#c4783c): Rang 3 in Rangliste und Scoreboard. Die Medaillenreihe ist `warn` (Gold) · `ink-2` (Silber) · `bronze`.

### Neutral
- **Flächenleiter** tief → hoch: `bg` (#0a111c, Seite) → `sunken` (#0d1726, Sidebar/Tabellenkopf/Eingabefüllung) → `surface` (#101b2b, Karten/Zeilen) → `raised` (#16243a, Tasten/Spec-Chips) → `track` (#1a2739, Balken-Hintergrund); `cell-empty` (+`-border`) für leere Zeitachsen-Zellen.
- **Linienleiter**: `line` (Struktur: Panels, Topbars) · `line-soft` (Zeilentrenner) · `line-strong` (interaktive Ränder: Buttons, Felder) · `line-key` (Zähler-Minus-Taste, Checkboxen).
- **Textleiter**: `ink` (primär) · `ink-2` (sekundäre Betonung) · `ink-3` (sekundärer Fliesstext) · `label` (ALL-CAPS-Labels, Tabellenköpfe) · `faint` (Chevrons, Fussnoten) · `disabled` · `nav-idle` (inaktive Navigation).
- **Sonstige**: `neutral-dim` (neutrale Pill-Füllung), `scrim` (Overlay hinter Drawer/Modal).

### Named Rules
**Die Dim-Flächen-Regel.** Status-Pills und -Chips setzen nie Volltonfarbe als Hintergrund: immer Tint-Text auf der zugehörigen Dim-Fläche (z. B. `hot-tint` auf `hot-dim`). Vollton ist Aktions- und Danger-Buttons vorbehalten.
**Die Navy-auf-Blau-Regel.** Im Dark-Theme steht auf Aktionsblau dunkles Navy (`on-action` #06121d), nie weiss. Weiss auf Blau gibt es nur im Light-Theme, wo der Token es selbst regelt.
**Die Token-Only-Regel.** Komponenten enthalten keine Hex-Werte; jede Farbe kommt aus `globals.css`-Tokens, damit das Light-Theme vollständig mitzieht.

## Typography

**Display Font:** Geist (mit system-ui, sans-serif) — via next/font, `--font-geist-sans`
**Body Font:** Geist
**Label/Mono Font:** JetBrains Mono (mit ui-monospace) — via next/font, `--font-geist-mono`, immer mit `font-variant-numeric: tabular-nums` (`.tnum`)

**Character:** Nüchtern und instrumentell. Geist trägt Labels und Fliesstext in kleinen, dichten Grössen; JetBrains Mono trägt alle Ziffern — von der 10px-Versionsnummer bis zur 72px-Punktezahl. Negative Laufweite (−0.02em bis −0.03em) auf allen grossen Graden.

### Hierarchy
- **Display** (Mono, 700, 56px mobil / 64px ab lg, lh 1, −0.02em): Timer, Stoppuhr, Zähler-Werte. Der Punkte-Hero im Team-Portal geht bis 72px (−0.03em).
- **KPI** (Mono, 600, 28px, lh 1, −0.02em): KPI-Band-Zahlen; Nenner daneben 14px `ink-3`.
- **Headline** (600, 18px, −0.02em): Topbar-Titel, Seitentitel auf Touch-Screens.
- **Title** (500–600, 14–16px): Zeilentitel in Tabellen (14/500), Kartentitel auf Touch (16/600).
- **Body** (400–500, 13px Desktop / 14–15px Touch, lh 1.4–1.45): Tabellenzellen, Formulartext, Regeln am Feld. Meta-Text 11–12px `ink-3`.
- **Label** (600, 10px, +0.12em, UPPERCASE, Farbe `label`): `.cg-label` — Sektionslabels, Tabellenköpfe, Formular-Labels. In Tabellenköpfen mit 0.1em Laufweite.

### Named Rules
**Die Mono-Ziffern-Regel.** Jede Zahl, die sich ändern oder verglichen werden kann — Zeiten, Punkte, Zähler, Nummern, Versionen — trägt `.tnum` (JetBrains Mono, tabular-nums). Keine Proportionalziffern in Daten.
**Die Zehn-Punkt-Label-Regel.** Struktur wird mit `.cg-label` (10px/600/0.12em/UPPERCASE) beschriftet, nicht mit grösseren Überschriften. Die Hierarchie entsteht durch Zahl- und Wertgrössen, nicht durch Titelgrössen.

## Layout

Drei Layout-Welten auf denselben Tokens:

- **Orga-Desktop (Admin):** Feste Sidebar 236px (`sunken`, Haarlinie rechts), Inhaltsspalte mit 60px-Topbar (Titel links, Meta/Aktionen rechts, Haarlinie unten), darunter optional ein KPI-Band (Grid-Zellen mit Haarlinien getrennt). Tabellen sind CSS-Grids mit expliziten Spaltenbreiten (`gridTemplateColumns`), 14px Spaltenabstand, 22px Seitenrand, Zeilenhöhe 62px, Trenner `line-soft`, Kopfzeile auf `sunken`. Unter `lg` kollabiert die Sidebar in einen 280px-Drawer (Scrim + `anim-pop`), Tabellen brechen in Karten (`surface`, Radius 10px) um.
- **Schiedsrichter (Handy/Tablet):** Einspaltig `max-w-md`, 18px-Gutter, ab `lg` zweispaltig `420px + 1fr` (Briefing links, Erfassung rechts). Fixe Bottom-Bar mit Haupt-CTA (`bg-bg/95` + backdrop-blur, Haarlinie oben). Trefferflächen 48–76px.
- **Team/Gast (Handy):** Einspaltig `max-w-md`, Sticky-Header 52px (`bg-bg/85` + backdrop-blur), Kartenstapel mit 14px-Abstand.

Vertikaler Rhythmus in kleinen Schritten (6/10/14/18px); Zellen-Padding 16px mobil / 22px Desktop. Dichte ist gewollt: der Orga-Screen zeigt viel, die Touch-Screens zeigen wenig gross.

## Elevation & Depth

Flach mit Haarlinien. Tiefe entsteht durch die tonale Flächenleiter (`bg` → `sunken` → `surface` → `raised`) und `line`-Trenner, nicht durch Schatten. Es gibt genau einen Schatten-Token für Ebenen, die tatsächlich über dem Inhalt schweben.

### Shadow Vocabulary
- **Pop** (`--shadow-pop: 0 18px 40px -18px rgba(2, 6, 12, 0.85)` dark / weicher im Light-Theme): Dropdowns, Modals, der schwebende KVP-Button, Detail-Popover im Leitstand. Immer kombiniert mit `line`-Rahmen und meist `anim-pop`.
- **Auswahl-Ring** (`0 0 0 4px var(--action-ring)`): Selektionszustand auf Lageplan-Flächen und -Markern.

Modale Ebenen liegen auf `scrim`; auf Touch-Screens zusätzlich backdrop-blur an Sticky-/Bottom-Bars.

### Named Rules
**Die Haarlinien-Regel.** Ruhende Flächen haben keinen Schatten. Wer einen Schatten trägt, schwebt (Modal, Dropdown, Floating Button) — und trägt `--shadow-pop`, keinen eigenen Wert.

## Shapes

Rechtecke mit ruhig wachsenden Radien; die Rundung folgt der Fingergrösse:

- **Chip** (5px): Modus-Chips in Tabellenzeilen.
- **Nav** (8px): Sidebar-Einträge, Avatar-Quadrat, Icon-Buttons.
- **Control** (9px): Desktop-Buttons und Eingabefelder (34px Höhe).
- **Card** (10px): Mobile Listenkarten, Popover.
- **CTA** (12px): grosse Touch-Buttons (60px), Touch-Eingabekacheln.
- **Touch** (14px): Zähler-Karten, Zähler-Tasten (76px), Danger-Button, Briefing-Panels.
- **Modal** (16px): Modals, KVP-Sheet, Punkte-Hero.
- **Pill** (999px): Status-Pills, HOT-Pill, Fortschrittsbalken, Theme-Toggle, Punkt-Indikatoren.

Rahmen sind 1px (`line` strukturell, `line-strong` interaktiv); betonte Zustandsrahmen 1.5px (`done`- und `hot-border`-Buttons, "Nächster Einsatz"-Karte).

## Components

Icons durchgehend `@phosphor-icons/react` mit `weight="bold"`, 14–18px.

### Buttons
- **Shape:** Desktop 34px hoch, Radius 9px; Touch-CTAs 60–64px hoch, Radius 12–14px.
- **Primary:** Aktionsblau mit Navy-Text (`bg-action text-on-action`), 13px/600; Hover hellt auf `action-hover`. Touch-Variante `cta` 60px/17px/700.
- **Ghost:** transparent mit `line-strong`-Rahmen, Text `ink-2`; Hover: Rahmen → `action`, Text → `ink`. Touch-Variante `cta-ghost` 60px.
- **Danger:** Vollrot (`bg-hot text-on-hot`), 64px/19px/700, Hover `brightness-110` — Abbruch/Stopp. Leichtere Stufe `danger-ghost` (34px, `hot-border`-Rahmen, `hot-tint`-Text).
- **Success-Outline:** 1.5px `done`-Rahmen auf `done-dim`, Text `done-tint` — Bestätigen/Start.
- **Zustände:** `transition-colors duration-150`; disabled = `opacity-50` (Formulare) bzw. `opacity-30` (Touch-Haupt-CTA); Fokus global `2px solid var(--action)` mit 2px Offset.

### Chips
- **Status-Pill** (`StatusPill`): Pill-Radius, 11px/600/+0.04em, Tint-Text auf Dim-Fläche; Töne `neutral / action / warn / done / done-strong / hot`. Status-Semantik: Amber = läuft/Verzug, Grün = erfasst/bestätigt, Blau = Orga-Eingriff (korrigiert), Neutral = ausstehend/Entwurf.
- **HOT-Pill:** 26px hoch, `hot-dim`-Füllung + `hot-border`, pulsierender 6px-Punkt (`anim-hot-pulse`).
- **Modus-Chip:** UPPERCASE 10px in Tabellen (Radius 5px) / 12px gross; DUELL blau getönt, SOLO grün getönt.
- **Spec-Chip:** `raised`-Fläche, Radius 6px (`rounded-md`), 12px Mono — Kenndaten wie "max 10 min", "8×6 m".

### Cards / Containers
- **Corner Style:** 10px (mobile Liste) / 14px (Touch-Panels) / 16px (Modals, Hero).
- **Background:** `surface`; Formular-/Kopfflächen `sunken`; Tasten `raised`.
- **Border:** immer 1px `line` (interaktiv: `line-strong`).
- **Shadow Strategy:** keiner auf ruhenden Karten; `--shadow-pop` nur auf schwebenden Ebenen.
- **Internal Padding:** 14–18px Touch, 16–24px Modals.

### Inputs / Fields
- **Desktop:** 34px, Radius 9px, `line-strong`-Rahmen, transparente oder `sunken`-Füllung, 13px, Placeholder `label`; Suchfeld mit Lupe links (Phosphor, 14px bold).
- **Touch-Zahleneingabe:** `sunken`-Füllung, Radius 9px, zentrierte 30px-Mono-Ziffer (`.tnum`), `inputMode="decimal"`.
- **Focus:** Rahmen → `action` (`focus:border-action`), kein Glow; global zusätzlich `:focus-visible`-Outline in `action`.

### Navigation
- **Sidebar (Orga):** 236px auf `sunken`, Gruppen mit `.cg-label`-Überschrift, Einträge 34px/13px/Radius 8px, Icon 16px bold. Idle `nav-idle`, Hover `sunken`-Füllung + `ink-2`, aktiv `action-dim`-Füllung + `action-tint` + 600. Badges als Mono-Zähler; das LIVE-Badge in `warn`. Footer: Initialen-Avatar (28px, Radius 8px), Rolle + Version in 10px Mono, Theme-Toggle, Abmelden.
- **Mobil:** 52px-Topbar mit Burger (36px-Icon-Button), Drawer 280px mit Scrim und `anim-pop`.
- **Theme-Toggle:** 32px-Kreis-Button mit 16px-Strichzeichnung (Sonne/Mond, Inline-SVG); Umschalt-Übergang 320ms auf alle Token-Konsumenten (`data-theme-transition`), Wahl in `localStorage`, vor Hydration per Inline-Script gesetzt.

### Zähler & Timer (Signature)
Das Erfassungswerkzeug der Schiedsrichter: Karte (Radius 14px, `surface`) mit Teamname + PUNKTE-Label, dazwischen die Wertzahl 64px Mono fett, flankiert von 76×76px-Tasten (mobil; 64px ab lg) — Minus auf `raised` mit `line-key`-Rahmen, Plus auf `action-dim-strong` mit `action`-Rahmen und `action-tint`-Text. Jede Wertänderung remountet die Zahl mit `anim-count` (Scale-Puls auf 1.12). Timer/Stoppuhr: 56–64px Mono zentriert; Überzeit kippt die Ziffer auf `hot-tint`. Auswahl-Kacheln (Level, Risiko, Geschafft/Nicht geschafft) sind min. 64px hoch: gewählt = Vollton (`action`) bzw. 1.5px-Zustandsrahmen (`done`/`hot`), ungewählt = `line-strong`-Rahmen.

### Motion
Tokens: `--ease-out: cubic-bezier(0.16,1,0.3,1)`, `--duration-fast: 120ms`, `--duration-base: 200ms`, `--duration-slow: 320ms`. Einsatz: `anim-rise` (einmaliger Seiteneintritt, 6px von unten), `anim-pop` (Modals/Dropdowns, Scale 0.97→1), `anim-count` (Zähler-Feedback), `anim-hot-pulse` (cgPulse 1.6s, die einzige Endlosschleife), Fortschrittsbalken-Breite 500ms. Farbwechsel auf Interaktion 150ms. `prefers-reduced-motion: reduce` reduziert global auf 0.01ms.

## Do's and Don'ts

### Do:
- **Do** jede Farbe aus den Tokens in `globals.css` beziehen (Tailwind-`@theme`-Klassen oder `var(--…)`), damit das Light-Theme vollständig mitkommt.
- **Do** alle Ziffern mit `.tnum` setzen und Sektionslabels mit `.cg-label` — das sind die zwei globalen Helfer, keine Ad-hoc-Nachbauten.
- **Do** auf Schiedsrichter- und Team-Screens Trefferflächen von mindestens 48px halten (Haupt-Tasten 60–76px) und Haupt-CTAs in einer fixen Bottom-Bar mit backdrop-blur führen.
- **Do** Statuszustände über die feste Semantik ausdrücken: Amber = läuft/Verzug, Grün = fertig/bestätigt, Rot = HOT/Abbruch, Blau = Aktion/Orga-Eingriff.
- **Do** neue Übergänge mit `--ease-out` und den drei Duration-Tokens bauen; Eintritte einmalig (`both`), kein Scroll-Theater.

### Don't:
- **Don't** Status-Pills mit Volltonfarbe füllen — Tint auf Dim-Fläche ist der Pill-Kontrakt; Vollton gehört Buttons.
- **Don't** im Dark-Theme weissen Text auf Aktionsblau setzen; `on-action` ist dort dunkles Navy.
- **Don't** ruhenden Karten oder Zeilen Schatten geben; `--shadow-pop` ist schwebenden Ebenen vorbehalten, und es gibt keinen zweiten Schatten-Wert.
- **Don't** neue Endlos-Animationen einführen; `cgPulse` (HOT-Punkt) ist die einzige Schleife im System.
- **Don't** Radien ausserhalb der Leiter (5/8/9/10/12/14/16/999px) erfinden oder Desktop-Controls über 34px Höhe aufblasen.
- **Don't** "ß" verwenden — Schweizer Rechtschreibung ("ss"), Sprache Deutsch (CH), Zahlenformat `de-CH`.
