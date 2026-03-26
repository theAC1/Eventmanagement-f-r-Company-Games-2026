# Auth-System Deployment — Company Games 2026

## Kontext

Die Web-App unter `games.arvuna.ch` (Company Games 2026) hat ein komplett neues Auth-System bekommen. Vorher gab es keine funktionierende Authentifizierung — der Admin-Bereich war offen, OTP/IP-basierte Ansätze haben nicht funktioniert. Jetzt wurde ein Clean-Slate-Ansatz umgesetzt:

**Was gebaut wurde:**
- NextAuth v4 mit Credentials Provider (Username + Passwort, bcryptjs gehashed)
- JWT-basierte Sessions (24h Laufzeit)
- Login-Page unter `/login`
- Rollen-Hierarchie: ADMIN > ORGA > SCHIEDSRICHTER > HELFER
- Middleware schützt `/admin/*` (min. ORGA) und `/referee/*` (min. SCHIEDSRICHTER)
- `/admin/users` nur für ADMIN (User-Management)
- Audit-Trail: `createdBy`/`updatedBy` auf Game, Team, MaterialItem
- Seed erstellt Admin-Account: username `juan`, passwort `changeme`

**Was sich im Prisma-Schema geändert hat:**
- `Person`-Model: `pinHash` entfernt, neu: `username` (unique), `passwordHash`, `istAktiv`, `updatedAt`
- `PersonRolle` enum: `LEITUNG/HELFER/SCHIEDSRICHTER/TEAM_CAPTAIN` → `ADMIN/ORGA/SCHIEDSRICHTER/HELFER`
- `Game`, `Team`, `MaterialItem`: neue Felder `createdById`, `updatedById` (FK auf Person)

**Tech-Stack:** Next.js 16.2, Prisma 7.5, PostgreSQL 16, Docker Compose, Nginx Reverse Proxy.
**Repo:** https://github.com/theAC1/Eventmanagement-f-r-Company-Games-2026.git

**Neue Dateien (die noch nicht committed sind):**
- `src/lib/auth.ts` — NextAuth Config + Rollen-Hierarchie
- `src/lib/auth-helpers.ts` — Server-Side Session Helpers (requireRole, getCurrentUserId)
- `src/middleware.ts` — Route-Protection Middleware
- `src/app/login/page.tsx` — Login-Seite
- `src/app/admin/logout-button.tsx` — Logout-Button Komponente
- `src/app/admin/users/page.tsx` — User-Management UI
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth Route Handler
- `src/app/api/users/route.ts` — User CRUD (GET/POST)
- `src/app/api/users/[id]/route.ts` — User Detail (PUT/DELETE)
- `src/components/audit-info.tsx` — Audit-Trail UI-Komponente
- `src/types/next-auth.d.ts` — TypeScript Type Augmentation für NextAuth

**Geänderte Dateien (Audit-Trail + Auth-Imports hinzugefügt):**
- `prisma/schema.prisma` — Neue Rollen, Auth-Felder, Audit-Relations
- `prisma/seed.ts` — Admin-Account mit Passwort
- `package.json` — bcryptjs Dependency
- `.env.example` — NEXTAUTH_SECRET, APP_URL
- `server/index.ts` — CORS Origin fix
- `src/types/index.ts` — PersonRolle, PersonDTO, AuditInfo Types
- `src/app/admin/layout.tsx` — User-Info + Logout im Header
- `src/app/admin/games/[id]/page.tsx` — AuditInfo-Anzeige
- `src/app/admin/teams/[id]/page.tsx` — AuditInfo-Anzeige
- `src/app/api/games/route.ts` — createdById beim Erstellen
- `src/app/api/games/[id]/route.ts` — updatedById + createdBy/updatedBy Include
- `src/app/api/teams/route.ts` — createdById beim Erstellen
- `src/app/api/teams/[id]/route.ts` — updatedById + createdBy/updatedBy Include
- `src/app/api/teams/[id]/badge/route.ts` — APP_URL statt NEXTAUTH_URL
- `src/app/api/materials/route.ts` — createdById + createdBy/updatedBy Include
- `src/app/api/materials/[id]/route.ts` — updatedById beim Update

---

## Schritt 0: Git Lock entfernen, committen und pushen (LOKAL)

Es gibt ein stale `index.lock` im Git-Repo. Das muss zuerst entfernt werden, dann committen und pushen:

