import path from "path";
import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  UPLOADS_DIR,
  contentTypeFor,
  isAllowedImageName,
  randomFileName,
  safeUploadPath,
} from "./uploads";

describe("isAllowedImageName", () => {
  it("lässt die erlaubten Bildformate durch", () => {
    for (const name of ["a.jpg", "b.JPEG", "c.png", "d.webp", "e.gif"]) {
      expect(isAllowedImageName(name)).toBe(true);
    }
  });

  it("weist alles andere ab", () => {
    for (const name of ["skript.js", "doc.pdf", "archiv.zip", "ohne-endung", "bild.svg"]) {
      expect(isAllowedImageName(name)).toBe(false);
    }
  });

  it("lässt sich nicht von einer doppelten Endung täuschen", () => {
    expect(isAllowedImageName("bild.png.js")).toBe(false);
  });
});

describe("randomFileName", () => {
  it("behält die Endung und wirft den Originalnamen weg", () => {
    const name = randomFileName("Mein Lageplan.PNG");
    expect(name).toMatch(/^[0-9a-f]{32}\.png$/);
    expect(name).not.toContain("Lageplan");
  });

  it("liefert bei jedem Aufruf einen anderen Namen", () => {
    const namen = new Set(Array.from({ length: 50 }, () => randomFileName("x.jpg")));
    expect(namen.size).toBe(50);
  });
});

describe("safeUploadPath", () => {
  it("löst einen einfachen Dateinamen im Upload-Verzeichnis auf", () => {
    const ziel = safeUploadPath("bild.png");
    expect(ziel).toBe(path.join(path.resolve(UPLOADS_DIR), "bild.png"));
  });

  it("blockt Ausbrüche aus dem Upload-Verzeichnis", () => {
    expect(safeUploadPath("../geheim.env")).toBeNull();
    expect(safeUploadPath("../../etc/passwd")).toBeNull();
    expect(safeUploadPath("unterordner/../../weg.png")).toBeNull();
  });

  it("blockt absolute Pfade", () => {
    expect(safeUploadPath(path.resolve(path.sep, "etc", "passwd"))).toBeNull();
  });

  it("blockt Geschwister-Verzeichnisse mit gleichem Präfix", () => {
    // uploads-backup/ darf nicht als "innerhalb von uploads/" durchgehen
    expect(safeUploadPath("../uploads-backup/bild.png")).toBeNull();
  });

  it("blockt das Verzeichnis selbst", () => {
    expect(safeUploadPath("")).toBeNull();
    expect(safeUploadPath(".")).toBeNull();
  });
});

describe("contentTypeFor", () => {
  it("bildet die bekannten Endungen ab", () => {
    expect(contentTypeFor("a.jpg")).toBe("image/jpeg");
    expect(contentTypeFor("a.JPEG")).toBe("image/jpeg");
    expect(contentTypeFor("a.png")).toBe("image/png");
    expect(contentTypeFor("a.webp")).toBe("image/webp");
    expect(contentTypeFor("a.gif")).toBe("image/gif");
  });

  it("fällt bei Unbekanntem auf einen neutralen Typ zurück", () => {
    expect(contentTypeFor("a.txt")).toBe("application/octet-stream");
    expect(contentTypeFor("ohne-endung")).toBe("application/octet-stream");
  });
});

describe("MAX_UPLOAD_BYTES", () => {
  it("liegt bei 10 MB", () => {
    expect(MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
  });
});
