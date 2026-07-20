import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middlewares/auth";
import { MaterialCreateSchema, MaterialUpdateSchema, MaterialBulkUpdateSchema, MaterialBulkDeleteSchema, zodValidationError } from "../lib/schemas";

const router = Router();

// GET /api/materials
router.get("/", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  try {
    const gameId = req.query.gameId as string | undefined;
    const kategorie = req.query.kategorie as string | undefined;
    const status = req.query.status as string | undefined;
    const where: Record<string, unknown> = {};
    if (gameId) where.gameId = gameId;
    if (kategorie) where.kategorie = kategorie;
    if (status) where.status = status;
    const items = await prisma.materialItem.findMany({
      where,
      include: {
        game: { select: { id: true, name: true, slug: true } },
        verantwortlich: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        _count: { select: { kommentare: true } },
      },
      orderBy: [{ game: { name: "asc" } }, { name: "asc" }],
    });
    return res.json(items);
  } catch (error) {
    console.error("GET /api/materials error:", error);
    return res.status(500).json({ error: "Fehler beim Laden der Materialien" });
  }
});

// POST /api/materials/bulk
router.post("/bulk", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  try {
    const parsed = MaterialBulkUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(zodValidationError(parsed.error));
    const { ids, patch } = parsed.data;
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "Patch darf nicht leer sein" });
    const result = await prisma.materialItem.updateMany({
      where: { id: { in: ids } },
      data: { ...patch, updatedById: user.id },
    });
    return res.json({ updated: result.count });
  } catch (error) {
    console.error("POST /api/materials/bulk error:", error);
    return res.status(500).json({ error: "Fehler beim Aktualisieren der Materialien" });
  }
});

// DELETE /api/materials/bulk
router.delete("/bulk", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  try {
    const parsed = MaterialBulkDeleteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(zodValidationError(parsed.error));
    const result = await prisma.materialItem.deleteMany({ where: { id: { in: parsed.data.ids } } });
    return res.json({ deleted: result.count });
  } catch (error) {
    console.error("DELETE /api/materials/bulk error:", error);
    return res.status(500).json({ error: "Fehler beim Löschen der Materialien" });
  }
});

// GET /api/materials/:id
router.get("/:id", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  const { id } = req.params;
  try {
    const item = await prisma.materialItem.findUnique({
      where: { id },
      include: {
        game: { select: { id: true, name: true, slug: true } },
        verantwortlich: { select: { id: true, name: true } },
        kommentare: {
          include: { autor: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!item) return res.status(404).json({ error: "Material nicht gefunden" });
    return res.json(item);
  } catch (error) {
    console.error(`GET /api/materials/${id} error:`, error);
    return res.status(500).json({ error: "Fehler beim Laden" });
  }
});

// POST /api/materials
router.post("/", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  try {
    const parsed = MaterialCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(zodValidationError(parsed.error));
    const data = parsed.data;
    const item = await prisma.materialItem.create({
      data: {
        name: data.name, gameId: data.gameId || null, kategorie: data.kategorie,
        menge: data.menge || null, beschreibung: data.beschreibung || null,
        status: data.status || "OFFEN", sponsor: data.sponsor || null,
        kostenGeschaetzt: data.kostenGeschaetzt || null, kostenEffektiv: data.kostenEffektiv || null,
        createdById: user.id,
      },
      include: { game: { select: { id: true, name: true, slug: true } } },
    });
    return res.status(201).json(item);
  } catch (error) {
    console.error("POST /api/materials error:", error);
    return res.status(500).json({ error: "Fehler beim Erstellen des Materials" });
  }
});

// PUT /api/materials/:id
router.put("/:id", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  const { id } = req.params;
  try {
    const parsed = MaterialUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(zodValidationError(parsed.error));
    const item = await prisma.materialItem.update({
      where: { id },
      data: { ...parsed.data, updatedById: user.id },
      include: {
        game: { select: { id: true, name: true, slug: true } },
        verantwortlich: { select: { id: true, name: true } },
      },
    });
    return res.json(item);
  } catch (error) {
    console.error(`PUT /api/materials/${id} error:`, error);
    return res.status(500).json({ error: "Fehler beim Aktualisieren" });
  }
});

// DELETE /api/materials/:id
router.delete("/:id", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  const { id } = req.params;
  try {
    await prisma.materialItem.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/materials/${id} error:`, error);
    return res.status(500).json({ error: "Fehler beim Löschen" });
  }
});

export default router;
