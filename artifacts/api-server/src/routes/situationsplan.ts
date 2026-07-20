import { Router } from "express";
import { InfraTyp } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middlewares/auth";

const router = Router();

const GAME_INCLUDE = {
  gamePositionen: {
    include: {
      game: { select: { id: true, name: true, slug: true, modus: true, flaecheLaengeM: true, flaecheBreiteM: true, helferAnzahl: true, stromNoetig: true } },
    },
  },
  infrastruktur: true,
  customFelder: true,
};

// GET /api/situationsplan
router.get("/", async (req, res) => {
  try {
    let plan = await prisma.situationsplan.findFirst({ where: { istAktiv: true }, include: GAME_INCLUDE });
    if (!plan) {
      plan = await prisma.situationsplan.create({ data: { name: "Hauptplan", istAktiv: true }, include: GAME_INCLUDE });
    }
    return res.json(plan);
  } catch (error) {
    console.error("GET /api/situationsplan error:", error);
    return res.status(500).json({ error: "Fehler" });
  }
});

// PUT /api/situationsplan – upsert game position
router.put("/", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  try {
    const { planId, gameId, x, y, nummer, oeffentlich } = req.body;
    if (!planId || !gameId) return res.status(400).json({ error: "planId und gameId erforderlich" });

    const existing = await prisma.gamePosition.findFirst({ where: { planId, gameId } });
    let position;
    if (existing) {
      const data: any = {};
      if (x !== undefined) data.x = x;
      if (y !== undefined) data.y = y;
      if (nummer !== undefined) data.nummer = nummer;
      if (oeffentlich !== undefined) data.oeffentlich = oeffentlich;
      position = await prisma.gamePosition.update({ where: { id: existing.id }, data });
    } else {
      position = await prisma.gamePosition.create({
        data: { planId, gameId, x, y, rotation: 0, nummer: nummer ?? "", oeffentlich: oeffentlich ?? true },
      });
    }
    return res.json(position);
  } catch (error) {
    console.error("PUT /api/situationsplan error:", error);
    return res.status(500).json({ error: "Fehler" });
  }
});

// POST /api/situationsplan – create infra or custom field
router.post("/", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  try {
    const body = req.body;
    if (body.type === "custom") {
      const feld = await prisma.customFeld.create({
        data: {
          planId: body.planId, label: body.label ?? "Neues Feld", nummer: body.nummer ?? "",
          farbe: body.farbe ?? "#6b7280", breiteM: body.breiteM ?? 10, laengeM: body.laengeM ?? 10,
          x: body.x ?? 50, y: body.y ?? 50, oeffentlich: body.oeffentlich ?? true,
        },
      });
      return res.status(201).json(feld);
    }
    const validInfraTypen = Object.values(InfraTyp) as string[];
    if (typeof body.typ !== "string" || !validInfraTypen.includes(body.typ)) {
      return res.status(400).json({
        error: `Ungültiger Infrastruktur-Typ. Erlaubt: ${validInfraTypen.join(", ")}`,
      });
    }
    const element = await prisma.infrastrukturElement.create({
      data: { planId: body.planId, typ: body.typ as InfraTyp, label: body.label ?? null, x: body.x, y: body.y },
    });
    return res.status(201).json(element);
  } catch (error) {
    console.error("POST /api/situationsplan error:", error);
    return res.status(500).json({ error: "Fehler" });
  }
});

// PUT /api/situationsplan/:id/hintergrund – set/clear the site-map background image URL
router.put("/:id/hintergrund", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  const { id } = req.params;
  try {
    const raw = req.body?.hintergrundbildUrl;
    let url: string | null = null;
    if (typeof raw === "string" && raw.trim() !== "") {
      url = raw.trim();
      // Accept absolute URLs (pasted) as well as internal storage paths
      // (e.g. /api/storage/objects/…) produced by the direct upload flow.
      if (!url.startsWith("/")) {
        try {
          new URL(url);
        } catch {
          return res.status(400).json({ error: "Ungültige URL" });
        }
      }
    }
    const plan = await prisma.situationsplan.update({
      where: { id },
      data: { hintergrundbildUrl: url },
    });
    return res.json(plan);
  } catch (error) {
    console.error(`PUT /api/situationsplan/${id}/hintergrund error:`, error);
    return res.status(500).json({ error: "Fehler" });
  }
});

// PUT /api/situationsplan/position/:id
router.put("/position/:id", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  const { id } = req.params;
  try {
    const body = req.body;
    // Partial-update semantics: only touch fields the client actually sent, so a
    // drag (x/y only) never resets rotation, and a metadata edit (nummer/
    // oeffentlich) never resets position or rotation.
    const data: Record<string, unknown> = {};
    for (const key of ["x", "y", "rotation", "nummer", "oeffentlich"]) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    const position = await prisma.gamePosition.update({
      where: { id },
      data,
    });
    return res.json(position);
  } catch (error) {
    console.error(`PUT /api/situationsplan/position/${id} error:`, error);
    return res.status(500).json({ error: "Fehler" });
  }
});

// DELETE /api/situationsplan/position/:id
router.delete("/position/:id", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  const { id } = req.params;
  try {
    await prisma.gamePosition.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/situationsplan/position/${id} error:`, error);
    return res.status(500).json({ error: "Fehler" });
  }
});

// DELETE /api/situationsplan/infra/:id
router.delete("/infra/:id", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  const { id } = req.params;
  try {
    await prisma.infrastrukturElement.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/situationsplan/infra/${id} error:`, error);
    return res.status(500).json({ error: "Fehler" });
  }
});

// PUT /api/situationsplan/custom/:id
router.put("/custom/:id", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  const { id } = req.params;
  try {
    const body = req.body;
    // Partial-update semantics: only touch fields the client actually sent, so a
    // drag/resize never wipes label/nummer/farbe/rotation and a metadata edit
    // never resets rotation or position.
    const data: Record<string, unknown> = {};
    for (const key of ["label", "nummer", "farbe", "breiteM", "laengeM", "x", "y", "rotation", "oeffentlich"]) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    const feld = await prisma.customFeld.update({
      where: { id },
      data,
    });
    return res.json(feld);
  } catch (error) {
    console.error(`PUT /api/situationsplan/custom/${id} error:`, error);
    return res.status(500).json({ error: "Fehler" });
  }
});

// DELETE /api/situationsplan/custom/:id
router.delete("/custom/:id", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  const { id } = req.params;
  try {
    await prisma.customFeld.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/situationsplan/custom/${id} error:`, error);
    return res.status(500).json({ error: "Fehler" });
  }
});

export default router;
