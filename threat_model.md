# Threat Model

## Project Overview

Company Games 2026 (CG26) is an internal corporate games-day management platform. It consists of:
- **API server** (`artifacts/api-server`): Express 5 + TypeScript backend, PostgreSQL via Prisma ORM. JWT-based auth stored in an httpOnly cookie (and optionally as a Bearer token for the mobile app).
- **Web frontend** (`artifacts/company-games`): React/Vite SPA served separately.
- **Mobile companion** (`artifacts/company-games-mobile`): Expo/React Native app with a standalone Node.js static-file server (`serve.js`).
- **Pitch deck / canvas**: Dev/presentation artifacts, not production-facing.

Users are internal: ADMIN, ORGA, SCHIEDSRICHTER (referee), HELFER roles. Teams access a read-only portal via a static QR token embedded in a URL (no login required). The app is not yet deployed (no active Replit deployment found).

## Assets

- **User credentials** – bcrypt-hashed passwords, JWT session tokens in `cg26-auth` cookie. Compromise allows account takeover and full admin access.
- **JWT signing secret** (`SESSION_SECRET`) – Used to sign and verify all session tokens. Exposure allows forging arbitrary admin sessions.
- **Team QR tokens / check-in codes** – Static identifiers that grant read access to a team's schedule and scores via the unauthenticated portal. No expiry.
- **Score data** – `Ergebnis` records including game points and rankings. Tampering distorts the leaderboard.
- **Personal data** – Participant names, email addresses, team assignments stored in `Person` records.
- **Site-map image URL** – Stored and served back as a URL; must not allow SSRF or stored XSS.
- **DATABASE_URL** – Postgres connection string. Full DB access if exposed.

## Trust Boundaries

- **Browser / Mobile → API** – All client requests are untrusted. The API must authenticate and authorize every mutating request; the browser holds the session cookie.
- **Team portal (unauthenticated)** – `GET /api/team/:token` is intentionally public, scoped to a single team's read-only data via a token embedded in a QR code.
- **Admin / ORGA / Referee / public** – Four privilege levels enforced server-side via `requireRole`. The rangliste and gameday-status endpoints are fully public.
- **Mobile serve.js → filesystem** – The standalone static server maps URL paths to files under `static-build/`. Path traversal must be prevented.
- **API → Postgres** – Prisma ORM with parameterized queries. No raw SQL observed.

## Scan Anchors

- **Production entry point**: `artifacts/api-server/src/app.ts` (Express app), `artifacts/api-server/src/index.ts` (listener)
- **Auth**: `artifacts/api-server/src/middlewares/auth.ts`, `artifacts/api-server/src/routes/auth.ts`
- **Highest-risk routes**: `ergebnisse`, `users`, `gameday`, `team-portal`, `situationsplan`
- **Mobile static server**: `artifacts/company-games-mobile/server/serve.js`
- **Dev-only / not production**: `artifacts/mockup-sandbox/`, `artifacts/cg26-pitch-deck/`

## Threat Categories

### Spoofing

JWT tokens are signed with `SESSION_SECRET` (mandatory, throws if absent) and expire in 24 h. `bcrypt` (cost 12) is used for password hashing. The token is accepted both from the `cg26-auth` httpOnly cookie and as a Bearer token for the mobile app.

**Guarantee required**: `SESSION_SECRET` must be a long random value stored as an env secret, never committed to source. The cookie must carry `Secure: true` in production to prevent transmission over plain HTTP.

### Tampering

Score creation and verification flow is gated: SCHIEDSRICHTER can verify, ORGA can update, ADMIN can correct via `freigabe`. All mutations use Prisma parameterized queries. No client-supplied prices or calculated values.

### Information Disclosure

The `/api/rangliste` and `/api/gameday` (GET) endpoints are fully unauthenticated — by design for the scoreboard display. However, error responses may leak stack traces if an unhandled exception surfaces (Express 5 default). The team portal returns one team's own scores, but the `qrToken` used as the path parameter is also the team's authentication credential — it is static and never rotated.

### Denial of Service

No rate limiting exists on any endpoint, including `POST /api/auth/login`. An attacker can attempt unlimited password guesses against any username.

### Elevation of Privilege

**CORS is configured with `origin: true, credentials: true`** (see `app.ts:29`). This reflects any `Origin` header back as `Access-Control-Allow-Origin` while allowing credentials, letting any website make credentialed cross-origin requests. Combined with cookie-based auth this is a CSRF vector allowing any attacker-controlled page to call any authenticated API endpoint on behalf of a logged-in user.
