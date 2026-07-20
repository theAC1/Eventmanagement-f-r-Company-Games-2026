---
name: Situationsplan GridStack integration
description: Durable design rules for the GridStack-based admin Situationsplan map editor.
---

The admin Situationsplan map uses GridStack.js for drag/resize of fields over a fixed-aspect map image.

**React + GridStack coexistence rule:** once GridStack owns an item's DOM, React must never re-write its grid coords on that live element. Snapshot coords at mount and force a *full remount* (via a key) only on structural / rotation / scale changes — never on plain drag/resize.
**Why:** mixing React re-renders with GridStack's imperative DOM mutation makes fields jump back or duplicate.

**Coordinate model is container-independent:** with a fixed column count and square cells, the percent↔grid conversion cancels out container width/height, so it works at any render size. Keep the data model as center-percent `(x,y)` + metres; only the interaction layer is GridStack.

**Partial-update saves are mandatory:** drag saves x/y, resize saves size, metadata edits save their field — each PUT must send ONLY changed fields, and the position/custom update routes must merge (never default rotation to 0), or a drag silently wipes a field's rotation.
**Why:** a completion review rejected the task twice for exactly this — rotation reset on partial updates.

**Infra type contract:** the infra button list, API validation, and the Prisma `InfraTyp` enum must stay in lockstep; the enum has been changed by other tasks before, silently breaking placement. Validate `typ` against the enum and return 400 on mismatch.
