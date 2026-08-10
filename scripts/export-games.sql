-- Export der Game-Stammdaten aus der Homelab-Postgres als eine JSON-Datei.
--
-- Ausführen auf dem Server (/home/deploy/company-games-2026):
--   docker compose exec -T db psql -U cg26 -d companygames -t -A -f /dev/stdin \
--     < scripts/export-games.sql > games-export.json
--
-- Bewusst NICHT exportiert:
--   * createdById / updatedById / verantwortlichId  -> Person-IDs existieren
--     in der Replit-DB nicht (FK-Verletzung). Felder sind alle optional.
--   * createdAt / updatedAt -> Defaults der Ziel-DB greifen.
--   * InfrastrukturElement -> InfraTyp-Enum ist in beiden Schemas disjunkt,
--     eine Übernahme bräuchte erst eine Mapping-Entscheidung.
--
-- Referenzen laufen über "slug" statt über cuid, damit der Import auch dann
-- korrekt zuordnet, wenn ein Game in der Ziel-DB bereits eine andere ID hat.

SELECT jsonb_pretty(jsonb_build_object(
  'schemaVersion', 1,
  'exportedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),

  'games', (
    SELECT coalesce(jsonb_agg(g ORDER BY g->>'slug'), '[]'::jsonb)
    FROM (
      SELECT jsonb_build_object(
        'name',                 g."name",
        'slug',                 g."slug",
        'typ',                  g."typ",
        'status',               g."status",
        'kurzbeschreibung',     g."kurzbeschreibung",
        'modus',                g."modus",
        'teamsProSlot',         g."teamsProSlot",
        'einfuehrungMin',       g."einfuehrungMin",
        'playtimeMin',          g."playtimeMin",
        'reserveMin',           g."reserveMin",
        'regeln',               g."regeln",
        'wertungstyp',          g."wertungstyp",
        'wertungslogik',        g."wertungslogik",
        'flaecheLaengeM',       g."flaecheLaengeM",
        'flaecheBreiteM',       g."flaecheBreiteM",
        'helferAnzahl',         g."helferAnzahl",
        'schiedsrichterAnzahl', g."schiedsrichterAnzahl",
        'stromNoetig',          g."stromNoetig",
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
    SELECT coalesce(jsonb_agg(m ORDER BY m->>'name'), '[]'::jsonb)
    FROM (
      SELECT jsonb_build_object(
        'gameSlug',         g."slug",
        'name',             m."name",
        'kategorie',        m."kategorie",
        'menge',            m."menge",
        'beschreibung',     m."beschreibung",
        'status',           m."status",
        'sponsor',          m."sponsor",
        -- Decimal(10,2) -> Float im Ziel-Schema: als JSON-Zahl ausgeben.
        'kostenGeschaetzt', m."kostenGeschaetzt"::float8,
        'kostenEffektiv',   m."kostenEffektiv"::float8
      ) AS m
      FROM "MaterialItem" m
      -- Material ohne gameId ist nicht Teil der Game-Stammdaten.
      JOIN "Game" g ON g."id" = m."gameId"
    ) s
  ),

  'plaene', (
    SELECT coalesce(jsonb_agg(p ORDER BY p->>'name'), '[]'::jsonb)
    FROM (
      SELECT jsonb_build_object(
        'name',               p."name",
        'hintergrundbildUrl', p."hintergrundbildUrl",
        'massstab',           p."massstab",
        'istAktiv',           p."istAktiv",
        'gamePositionen', (
          SELECT coalesce(jsonb_agg(jsonb_build_object(
            'gameSlug',    g."slug",
            'x',           gp."x",
            'y',           gp."y",
            'rotation',    gp."rotation",
            'nummer',      gp."nummer",
            'oeffentlich', gp."oeffentlich"
          ) ORDER BY g."slug"), '[]'::jsonb)
          FROM "GamePosition" gp
          JOIN "Game" g ON g."id" = gp."gameId"
          WHERE gp."planId" = p."id"
        ),
        'customFelder', (
          SELECT coalesce(jsonb_agg(jsonb_build_object(
            'label',       cf."label",
            'nummer',      cf."nummer",
            'farbe',       cf."farbe",
            'breiteM',     cf."breiteM",
            'laengeM',     cf."laengeM",
            'x',           cf."x",
            'y',           cf."y",
            'rotation',    cf."rotation",
            'oeffentlich', cf."oeffentlich"
          ) ORDER BY cf."label"), '[]'::jsonb)
          FROM "CustomFeld" cf WHERE cf."planId" = p."id"
        )
      ) AS p
      FROM "Situationsplan" p
    ) s
  )
));
