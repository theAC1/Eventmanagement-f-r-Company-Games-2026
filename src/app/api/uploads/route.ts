import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { requireRole } from "@/lib/auth-helpers";
import {
  UPLOADS_DIR,
  MAX_UPLOAD_BYTES,
  isAllowedImageName,
  randomFileName,
  safeUploadPath,
} from "@/lib/uploads";

// POST /api/uploads – Bild hochladen (ORGA+), multipart/form-data mit Feld "file".
// Gibt { url } zurück; ausgeliefert wird über GET /api/uploads/[name].
export async function POST(request: NextRequest) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Feld 'file' erforderlich" }, { status: 400 });
    }
    if (!file.type.startsWith("image/") || !isAllowedImageName(file.name)) {
      return NextResponse.json(
        { error: "Nur Bilddateien (jpg, png, webp, gif, svg) erlaubt" },
        { status: 400 },
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Datei zu gross (max. 10 MB)" },
        { status: 400 },
      );
    }

    const fileName = randomFileName(file.name);
    const target = safeUploadPath(fileName);
    if (!target) {
      return NextResponse.json({ error: "Ungültiger Dateiname" }, { status: 400 });
    }

    await mkdir(UPLOADS_DIR, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(target, buffer);

    return NextResponse.json({ url: `/api/uploads/${fileName}` }, { status: 201 });
  } catch (error) {
    console.error("POST /api/uploads error:", error);
    return NextResponse.json({ error: "Upload fehlgeschlagen" }, { status: 500 });
  }
}
