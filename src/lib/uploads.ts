import path from "path";
import crypto from "crypto";

// Upload-Verzeichnis: im Container via Docker-Volume gemountet, damit
// Uploads Deployments überleben (siehe docker-compose.yml).
export const UPLOADS_DIR =
  process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");

// SVG ist dabei, weil viele Firmen ihr Logo nur als SVG anbieten. Ausgeliefert
// wird es mit einer strengen CSP (siehe GET /api/uploads/[name]), damit ein
// fremdes SVG im Browser nichts ausführen kann.
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export function isAllowedImageName(filename: string): boolean {
  return ALLOWED_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

/** Zufälliger, kollisionfreier Dateiname mit Original-Endung. */
export function randomFileName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  return `${crypto.randomBytes(16).toString("hex")}${ext}`;
}

/**
 * Path-Containment: löst den Zielpfad auf und stellt sicher, dass er
 * INNERHALB des Upload-Verzeichnisses liegt (inkl. Trenner-Suffix, damit
 * Geschwister-Verzeichnisse mit gleichem Präfix nicht durchrutschen).
 */
export function safeUploadPath(fileName: string): string | null {
  const resolvedRoot = path.resolve(UPLOADS_DIR);
  const resolved = path.resolve(resolvedRoot, fileName);
  if (!resolved.startsWith(resolvedRoot + path.sep)) return null;
  return resolved;
}

export function contentTypeFor(fileName: string): string {
  switch (path.extname(fileName).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}
