---
name: Situationsplan GridStack integration
description: How GridStack.js coexists with React on the admin Situationsplan map, and its coordinate model.
---

The admin Situationsplan map (`artifacts/company-games/src/app/admin/situationsplan/page.tsx`) uses GridStack.js for drag/resize of fields over a fixed-aspect map image.

**React + GridStack coexistence rule:** GridStack owns the DOM position of its items after init, so React must never re-write `gs-x/y/w/h` on existing items. The pattern: snapshot each item's grid coords once at mount, and force a full remount (via a `key` derived from item ids + rotations + mpp + a manual "remountTick") only on *structural / rotation / scale* changes — never on plain drag/resize. Drag/resize saves to the API and updates local React state, but must NOT trigger a remount or GridStack and React fight over inline styles.
**Why:** mixing React re-renders with GridStack's imperative DOM mutation causes fields to jump back or duplicate.

**Coordinate model:** column count is fixed (100), `cellHeight:"auto"` → square cells. The percent↔grid conversion is container-size-independent because container width cancels: X grid unit = 1% of width; Y grid unit = IMG_RATIO% of height. Data model stays center-percent `(x,y)` + metres `(laengeM,breiteM)` via `mpp`; only the interaction layer is GridStack.

**Game vs custom resize:** custom fields store their own `laengeM/breiteM`. Game positions have no size of their own — size lives on the `Game` (`flaecheLaengeM/flaecheBreiteM`), so resizing a game widget PUTs `/api/games/:id` and changes the game's canonical dimensions globally.
