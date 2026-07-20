import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middlewares/auth";

const router = Router();

// GET /api/persons
router.get("/", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  const rolleParam = req.query.rolle as string | undefined;
  const rollen = rolleParam
    ? rolleParam.split(",").map((r) => r.trim()).filter((r) => ["ADMIN", "ORGA", "SCHIEDSRICHTER", "HELFER"].includes(r))
    : null;
  const persons = await prisma.person.findMany({
    where: { istAktiv: true, ...(rollen && rollen.length > 0 ? { rolle: { in: rollen as any } } : {}) },
    select: { id: true, name: true, rolle: true },
    orderBy: { name: "asc" },
  });
  return res.json(persons);
});

export default router;
