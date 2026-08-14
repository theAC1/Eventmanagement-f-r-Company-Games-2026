import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { safeUploadPath, contentTypeFor, isAllowedImageName } from "@/lib/uploads";

type RouteParams = { params: Promise<{ name: string }> };

// GET /api/uploads/[name] – hochgeladenes Bild ausliefern (öffentlich, z.B. Lageplan im Team-Portal)
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { name } = await params;

  if (!isAllowedImageName(name)) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  const target = safeUploadPath(name);
  if (!target) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  try {
    const data = await readFile(target);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentTypeFor(name),
        "Cache-Control": "public, max-age=86400",
        // Als <img> eingebunden führt ein SVG nichts aus — beim direkten Aufruf
        // der Adresse im Browser schon. Die CSP verbietet dem Bild deshalb
        // alles: keine Skripte, keine Nachladungen. `nosniff` verhindert
        // zusätzlich, dass der Browser einen anderen Typ errät als wir angeben.
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
}
