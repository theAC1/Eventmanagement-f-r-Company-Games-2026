import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { signToken, getAuthUser } from "../middlewares/auth";

const router = Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username und Passwort erforderlich" });
    }

    const person = await prisma.person.findUnique({ where: { username } });
    if (!person || !person.passwordHash || !person.istAktiv) {
      return res.status(401).json({ error: "Ungültige Anmeldedaten" });
    }

    const valid = await bcrypt.compare(password, person.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Ungültige Anmeldedaten" });
    }

    const user = { id: person.id, name: person.name, email: person.email, rolle: person.rolle };
    const token = signToken(user);

    res.cookie("cg26-auth", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({ user });
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return res.status(500).json({ error: "Fehler beim Einloggen" });
  }
});

// POST /api/auth/logout
router.post("/logout", (_req, res) => {
  res.clearCookie("cg26-auth");
  return res.json({ ok: true });
});

// GET /api/auth/me
router.get("/me", (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: "Nicht eingeloggt" });
  return res.json({ user });
});

export default router;
