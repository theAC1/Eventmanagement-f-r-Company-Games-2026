---
name: CG26 auth pattern
description: How auth works in the CG26 api-server (cookie, JWT, role checks)
---

- Auth cookie is `cg26-auth`; JWT signed with `SESSION_SECRET` env var.
- Routes call `requireRole(req, res, "ROLE")` helper inline (returns user or sends 401/403), not Express middleware.
- Login: POST /api/auth/login with `{username, password}` (bcrypt).
- Score entry (POST /api/ergebnisse) requires an active GamedayConfig (modus != INAKTIV); modus TEST marks results `istTest`.
- Scoreboard (/scoreboard → /api/rangliste) shows aggregated Rangpunkte (rank per game, lowest sum wins), NOT raw gamePunkte — don't mistake this for a display bug.
