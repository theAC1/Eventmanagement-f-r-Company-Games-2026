import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { signToken, getAuthUser } from "../middlewares/auth";
import { validatePassword } from "../lib/password";

const router = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 24 * 60 * 60 * 1000,
};

// Per-IP rate limiting against credential brute-force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Anmeldeversuche. Bitte später erneut versuchen." },
});

// POST /api/auth/login
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username und Passwort erforderlich" });
    }

    const person = await prisma.person.findUnique({ where: { username } });
    if (!person || !person.istAktiv) {
      return res.status(401).json({ error: "Ungültige Anmeldedaten" });
    }

    // Account noch nicht aktiviert: Login mit Aktivierungscode möglich
    if (person.mussPasswortAendern && person.aktivierungsCode) {
      const codeValid = await bcrypt.compare(password, person.aktivierungsCode);
      if (codeValid) {
        // Kein vollständiges Session-Token – Frontend leitet zur Aktivierungsseite
        return res.json({ requiresActivation: true, username: person.username });
      }
      return res.status(401).json({ error: "Ungültiger Aktivierungscode" });
    }

    if (!person.passwordHash) {
      return res.status(401).json({ error: "Ungültige Anmeldedaten" });
    }

    const valid = await bcrypt.compare(password, person.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Ungültige Anmeldedaten" });
    }

    const user = { id: person.id, name: person.name, email: person.email, rolle: person.rolle };
    const token = signToken(user);

    res.cookie("cg26-auth", token, COOKIE_OPTS);

    // Return the token in the body as well so non-browser clients (e.g. the
    // Expo mobile app) can store it and send it as a Bearer token.
    return res.json({ user, token });
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return res.status(500).json({ error: "Fehler beim Einloggen" });
  }
});

// POST /api/auth/activate — Erstanmeldung mit Aktivierungscode + neues Passwort setzen
router.post("/activate", loginLimiter, async (req, res) => {
  try {
    const { username, aktivierungsCode, neuesPasswort } = req.body;
    if (!username || !aktivierungsCode || !neuesPasswort) {
      return res
        .status(400)
        .json({ error: "Username, Aktivierungscode und neues Passwort erforderlich" });
    }

    const person = await prisma.person.findUnique({ where: { username } });
    if (!person || !person.istAktiv || !person.aktivierungsCode || !person.mussPasswortAendern) {
      return res.status(401).json({ error: "Ungültiger Benutzername oder Aktivierungscode" });
    }

    const codeValid = await bcrypt.compare(aktivierungsCode, person.aktivierungsCode);
    if (!codeValid) {
      return res.status(401).json({ error: "Ungültiger Benutzername oder Aktivierungscode" });
    }

    const check = validatePassword(neuesPasswort);
    if (!check.ok) {
      return res.status(400).json({
        error: `Passwort erfüllt die Anforderungen nicht: ${check.fehler.join(", ")}`,
        regeln: check.regeln,
      });
    }

    const passwordHash = await bcrypt.hash(neuesPasswort, 12);
    const updated = await prisma.person.update({
      where: { id: person.id },
      data: { passwordHash, aktivierungsCode: null, mussPasswortAendern: false },
    });

    const user = { id: updated.id, name: updated.name, email: updated.email, rolle: updated.rolle };
    const token = signToken(user);
    res.cookie("cg26-auth", token, COOKIE_OPTS);
    return res.json({ user, token });
  } catch (error) {
    console.error("POST /api/auth/activate error:", error);
    return res.status(500).json({ error: "Fehler bei der Aktivierung" });
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
