import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middlewares/auth";
import { KvpCreateSchema, KvpStatusUpdateSchema, zodValidationError } from "../lib/schemas";

const router = Router();

// GET /api/kvp
router.get("/", async (req, res) => {
  const user = requireRole(req, res, "ADMIN");
  if (!user) return;
  try {
    const status = req.query.status as string | undefined;
    const typ = req.query.typ as string | undefined;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (typ) where.typ = typ;
    const eintraege = await prisma.kvpEintrag.findMany({
      where,
      include: { eingetragenVon: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return res.json(eintraege);
  } catch (error) {
    console.error("GET /api/kvp error:", error);
    return res.status(500).json({ error: "Fehler beim Laden der KVP-Einträge" });
  }
});

// POST /api/kvp
router.post("/", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  try {
    const parsed = KvpCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(zodValidationError(parsed.error));
    const { typ, titel, beschreibung, seite } = parsed.data;
    const eintrag = await prisma.kvpEintrag.create({
      data: { typ, titel, beschreibung, seite: seite ?? null, eingetragenVonId: user.id },
      include: { eingetragenVon: { select: { id: true, name: true } } },
    });
    return res.status(201).json(eintrag);
  } catch (error) {
    console.error("POST /api/kvp error:", error);
    return res.status(500).json({ error: "Fehler beim Erstellen des KVP-Eintrags" });
  }
});

// GET /api/kvp/:id
router.get("/:id", async (req, res) => {
  const user = requireRole(req, res, "ADMIN");
  if (!user) return;
  const { id } = req.params;
  try {
    const eintrag = await prisma.kvpEintrag.findUnique({
      where: { id },
      include: { eingetragenVon: { select: { id: true, name: true } } },
    });
    if (!eintrag) return res.status(404).json({ error: "KVP-Eintrag nicht gefunden" });
    return res.json(eintrag);
  } catch (error) {
    console.error(`GET /api/kvp/${id} error:`, error);
    return res.status(500).json({ error: "Fehler beim Laden" });
  }
});

// PUT /api/kvp/:id (status update)
router.put("/:id", async (req, res) => {
  const user = requireRole(req, res, "ADMIN");
  if (!user) return;
  const { id } = req.params;
  try {
    const parsed = KvpStatusUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(zodValidationError(parsed.error));
    const eintrag = await prisma.kvpEintrag.update({
      where: { id },
      data: { status: parsed.data.status },
      include: { eingetragenVon: { select: { id: true, name: true } } },
    });
    return res.json(eintrag);
  } catch (error) {
    console.error(`PUT /api/kvp/${id} error:`, error);
    return res.status(500).json({ error: "Fehler beim Aktualisieren" });
  }
});

export default router;
