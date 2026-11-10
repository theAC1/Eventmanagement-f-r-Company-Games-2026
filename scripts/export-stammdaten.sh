#!/usr/bin/env bash
# Stammdaten-Export: Games + Material + Teams als eine JSON-Datei.
#
# Auf dem Homelab ausfuehren, im Repo-Verzeichnis:
#   cd /home/deploy/company-games-2026
#   bash export-stammdaten.sh
#
# Reines SELECT - schreibt nichts in die DB.
# Ergebnis: stammdaten-export.json im aktuellen Verzeichnis.

set -euo pipefail

OUT="stammdaten-export.json"

if [ ! -f docker-compose.yml ]; then
  echo "FEHLER: keine docker-compose.yml hier. Erst nach /home/deploy/company-games-2026 wechseln." >&2
  exit 1
fi

docker compose exec -T db psql -U cg26 -d companygames -t -A -f /dev/stdin > "$OUT" <<'EXPORT_SQL'
-- Bewusst NICHT exportiert:
--   * id / createdAt / updatedAt          -> Ziel-DB vergibt eigene Werte.
--   * createdById / updatedById /
--     verantwortlichId                    -> Person-IDs existieren im Zielprojekt
--                                            nicht (FK-Verletzung).
--   * Team.qrToken / Team.checkinCode     -> Geheimnisse dieses Events. Das Ziel
--                                            generiert eigene Codes beim Anlegen.
--
-- Stabile Schluessel fuer den Import: Game.slug und Team.nummer.
-- Material haengt ueber "gameSlug" am Game; gameSlug = null heisst
-- "Material ohne Posten-Zuordnung" (z. B. allgemeine Infrastruktur).

SELECT jsonb_pretty(jsonb_build_object(
  'schemaVersion', 2,
  'exportedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'quelle', 'company-games-2026 (Homelab-Postgres)',

  'games', (
    SELECT coalesce(jsonb_agg(g ORDER BY g->>'slug'), '[]'::jsonb)
    FROM (
      SELECT jsonb_build_object(
        'slug',                 g."slug",
        'name',                 g."name",
        'typ',                  g."typ",
        'status',               g."status",
        'modus',                g."modus",
        'kurzbeschreibung',     g."kurzbeschreibung",
        'teamsProSlot',         g."teamsProSlot",
        'durchgaenge',          g."durchgaenge",
        'teilnehmerProTeam',    g."teilnehmerProTeam",
        'einfuehrungMin',       g."einfuehrungMin",
        'playtimeMin',          g."playtimeMin",
        'reserveMin',           g."reserveMin",
        'wertungstyp',          g."wertungstyp",
        'wertungslogik',        g."wertungslogik",
        'zaehltZurWertung',     g."zaehltZurWertung",
        'flaecheLaengeM',       g."flaecheLaengeM",
        'flaecheBreiteM',       g."flaecheBreiteM",
        'helferAnzahl',         g."helferAnzahl",
        'schiedsrichterAnzahl', g."schiedsrichterAnzahl",
        'stromNoetig',          g."stromNoetig",
        'regeln',               g."regeln",
        'varianten', (
          SELECT coalesce(jsonb_agg(jsonb_build_object(
            'name',         v."name",
            'beschreibung', v."beschreibung",
            'istAktiv',     v."istAktiv"
          ) ORDER BY v."name"), '[]'::jsonb)
          FROM "GameVariante" v WHERE v."gameId" = g."id"
        )
      ) AS g
      FROM "Game" g
    ) s
  ),

  'material', (
    SELECT coalesce(jsonb_agg(m ORDER BY m->>'gameSlug' NULLS LAST, m->>'name'), '[]'::jsonb)
    FROM (
      SELECT jsonb_build_object(
        'gameSlug',         g."slug",
        'name',             m."name",
        'kategorie',        m."kategorie",
        'menge',            m."menge",
        'beschreibung',     m."beschreibung",
        'status',           m."status",
        'sponsor',          m."sponsor",
        -- Decimal(10,2) -> als JSON-Zahl ausgeben (Ziel-Schema nutzt Float).
        'kostenGeschaetzt', m."kostenGeschaetzt"::float8,
        'kostenEffektiv',   m."kostenEffektiv"::float8
      ) AS m
      FROM "MaterialItem" m
      LEFT JOIN "Game" g ON g."id" = m."gameId"
    ) s
  ),

  'teams', (
    SELECT coalesce(jsonb_agg(t ORDER BY (t->>'nummer')::int), '[]'::jsonb)
    FROM (
      SELECT jsonb_build_object(
        'nummer',           t."nummer",
        'name',             t."name",
        'farbe',            t."farbe",
        'motto',            t."motto",
        'logoUrl',          t."logoUrl",
        'captainName',      t."captainName",
        'captainEmail',     t."captainEmail",
        'teilnehmerAnzahl', t."teilnehmerAnzahl",
        'teilnehmerNamen',  t."teilnehmerNamen"
      ) AS t
      FROM "Team" t
    ) s
  )
));
EXPORT_SQL

if [ ! -s "$OUT" ]; then
  echo "FEHLER: $OUT ist leer - der psql-Aufruf hat nichts geliefert." >&2
  exit 1
fi

echo "OK: $OUT geschrieben ($(wc -c < "$OUT") Bytes)"

# Kurzkontrolle, falls jq vorhanden ist.
if command -v jq >/dev/null 2>&1; then
  jq -e '. as $d
    | "  games: \($d.games | length), material: \($d.material | length), teams: \($d.teams | length)"' \
    -r "$OUT"
fi
