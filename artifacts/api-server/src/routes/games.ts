import { Router } from "express";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { requireRole, getAuthUser } from "../middlewares/auth";
import { GameCreateSchema, GameUpdateSchema, zodValidationError } from "../lib/schemas";

const router = Router();

// GET /api/games
router.get("/", async (req, res) => {
  const user = requireRole(req, res, "SCHIEDSRICHTER");
  if (!user) return;
  try {
    const games = await prisma.game.findMany({
      include: { _count: { select: { varianten: true, materialItems: true } } },
      orderBy: { name: "asc" },
    });
    return res.json(games);
  } catch (error) {
    console.error("GET /api/games error:", error);
    return res.status(500).json({ error: "Fehler beim Laden der Games" });
  }
});

// GET /api/games/by-slug/:slug
router.get("/by-slug/:slug", async (req, res) => {
  const user = requireRole(req, res, "SCHIEDSRICHTER");
  if (!user) return;
  const { slug } = req.params;
  try {
    const game = await prisma.game.findUnique({
      where: { slug },
      include: {
        varianten: { where: { istAktiv: true } },
        materialItems: {
          select: { id: true, name: true, menge: true, status: true },
          orderBy: { name: "asc" },
        },
      },
    });
    if (!game) return res.status(404).json({ error: "Game nicht gefunden" });
    return res.json(game);
  } catch (error) {
    console.error(`GET /api/games/by-slug/${slug} error:`, error);
    return res.status(500).json({ error: "Fehler beim Laden des Games" });
  }
});

// GET /api/games/:id
router.get("/:id", async (req, res) => {
  const user = requireRole(req, res, "SCHIEDSRICHTER");
  if (!user) return;
  const { id } = req.params;
  try {
    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        varianten: { orderBy: { name: "asc" } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        _count: { select: { materialItems: true, ergebnisse: true } },
      },
    });
    if (!game) return res.status(404).json({ error: "Game nicht gefunden" });
    return res.json(game);
  } catch (error) {
    console.error(`GET /api/games/${id} error:`, error);
    return res.status(500).json({ error: "Fehler beim Laden des Games" });
  }
});

// POST /api/games
router.post("/", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  try {
    const parsed = GameCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(zodValidationError(parsed.error));

    const data = parsed.data;
    const slug = data.slug || data.name
      .toLowerCase()
      .replace(/[äÄ]/g, "ae").replace(/[öÖ]/g, "oe").replace(/[üÜ]/g, "ue")
      .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const existingSlug = await prisma.game.findUnique({ where: { slug } });
    if (existingSlug) return res.status(409).json({ error: `Ein Game mit dem Slug "${slug}" existiert bereits.` });

    const game = await prisma.game.create({
      data: {
        name: data.name, slug, typ: data.typ, modus: data.modus,
        teamsProSlot: data.teamsProSlot ?? 1,
        kurzbeschreibung: data.kurzbeschreibung ?? null,
        einfuehrungMin: data.einfuehrungMin ?? 3,
        playtimeMin: data.playtimeMin ?? 10,
        reserveMin: data.reserveMin ?? 2,
        regeln: data.regeln ?? null,
        wertungstyp: data.wertungstyp ?? null,
        wertungslogik: data.wertungslogik === null ? Prisma.JsonNull : (data.wertungslogik ?? Prisma.JsonNull),
        flaecheLaengeM: data.flaecheLaengeM ?? null,
        flaecheBreiteM: data.flaecheBreiteM ?? null,
        helferAnzahl: data.helferAnzahl ?? 1,
        stromNoetig: data.stromNoetig ?? false,
        createdById: user.id,
      },
    });
    return res.status(201).json(game);
  } catch (error) {
    console.error("POST /api/games error:", error);
    return res.status(500).json({ error: "Fehler beim Erstellen des Games" });
  }
});

// PUT /api/games/:id
router.put("/:id", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  const { id } = req.params;
  try {
    const parsed = GameUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(zodValidationError(parsed.error));

    const { wertungslogik, ...restData } = parsed.data;
    const game = await prisma.game.update({
      where: { id },
      data: {
        ...restData,
        ...(wertungslogik !== undefined
          ? { wertungslogik: wertungslogik === null ? Prisma.JsonNull : wertungslogik }
          : {}),
        updatedById: user.id,
      },
      include: { varianten: { orderBy: { name: "asc" } } },
    });
    return res.json(game);
  } catch (error) {
    console.error(`PUT /api/games/${id} error:`, error);
    return res.status(500).json({ error: "Fehler beim Aktualisieren des Games" });
  }
});

// DELETE /api/games/:id
router.delete("/:id", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  const { id } = req.params;
  try {
    await prisma.game.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/games/${id} error:`, error);
    return res.status(500).json({ error: "Fehler beim Löschen des Games" });
  }
});

export default router;
