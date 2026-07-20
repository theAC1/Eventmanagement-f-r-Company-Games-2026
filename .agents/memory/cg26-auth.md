---
name: CG26 auth & scoreboard pitfalls
description: Non-obvious auth and scoreboard behaviors in the CG26 api-server.
---

- Auth is enforced by an inline `requireRole(req, res, "ROLE")` helper call at the top of each route (returns the user or sends 401/403) — NOT Express middleware, so a new route with no such call is silently unprotected.
- Score entry requires an active GamedayConfig (modus != INAKTIV); modus TEST marks results `istTest` so they can be purged later — don't treat TEST scores as real.
- The scoreboard shows aggregated Rangpunkte (rank per game, lowest sum wins), NOT raw gamePunkte. This is intended — don't "fix" it as a display bug.
