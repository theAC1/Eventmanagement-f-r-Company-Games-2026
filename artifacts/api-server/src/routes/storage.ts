import { Readable } from "stream";
import { Router, type IRouter, type Request, type Response } from "express";

import { requireRole } from "../middlewares/auth";
import { ObjectPermission } from "../lib/objectAcl";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 *
 * Guarded by the app's own cookie-based ORGA role check (cg26-auth), not
 * Replit Auth, so only organizers can mint write-capable URLs.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;

  const { name, size, contentType } = req.body ?? {};
  if (
    typeof name !== "string" ||
    typeof size !== "number" ||
    typeof contentType !== "string"
  ) {
    res.status(400).json({ error: "name, size und contentType erforderlich" });
    return;
  }
  if (!contentType.startsWith("image/")) {
    res.status(400).json({ error: "Nur Bilddateien erlaubt" });
    return;
  }

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Upload-URL konnte nicht erstellt werden" });
  }
});

/**
 * PUT /storage/objects/acl
 *
 * After the client has uploaded the file to the presigned URL, mark the
 * object as publicly readable and return the normalized object path. The
 * team portal serves the Lageplan image without auth, so it must be public.
 */
router.put("/storage/objects/acl", async (req: Request, res: Response) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;

  const objectURL = req.body?.objectURL;
  if (typeof objectURL !== "string" || objectURL.trim() === "") {
    res.status(400).json({ error: "objectURL erforderlich" });
    return;
  }

  try {
    const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
      objectURL,
      { owner: user.id, visibility: "public" },
    );
    res.json({ objectPath });
  } catch (error) {
    req.log.error({ err: error }, "Error setting object ACL");
    res.status(500).json({ error: "ACL konnte nicht gesetzt werden" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR. Access is gated by the
 * object's ACL policy — Lageplan images are stored as public, so the team
 * portal can render them without a session.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const canAccess = await objectStorageService.canAccessObjectEntity({
      objectFile,
      requestedPermission: ObjectPermission.READ,
    });
    if (!canAccess) {
      res.status(403).json({ error: "Kein Zugriff" });
      return;
    }

    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(
        response.body as ReadableStream<Uint8Array>,
      );
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Objekt nicht gefunden" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Objekt konnte nicht geladen werden" });
  }
});

export default router;
