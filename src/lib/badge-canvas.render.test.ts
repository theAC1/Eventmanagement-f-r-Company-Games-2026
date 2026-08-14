/**
 * Echter Rendering-Test: zeichnet ein Badge auf eine Canvas und prüft Pixel.
 *
 * Warum das nötig ist: Der frühere Export über html2canvas lieferte optisch
 * plausible Badges, in denen QR-Code und Backup-Code als LEERE Kästen landeten.
 * Typprüfung, Lint und Layout-Tests waren dabei alle grün — nur ein Blick auf
 * die tatsächlichen Pixel deckt so einen Fehler auf.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createCanvas, loadImage as loadNodeImage, type SKRSContext2D } from "@napi-rs/canvas";
import QRCode from "qrcode";
import {
  prepareBadge,
  drawBadge,
  badgeLayout,
  qrBoxRect,
  CARD_W,
  type BadgeTeam,
} from "./badge-canvas";

const TEAM: BadgeTeam = {
  id: "t1",
  name: "Die Aargauische Gebäudeversicherung",
  nummer: 12,
  farbe: "#2563EB",
  logoUrl: null,
  motto: "Gut versichert, rundum geschützt.",
  checkinCode: "B6J",
  qrToken: "token-abc",
};

type Px = { r: number; g: number; b: number; a: number };

function pixelAt(ctx: SKRSContext2D, x: number, y: number): Px {
  const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], a: d[3] };
}

/** Zählt Pixel in einem Bereich, die ein Prädikat erfüllen. */
function countPixels(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  match: (p: Px) => boolean,
): number {
  const data = ctx.getImageData(Math.round(x), Math.round(y), Math.round(w), Math.round(h)).data;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (match({ r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] })) n++;
  }
  return n;
}

/**
 * QR-Module sind reines Schwarz. Der Kartenhintergrund (#0A111C) ist zwar
 * ebenfalls dunkel, aber messbar heller — die scharfe Schwelle trennt beide,
 * damit "QR ausserhalb des Kastens" nicht mit Hintergrund verwechselt wird.
 */
const isQrBlack = (p: Px) => p.r < 6 && p.g < 6 && p.b < 6 && p.a > 200;
const isNearWhite = (p: Px) => p.r > 200 && p.g > 200 && p.b > 200 && p.a > 200;

describe("drawBadge (echtes Rendering)", () => {
  let ctx: SKRSContext2D;
  let height: number;
  // Das TATSÄCHLICH gezeichnete Layout — nicht ein von Hand nachgebautes.
  // Sonst könnten die Pixelproben am falschen Ort messen und die Tests
  // wären grün, ohne je den echten Inhalt gesehen zu haben.
  let layout: ReturnType<typeof badgeLayout>;

  beforeAll(async () => {
    const qrDataUrl = await QRCode.toDataURL(`https://games.arvuna.ch/team/${TEAM.qrToken}`, {
      width: 400,
      margin: 3,
      errorCorrectionLevel: "M",
    });
    const qrImage = await loadNodeImage(qrDataUrl);

    const measure = createCanvas(10, 10).getContext("2d");
    // Die Zeichenfunktionen sind gegen die Browser-Canvas-API typisiert;
    // @napi-rs/canvas implementiert dieselbe Schnittstelle.
    const prepared = prepareBadge(
      measure as unknown as CanvasRenderingContext2D,
      TEAM,
      { qr: qrImage as unknown as HTMLImageElement, logo: null },
    );
    height = prepared.height;
    layout = prepared.layout;

    const canvas = createCanvas(CARD_W, height);
    ctx = canvas.getContext("2d");
    drawBadge(ctx as unknown as CanvasRenderingContext2D, prepared, 0, 0);
  });

  it("zeichnet den Farbstreifen oben in der Teamfarbe", () => {
    const p = pixelAt(ctx, CARD_W / 2, 3);
    expect(p.r).toBeGreaterThan(0x20);
    expect(p.b).toBeGreaterThan(0x80); // #2563EB ist deutlich blau
  });

  it("REGRESSION: der QR-Code ist tatsächlich gezeichnet, nicht nur ein weisser Kasten", () => {
    const box = qrBoxRect(layout);
    // Innerhalb des weissen Kastens müssen QR-Module liegen.
    const dark = countPixels(ctx, box.x, box.y, box.size, box.size, isQrBlack);
    expect(dark).toBeGreaterThan(500);
  });

  it("REGRESSION: der QR-Code liegt vollständig INNERHALB des weissen Kastens", () => {
    const box = qrBoxRect(layout);
    // Direkt unterhalb des Kastens darf kein QR-Modul mehr auftauchen —
    // genau dort hing beim alten html2canvas-Export der abgeschnittene Rest.
    const below = countPixels(ctx, box.x, box.y + box.size + 1, box.size, 6, isQrBlack);
    expect(below).toBe(0);
    // Und links/rechts daneben ebenso wenig.
    const beside = countPixels(ctx, 0, box.y, box.x - 1, box.size, isQrBlack);
    expect(beside).toBe(0);
  });

  it("REGRESSION: der Backup-Code ist im dunklen Kasten sichtbar", () => {
    // Weisse Schrift auf #101B2B — ohne Text wäre der Kasten gleichmässig dunkel.
    const light = countPixels(ctx, 0, layout.backupY, CARD_W, layout.backupH, isNearWhite);
    expect(light).toBeGreaterThan(100);
  });

  it("zeichnet den Teamnamen (helle Schrift oberhalb des QR-Blocks)", () => {
    const light = countPixels(ctx, 0, layout.nameY, CARD_W, layout.numY - layout.nameY, isNearWhite);
    expect(light).toBeGreaterThan(100);
  });

  it("bleibt innerhalb der berechneten Kartenhöhe (nichts läuft unten heraus)", () => {
    // Die unterste Pixelzeile gehört zur abgerundeten Ecke und muss
    // transparent oder Kartenhintergrund sein — kein abgeschnittener Inhalt.
    const strayLight = countPixels(ctx, 0, height - 2, CARD_W, 2, isNearWhite);
    expect(strayLight).toBe(0);
  });
});