```bash
# Im Projektverzeichnis auf deinem lokalen Rechner
cd /pfad/zu/company-games-2026

# Lock-File entfernen
rm -f .git/index.lock

# Alle Auth-relevanten Dateien stagen
git add \
  src/lib/auth.ts \
  src/lib/auth-helpers.ts \
  src/middleware.ts \
  src/app/login/page.tsx \
  src/app/admin/layout.tsx \
  src/app/admin/logout-button.tsx \
  src/app/admin/users/page.tsx \
  src/app/api/auth/ \
  src/app/api/users/ \
  src/components/audit-info.tsx \
  src/types/next-auth.d.ts \
  src/types/index.ts \
  prisma/schema.prisma \
  prisma/seed.ts \
  package.json \
  package-lock.json \
  .env.example \
  server/index.ts \
  src/app/api/games/route.ts \
  src/app/api/games/[id]/route.ts \
  src/app/api/teams/route.ts \
  src/app/api/teams/[id]/route.ts \
  src/app/api/teams/[id]/badge/route.ts \
  src/app/api/materials/route.ts \
  src/app/api/materials/[id]/route.ts \
  src/app/admin/games/[id]/page.tsx \
  src/app/admin/teams/[id]/page.tsx \
  DEPLOY-AUTH.md

# Committen
git commit -m "feat: Auth-System mit NextAuth, Rollen-Hierarchie und Audit-Trail

- NextAuth v4 Credentials Provider (Username + Passwort, bcryptjs)
- Rollen: ADMIN > ORGA > SCHIEDSRICHTER > HELFER
- Middleware schützt /admin/* und /referee/*
- Login-Page, User-Management, Logout
- Audit-Trail (createdBy/updatedBy) auf Game, Team, MaterialItem
- Prisma Schema: neue PersonRolle, Auth-Felder, Audit-Relations"

# Pushen
git push origin main
```

---

## Schritt 1: Auf Server verbinden und pullen

```bash
ssh dein-server

# Ins Projektverzeichnis wechseln
cd /pfad/zu/company-games-2026

# Neueste Änderungen holen
git pull origin main

# Dependencies installieren (bcryptjs ist neu)
npm install
```

---

## Schritt 2: NEXTAUTH_SECRET generieren und in .env setzen

```bash
# Secret generieren
openssl rand -base64 32

# In die .env-Datei eintragen
nano .env
```

Folgende Zeilen müssen in `.env` stehen (falls noch nicht vorhanden):
```
NEXTAUTH_SECRET="<das-generierte-secret>"
NEXTAUTH_URL="https://games.arvuna.ch"
APP_URL="https://games.arvuna.ch"
```

**Warum:** NextAuth braucht ein Secret für die JWT-Signierung. Ohne das Secret starten die Auth-Endpoints nicht. `NEXTAUTH_URL` definiert die Callback-URL für die Session.

---

## Schritt 3: Prisma Migration ausführen

```bash
npx prisma migrate dev --name auth-system
```

Falls `migrate dev` nicht geht (z.B. weil Production-DB), stattdessen:
```bash
npx prisma db push
```

**Was passiert:** Die Datenbank bekommt die neuen Spalten (`username`, `passwordHash`, `istAktiv`, `updatedAt` auf Person; `createdById`, `updatedById` auf Game/Team/MaterialItem). Die alte `pinHash`-Spalte wird entfernt. Das Enum `PersonRolle` wird von `LEITUNG/HELFER/SCHIEDSRICHTER/TEAM_CAPTAIN` auf `ADMIN/ORGA/SCHIEDSRICHTER/HELFER` geändert.

**ACHTUNG:** Falls es bereits Personen in der DB gibt mit Rolle `LEITUNG`, muss vor der Migration ein manuelles SQL ausgeführt werden:
```sql
UPDATE "Person" SET rolle = 'ADMIN' WHERE rolle = 'LEITUNG';
UPDATE "Person" SET rolle = 'HELFER' WHERE rolle = 'TEAM_CAPTAIN';
```

Oder alternativ: Seed laufen lassen (löscht und erstellt Personen neu, siehe Schritt 4).

---

## Schritt 4: Seed ausführen (Admin-Account erstellen)

```bash
npx prisma db seed
```

**Was passiert:** Erstellt den Admin-Account:
- Name: Juan Hausherr
- Username: `juan`
- Passwort: `changeme` (bcrypt-gehashed mit 12 Rounds)
- Rolle: ADMIN
- Email: juan.hausherr@gmail.com

**ACHTUNG:** Der Seed löscht zuerst alle bestehenden Personen (`deleteMany`). Falls es bereits Schiedsrichter oder andere Personen gibt die behalten werden sollen, den Seed anpassen oder die Personen nach dem Seed neu anlegen über `/admin/users`.

---

## Schritt 5: Build und Restart

Falls Docker:
```bash
docker compose build
docker compose up -d
```

Falls ohne Docker:
```bash
npm run build
npm run start
```

**Warum:** Die neuen Dateien (Login-Page, Middleware, API-Routes, Auth-Config) müssen kompiliert werden. Next.js braucht einen frischen Build.

---

## Schritt 6: Passwort ändern und testen

1. Öffne `https://games.arvuna.ch/login`
2. Login mit `juan` / `changeme`
3. Gehe zu `/admin/users`
4. Klicke bei deinem Account auf "Bearbeiten"
5. Setze ein sicheres Passwort (min. 6 Zeichen)
6. Erstelle Accounts für deine Orga-Leute (Rolle: ORGA) und Schiedsrichter (Rolle: SCHIEDSRICHTER)

**Testen:**
- Versuche `/admin` aufzurufen ohne Login → sollte zu `/login` redirecten
- Logge dich als SCHIEDSRICHTER ein → `/admin` sollte blockiert sein, `/referee` sollte gehen
- Logge dich als ORGA ein → `/admin` sollte gehen, `/admin/users` sollte blockiert sein
- Erstelle ein Game oder Team → Audit-Info (Erstellt von ...) sollte sichtbar sein
