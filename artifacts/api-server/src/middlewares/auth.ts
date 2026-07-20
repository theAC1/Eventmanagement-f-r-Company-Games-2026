import { Request, Response } from "express";
import jwt from "jsonwebtoken";

export type AuthUser = { id: string; name: string; email: string | null; rolle: string };

function getJwtSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET environment variable is required — set it to a long random string",
    );
  }
  return secret;
}

const COOKIE = "cg26-auth";

export function signToken(user: AuthUser): string {
  return jwt.sign(user as object, getJwtSecret(), { expiresIn: "24h" });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as unknown as AuthUser;
    return payload;
  } catch {
    return null;
  }
}

export function getAuthUser(req: Request): AuthUser | null {
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[COOKIE];
  if (cookieToken) return verifyToken(cookieToken);
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return verifyToken(auth.slice(7));
  return null;
}

const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 200,
  ADMIN: 100,
  ORGA: 50,
  SCHIEDSRICHTER: 20,
  HELFER: 10,
};

export function hasMinRole(userRole: string, requiredRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 999);
}

export function requireRole(req: Request, res: Response, minRole: string): AuthUser | null {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Nicht eingeloggt" });
    return null;
  }
  if (!hasMinRole(user.rolle, minRole)) {
    res.status(403).json({ error: "Keine Berechtigung" });
    return null;
  }
  return user;
}
