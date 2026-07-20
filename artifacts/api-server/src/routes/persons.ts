import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middlewares/auth";

const router = Router();

// GET /api/persons
router.get("/", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  const persons = await prisma.person.findMany({
    where: { istAktiv: true },
    select: { id: true, name: true, rolle: true },
    orderBy: { name: "asc" },
  });
  return res.json(persons);
});

export default router;
