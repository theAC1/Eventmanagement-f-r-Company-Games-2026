@AGENTS.md

# Versionierung

Event-basiertes Schema: `MAJOR.MINOR.PATCH-stage`

## Phasen

| Phase | Versionen | Bedeutung |
|-------|-----------|-----------|
| **alpha** | 0.x.x-alpha | Aktive Entwicklung, Features werden gebaut |
| **beta** | 0.x.x-beta | Feature-Freeze, Orga testet, nur Bugfixes |
| **release** | 1.0.0 | Event-Tag (September 2026) |
| **post** | 1.x.x | Post-Event Fixes und Auswertung |

## Wann wird was hochgezählt?

- **PATCH** (0.1.0 → 0.1.1): Bugfixes, kleine Anpassungen, Refactoring, Cleanup
- **MINOR** (0.1.x → 0.2.0): Neues Feature (z.B. Export, neues Modul, neue Seite)
- **MAJOR** (0.x → 1.0): Event-Release oder Breaking Changes

## Regeln

- Bei jedem `feat:` Commit → MINOR hochzählen
- Bei `fix:`, `refactor:`, `test:`, `chore:` → PATCH hochzählen
- Version wird in `package.json` gepflegt
- `next.config.ts` liest Version automatisch via `BUILD_VERSION`
- Vor Beta-Übergang: Feature-Freeze, nur noch `fix:` Commits
