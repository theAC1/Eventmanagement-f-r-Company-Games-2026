import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middlewares/auth";
import { UserCreateSchema, UserUpdateSchema, zodValidationError } from "../lib/schemas";

const router = Router();

const USER_SELECT = {
  id: true, name: true, email: true, username: true, rolle: true, istAktiv: true, createdAt: true,
} as const;

// GET /api/users
router.get("/", async (req, res) => {
  const user = requireRole(req, res, "ADMIN");
  if (!user) return;
  const users = await prisma.person.findMany({ select: USER_SELECT, orderBy: { createdAt: "desc" } });
  return res.json(users);
});

// POST /api/users
router.post("/", async (req, res) => {
  const user = requireRole(req, res, "ADMIN");
  if (!user) return;
  const parsed = UserCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodValidationError(parsed.error));

  const { name, email, username, password, rolle } = parsed.data;
  const existing = await prisma.person.findUnique({ where: { username } });
  if (existing) return res.status(409).json({ error: "Benutzername ist bereits vergeben." });

  const passwordHash = await bcrypt.hash(password, 12);
  const newUser = await prisma.person.create({
    data: { name, email: email || null, username, passwordHash, rolle },
    select: USER_SELECT,
  });
  return res.status(201).json(newUser);
});

// PUT /api/users/:id
router.put("/:id", async (req, res) => {
  const user = requireRole(req, res, "ADMIN");
  if (!user) return;
  const { id } = req.params;
  const parsed = UserUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodValidationError(parsed.error));

  const { name, email, username, password, rolle, istAktiv } = parsed.data;
  const existing = await prisma.person.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Benutzer nicht gefunden." });

  if (username && username !== existing.username) {
    const dup = await prisma.person.findUnique({ where: { username } });
    if (dup) return res.status(409).json({ error: "Benutzername ist bereits vergeben." });
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email || null;
  if (username !== undefined) updateData.username = username;
  if (rolle !== undefined) updateData.rolle = rolle;
  if (istAktiv !== undefined) updateData.istAktiv = istAktiv;
  if (password) updateData.passwordHash = await bcrypt.hash(password, 12);

  const updatedUser = await prisma.person.update({ where: { id }, data: updateData, select: USER_SELECT });
  return res.json(updatedUser);
});

// DELETE /api/users/:id
router.delete("/:id", async (req, res) => {
  const user = requireRole(req, res, "ADMIN");
  if (!user) return;
  const { id } = req.params;
  if (user.id === id) return res.status(400).json({ error: "Du kannst dich nicht selbst löschen." });
  await prisma.person.delete({ where: { id } });
  return res.json({ ok: true });
});

export default router;
