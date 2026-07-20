import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middlewares/auth";
import { validatePassword } from "../lib/password";
import { UserCreateSchema, UserUpdateSchema, zodValidationError } from "../lib/schemas";

const router = Router();

const USER_SELECT = {
  id: true, name: true, email: true, username: true, rolle: true, istAktiv: true,
  mussPasswortAendern: true, createdAt: true,
} as const;

// Kryptographisch zufälliger Aktivierungscode (12 Zeichen, alphanumerisch,
// ohne leicht verwechselbare Zeichen)
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
function generateActivationCode(): string {
  const bytes = crypto.randomBytes(12);
  let code = "";
  for (let i = 0; i < 12; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

// GET /api/users
router.get("/", async (req, res) => {
  const user = requireRole(req, res, "ADMIN");
  if (!user) return;
  const users = await prisma.person.findMany({ select: USER_SELECT, orderBy: { createdAt: "desc" } });
  return res.json(users);
});

// POST /api/users — nur OWNER, erstellt Account mit Aktivierungscode
router.post("/", async (req, res) => {
  const user = requireRole(req, res, "OWNER");
  if (!user) return;
  const parsed = UserCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodValidationError(parsed.error));

  const { name, email, username, rolle } = parsed.data;

  if (rolle === "OWNER") {
    const ownerExists = await prisma.person.findFirst({ where: { rolle: "OWNER" } });
    if (ownerExists) {
      return res.status(409).json({ error: "Es kann nur einen OWNER-Account geben." });
    }
  }

  const existing = await prisma.person.findUnique({ where: { username } });
  if (existing) return res.status(409).json({ error: "Benutzername ist bereits vergeben." });

  const aktivierungsCode = generateActivationCode();
  const codeHash = await bcrypt.hash(aktivierungsCode, 12);

  const newUser = await prisma.person.create({
    data: {
      name,
      email: email || null,
      username,
      rolle,
      aktivierungsCode: codeHash,
      mussPasswortAendern: true,
    },
    select: USER_SELECT,
  });
  // Klartext-Code wird nur einmalig in dieser Antwort zurückgegeben
  return res.status(201).json({ ...newUser, aktivierungsCode });
});

// POST /api/users/:id/reset-activation — nur OWNER, neuen Aktivierungscode generieren
router.post("/:id/reset-activation", async (req, res) => {
  const user = requireRole(req, res, "OWNER");
  if (!user) return;
  const { id } = req.params;
  const existing = await prisma.person.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Benutzer nicht gefunden." });
  if (existing.id === user.id) {
    return res.status(400).json({ error: "Du kannst deinen eigenen Zugang nicht zurücksetzen." });
  }

  const aktivierungsCode = generateActivationCode();
  const codeHash = await bcrypt.hash(aktivierungsCode, 12);

  const updated = await prisma.person.update({
    where: { id },
    data: { aktivierungsCode: codeHash, mussPasswortAendern: true, passwordHash: null },
    select: USER_SELECT,
  });
  // Klartext-Code wird nur einmalig in dieser Antwort zurückgegeben
  return res.json({ ...updated, aktivierungsCode });
});

// PUT /api/users/:id — nur OWNER
router.put("/:id", async (req, res) => {
  const user = requireRole(req, res, "OWNER");
  if (!user) return;
  const { id } = req.params;
  const parsed = UserUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodValidationError(parsed.error));

  const { name, email, username, password, rolle, istAktiv } = parsed.data;
  const existing = await prisma.person.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Benutzer nicht gefunden." });

  // OWNER-Account-Integrität schützen: nicht deaktivieren, nicht wegrollen
  if (existing.rolle === "OWNER") {
    if (istAktiv === false) {
      return res.status(400).json({ error: "Der OWNER-Account kann nicht deaktiviert werden." });
    }
    if (rolle !== undefined && rolle !== "OWNER") {
      return res.status(400).json({ error: "Die OWNER-Rolle kann nicht entzogen werden." });
    }
  }

  if (password) {
    const check = validatePassword(password);
    if (!check.ok) {
      return res.status(400).json({
        error: `Passwort erfüllt die Anforderungen nicht: ${check.fehler.join(", ")}`,
        regeln: check.regeln,
      });
    }
  }

  if (rolle === "OWNER" && existing.rolle !== "OWNER") {
    const ownerExists = await prisma.person.findFirst({ where: { rolle: "OWNER" } });
    if (ownerExists) {
      return res.status(409).json({ error: "Es kann nur einen OWNER-Account geben." });
    }
  }

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

// DELETE /api/users/:id — nur OWNER
router.delete("/:id", async (req, res) => {
  const user = requireRole(req, res, "OWNER");
  if (!user) return;
  const { id } = req.params;
  if (user.id === id) return res.status(400).json({ error: "Du kannst dich nicht selbst löschen." });
  const target = await prisma.person.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: "Benutzer nicht gefunden." });
  if (target.rolle === "OWNER") {
    return res.status(400).json({ error: "Der OWNER-Account kann nicht gelöscht werden." });
  }
  await prisma.person.delete({ where: { id } });
  return res.json({ ok: true });
});

export default router;
