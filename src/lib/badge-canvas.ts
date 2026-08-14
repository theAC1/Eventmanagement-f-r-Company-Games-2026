/**
 * Badge-Rendering direkt über die Canvas-2D-API.
 *
 * Bewusst KEIN html2canvas: Das Paket muss DOM + CSS nachbauen und scheiterte
 * reproduzierbar an den zentrierten inline-block-Boxen des Badges — QR-Container
 * und Backup-Code landeten als leere Kästen im PNG. Beim direkten Zeichnen gibt
 * es keine Layout-Übersetzung: Was hier steht, landet pixelgenau im Bild.
 *
 * Dieses Modul ist die einzige Quelle für das Badge-Aussehen. Der Druck bettet
 * dieselben Canvas-PNGs ein, damit Vorschau, Export und Ausdruck nicht
 * auseinanderlaufen können.
 */

export type BadgeTeam = {
  id: string;
  name: string;
  nummer: number;
  farbe: string;
  logoUrl: string | null;
  motto: string | null;
  checkinCode: string;
  qrToken: string;
};

// ─── Layout (CSS-Pixel der 380px-Vorlage) ───

export const CARD_W = 380;
const CARD_RADIUS = 16;
const HEADER_H = 6;
const PAD_X = 28;
const PAD_Y = 24;
const BLOCK_GAP = 20;

const LOGO = 56;
const LOGO_GAP = 12;

const NAME_SIZE = 22;
const NAME_LH = 28;
const NUM_SIZE = 14;
const NUM_LH = 18;
const MOTTO_SIZE = 12;
const MOTTO_LH = 16;
const MOTTO_TOP = 4;

const QR_SIZE = 180;
const QR_PAD = 12;
const QR_BOX = QR_SIZE + QR_PAD * 2;
const QR_RADIUS = 12;
const CAP_TOP = 8;
const CAP1_SIZE = 11;
const CAP1_LH = 14;
const CAP2_SIZE = 9;
const CAP2_LH = 12;

const BK_PAD_X = 20;
const BK_PAD_Y = 6;
const BK_RADIUS = 8;
const BK_LABEL_SIZE = 9;
const BK_LABEL_LH = 11;
const BK_LABEL_GAP = 2;
const BK_CODE_SIZE = 28;
const BK_CODE_LH = 34;

const FOOT_TOP = 8;
const FOOT_SIZE = 10;
const FOOT_LH = 12;

// ─── Farben ───

/**
 * Zwei Paletten für dasselbe Layout.
 *
 * "dunkel" entspricht der Bildschirmvorschau. "hell" ist für den echten
 * Ausdruck: Ein fast vollflächig dunkles Badge verbraucht bei 14 Karten sehr
 * viel Toner und wird auf einfachen Druckern streifig — auf weissem Grund
 * druckt es sauber und der QR-Code hat von Haus aus den besten Kontrast.
 */
export type BadgePalette = {
  bg: string;
  ink: string;
  inkDim: string;
  inkFaint: string;
  accent: string;
  backupBg: string;
  line: string;
  /** Rahmen um die Karte — auf Weiss sonst keine sichtbare Schnittkante. */
  cardBorder: string | null;
  /** Hintergrund hinter dem QR-Code. */
  qrBg: string;
};

export const PALETTE_DUNKEL: BadgePalette = {
  bg: "#0A111C",
  ink: "#FFFFFF",
  inkDim: "#8598B4",
  inkFaint: "#7C90AE",
  accent: "#34C77B",
  backupBg: "#101B2B",
  line: "#1D2C44",
  cardBorder: null,
  qrBg: "#FFFFFF",
};

export const PALETTE_HELL: BadgePalette = {
  bg: "#FFFFFF",
  ink: "#0A111C",
  inkDim: "#5A6B85",
  inkFaint: "#6B7C96",
  accent: "#127A45",
  backupBg: "#F1F4F9",
  line: "#C8D2E0",
  cardBorder: "#B4C0D2",
  qrBg: "#FFFFFF",
};

const WHITE = "#FFFFFF";

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

const FOOTER_TEXT = "COMPANY GAMES 2026";
const CAPTION_1 = "TEAM-QR SCANNEN";
const CAPTION_2 = "Zeitplan · Punkte · Lageplan · Check-in";
const BK_LABEL = "BACKUP CODE";

/** Maximal zwei Zeilen für Name und Motto — mehr sprengt die Badge-Höhe. */
const MAX_NAME_LINES = 2;
const MAX_MOTTO_LINES = 2;

// ─── Pure Helfer (ohne Canvas testbar) ───

/** Kürzt `text`, bis er mit Auslassungszeichen in `maxWidth` passt. */
export function ellipsize(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
): string {
  if (measure(text) <= maxWidth) return text;
  // Über Code-Punkte kürzen, nicht über UTF-16-Einheiten: `slice(0, -1)`
  // zerschneidet Emoji und andere Zeichen ausserhalb der BMP mitten entzwei
  // und hinterlässt ein Ersatzzeichen im gedruckten Namen.
  const chars = [...text];
  while (chars.length > 1) {
    chars.pop();
    const kandidat = chars.join("").trimEnd();
    if (measure(`${kandidat}…`) <= maxWidth) return `${kandidat}…`;
  }
  return `${chars.join("").trimEnd()}…`;
}

/**
 * Bricht `text` auf `maxWidth` um. `measure` misst die Breite eines Strings —
 * so bleibt die Funktion ohne Canvas testbar.
 *
 * Nach `maxLines` Zeilen wird der Rest in der letzten Zeile angedeutet; auch
 * ein einzelnes überlanges Wort (ohne Leerzeichen) wird gekürzt, damit nie
 * etwas über den Kartenrand hinausläuft.
 */
export function wrapLines(
  text: string,
  maxWidth: number,
  maxLines: number,
  measure: (s: string) => number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = "";

  for (let i = 0; i < words.length; i++) {
    const candidate = current ? `${current} ${words[i]}` : words[i];
    if (!current || measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (lines.length + 1 < maxLines) {
      lines.push(current);
      current = words[i];
      continue;
    }
    // Zeilenbudget erschöpft — der Rest wird in der letzten Zeile angedeutet.
    lines.push(ellipsize(`${current} ${words.slice(i).join(" ")}`, maxWidth, measure));
    return lines;
  }

  lines.push(ellipsize(current, maxWidth, measure));
  return lines;
}

/** Höhe der Backup-Code-Box (unabhängig vom Text — nur die Breite variiert). */
const BK_BOX_H = BK_PAD_Y + BK_LABEL_LH + BK_LABEL_GAP + BK_CODE_LH + BK_PAD_Y;

/**
 * Alle senkrechten Positionen einer Karte, relativ zur oberen Kartenkante.
 *
 * Bewusst EINE Funktion für Höhe und Positionen: Würden Messung und Zeichnung
 * ihre y-Werte getrennt ausrechnen, könnten sie auseinanderlaufen und der
 * Inhalt liefe unten aus der Karte — genau die Art Fehler, die im Export
 * niemandem auffällt, bis die Badges gedruckt sind.
 */
export type BadgeLayout = {
  height: number;
  logoY: number;
  nameY: number;
  numY: number;
  mottoY: number;
  qrBoxY: number;
  cap1Y: number;
  cap2Y: number;
  backupY: number;
  backupH: number;
  footerLineY: number;
  footerTextY: number;
};

export function badgeLayout(nameLines: number, mottoLines: number): BadgeLayout {
  const lines = Math.max(1, nameLines);

  const logoY = HEADER_H + PAD_Y;
  const nameY = logoY + LOGO + LOGO_GAP;
  const numY = nameY + lines * NAME_LH;
  const mottoY = numY + NUM_LH + MOTTO_TOP;
  const afterInfo = mottoLines > 0 ? mottoY + mottoLines * MOTTO_LH : numY + NUM_LH;

  const qrBoxY = afterInfo + BLOCK_GAP;
  const cap1Y = qrBoxY + QR_BOX + CAP_TOP;
  const cap2Y = cap1Y + CAP1_LH;

  const backupY = cap2Y + CAP2_LH + BLOCK_GAP;
  const footerLineY = backupY + BK_BOX_H + BLOCK_GAP;
  const footerTextY = footerLineY + 1 + FOOT_TOP;

  return {
    height: footerTextY + FOOT_LH + PAD_Y,
    logoY,
    nameY,
    numY,
    mottoY,
    qrBoxY,
    cap1Y,
    cap2Y,
    backupY,
    backupH: BK_BOX_H,
    footerLineY,
    footerTextY,
  };
}

/** Höhe einer Badge-Karte aus den bereits umgebrochenen Zeilen. */
export function badgeHeight(nameLines: number, mottoLines: number): number {
  return badgeLayout(nameLines, mottoLines).height;
}

/** Waagrechte Lage der QR-Box — für Tests und den Druck-Zuschnitt. */
export function qrBoxRect(layout: BadgeLayout): { x: number; y: number; size: number } {
  return { x: (CARD_W - QR_BOX) / 2, y: layout.qrBoxY, size: QR_BOX };
}

// ─── Canvas-Primitive ───

type Ctx = CanvasRenderingContext2D;

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function font(size: number, weight: string, family = SANS): string {
  return `${weight} ${size}px ${family}`;
}

/**
 * Zeichnet Text mittig mit fester Laufweite (letter-spacing).
 * Bewusst zeichenweise statt über ctx.letterSpacing: das Attribut ist nicht
 * überall verfügbar und würde je nach Browser andere Breiten liefern.
 */
function fillTracked(ctx: Ctx, text: string, cx: number, y: number, tracking: number): void {
  const chars = [...text];
  if (chars.length === 0) return;
  if (tracking === 0) {
    ctx.textAlign = "center";
    ctx.fillText(text, cx, y);
    return;
  }
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  let x = cx - total / 2;
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y);
    x += widths[i] + tracking;
  });
  ctx.textAlign = prevAlign;
}

function trackedWidth(ctx: Ctx, text: string, tracking: number): number {
  const chars = [...text];
  if (chars.length === 0) return 0;
  const sum = chars.reduce((acc, c) => acc + ctx.measureText(c).width, 0);
  return sum + tracking * (chars.length - 1);
}

// ─── Bild-Laden ───

/**
 * Lädt ein Bild und wartet auf das Dekodieren. Gibt `null` zurück statt zu
 * werfen — ein fehlendes Logo darf den Export nie abbrechen.
 *
 * `crossOrigin: "anonymous"` ist Absicht: Ohne CORS-Freigabe schlägt das Laden
 * fehl (→ Fallback auf den Nummernkreis), statt die Canvas zu "tainten" und
 * toDataURL() mit einem SecurityError scheitern zu lassen.
 */
export function loadImage(
  src: string,
  { crossOrigin = true, timeoutMs = 8000 } = {},
): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = (value: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);

    img.onload = () => {
      const done = () => finish(img);
      if (typeof img.decode === "function") {
        img.decode().then(done, done);
      } else {
        done();
      }
    };
    img.onerror = () => finish(null);

    if (crossOrigin && !src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.src = src;
  });
}

// ─── Zeichnen ───

export type BadgeAssets = {
  qr: HTMLImageElement | null;
  logo: HTMLImageElement | null;
};

export type PreparedBadge = {
  team: BadgeTeam;
  assets: BadgeAssets;
  nameLines: string[];
  mottoLines: string[];
  layout: BadgeLayout;
  height: number;
};

/** Misst Zeilenumbrüche und berechnet das Layout einer Karte. */
export function prepareBadge(ctx: Ctx, team: BadgeTeam, assets: BadgeAssets): PreparedBadge {
  const maxWidth = CARD_W - PAD_X * 2;

  ctx.font = font(NAME_SIZE, "bold");
  const nameLines = wrapLines(team.name, maxWidth, MAX_NAME_LINES, (s) => ctx.measureText(s).width);

  ctx.font = font(MOTTO_SIZE, "italic 400");
  const mottoLines = team.motto
    ? wrapLines(team.motto, maxWidth, MAX_MOTTO_LINES, (s) => ctx.measureText(s).width)
    : [];

  const layout = badgeLayout(nameLines.length, mottoLines.length);
  return { team, assets, nameLines, mottoLines, layout, height: layout.height };
}

/**
 * Zeichnet eine Badge-Karte mit der linken oberen Ecke bei (ox, oy).
 *
 * `targetHeight` streckt die Karte auf eine einheitliche Höhe — auf einem
 * Sammelbogen bekommen dann alle Badges dieselbe Grösse, was das Ausschneiden
 * erheblich vereinfacht. Der zusätzliche Platz wandert über die Fusszeile,
 * die immer am unteren Rand sitzt.
 */
export function drawBadge(
  ctx: Ctx,
  badge: PreparedBadge,
  ox: number,
  oy: number,
  targetHeight?: number,
  palette: BadgePalette = PALETTE_DUNKEL,
): void {
  const { team, assets, nameLines, mottoLines } = badge;
  const P = palette;
  const height = Math.max(badge.height, targetHeight ?? 0);
  const footerShift = height - badge.height;
  const cx = ox + CARD_W / 2;

  ctx.save();

  // Karte + Farbstreifen (Streifen auf die runden Ecken beschnitten)
  roundRect(ctx, ox, oy, CARD_W, height, CARD_RADIUS);
  ctx.fillStyle = P.bg;
  ctx.fill();
  if (P.cardBorder) {
    // Auf weissem Grund braucht die Karte eine sichtbare Schnittkante.
    ctx.strokeStyle = P.cardBorder;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.save();
  ctx.clip();
  ctx.fillStyle = team.farbe || "#6b7280";
  ctx.fillRect(ox, oy, CARD_W, HEADER_H);
  ctx.restore();

  ctx.textBaseline = "middle";
  const L = badge.layout;

  // Logo oder Nummernkreis
  if (assets.logo) {
    // "objectFit: contain" von Hand: Seitenverhältnis erhalten, zentriert.
    const iw = assets.logo.naturalWidth || LOGO;
    const ih = assets.logo.naturalHeight || LOGO;
    const factor = Math.min(LOGO / iw, LOGO / ih);
    const w = iw * factor;
    const h = ih * factor;
    ctx.drawImage(assets.logo, cx - w / 2, oy + L.logoY + (LOGO - h) / 2, w, h);
  } else {
    ctx.beginPath();
    ctx.arc(cx, oy + L.logoY + LOGO / 2, LOGO / 2, 0, Math.PI * 2);
    ctx.fillStyle = team.farbe || "#6b7280";
    ctx.fill();
    ctx.fillStyle = WHITE;
    ctx.font = font(24, "bold");
    ctx.textAlign = "center";
    ctx.fillText(String(team.nummer), cx, oy + L.logoY + LOGO / 2);
  }

  // Teamname
  ctx.fillStyle = P.ink;
  ctx.font = font(NAME_SIZE, "bold");
  ctx.textAlign = "center";
  const shownName = nameLines.length > 0 ? nameLines : [team.name];
  shownName.forEach((line, i) => {
    ctx.fillText(line, cx, oy + L.nameY + i * NAME_LH + NAME_LH / 2);
  });

  // Startnummer
  ctx.fillStyle = P.inkDim;
  ctx.font = font(NUM_SIZE, "400");
  ctx.fillText(`#${team.nummer}`, cx, oy + L.numY + NUM_LH / 2);

  // Motto
  if (mottoLines.length > 0) {
    ctx.fillStyle = P.inkFaint;
    ctx.font = font(MOTTO_SIZE, "italic 400");
    mottoLines.forEach((line, i) => {
      ctx.fillText(line, cx, oy + L.mottoY + i * MOTTO_LH + MOTTO_LH / 2);
    });
  }

  // QR-Block: weisser Kasten, QR mittig
  const qrY = oy + L.qrBoxY;
  roundRect(ctx, cx - QR_BOX / 2, qrY, QR_BOX, QR_BOX, QR_RADIUS);
  ctx.fillStyle = P.qrBg;
  ctx.fill();
  if (assets.qr) {
    ctx.drawImage(assets.qr, cx - QR_SIZE / 2, qrY + QR_PAD, QR_SIZE, QR_SIZE);
  }

  ctx.fillStyle = P.accent;
  ctx.font = font(CAP1_SIZE, "600");
  fillTracked(ctx, CAPTION_1, cx, oy + L.cap1Y + CAP1_LH / 2, CAP1_SIZE * 0.05);

  ctx.fillStyle = P.inkFaint;
  ctx.font = font(CAP2_SIZE, "400");
  ctx.textAlign = "center";
  ctx.fillText(CAPTION_2, cx, oy + L.cap2Y + CAP2_LH / 2);

  // Backup-Code — nur die Breite hängt vom Text ab, die Höhe ist fest.
  const code = team.checkinCode || "---";
  ctx.font = font(BK_CODE_SIZE, "bold", MONO);
  const codeTracking = BK_CODE_SIZE * 0.2;
  const codeW = trackedWidth(ctx, code, codeTracking);
  ctx.font = font(BK_LABEL_SIZE, "400");
  const labelW = ctx.measureText(BK_LABEL).width;
  const boxW = Math.max(codeW, labelW) + BK_PAD_X * 2;
  const bkY = oy + L.backupY;

  roundRect(ctx, cx - boxW / 2, bkY, boxW, L.backupH, BK_RADIUS);
  ctx.fillStyle = P.backupBg;
  ctx.fill();
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = P.inkFaint;
  ctx.font = font(BK_LABEL_SIZE, "400");
  ctx.textAlign = "center";
  ctx.fillText(BK_LABEL, cx, bkY + BK_PAD_Y + BK_LABEL_LH / 2);

  ctx.fillStyle = P.ink;
  ctx.font = font(BK_CODE_SIZE, "bold", MONO);
  fillTracked(
    ctx,
    code,
    cx,
    bkY + BK_PAD_Y + BK_LABEL_LH + BK_LABEL_GAP + BK_CODE_LH / 2,
    codeTracking,
  );

  // Fusszeile — bei gestreckter Karte am unteren Rand
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ox + PAD_X, oy + L.footerLineY + footerShift + 0.5);
  ctx.lineTo(ox + CARD_W - PAD_X, oy + L.footerLineY + footerShift + 0.5);
  ctx.stroke();

  const y = oy + L.footerTextY + footerShift;

  ctx.fillStyle = P.inkFaint;
  ctx.font = font(FOOT_SIZE, "600");
  fillTracked(ctx, FOOTER_TEXT, cx, y + FOOT_LH / 2, FOOT_SIZE * 0.1);

  ctx.restore();
}

// ─── Öffentliche API ───

export type RenderResult = {
  canvas: HTMLCanvasElement;
  /** Teams, deren Logo nicht CORS-fähig geladen werden konnte. */
  logosSkipped: string[];
};

async function loadAssets(
  teams: BadgeTeam[],
  qrByTeamId: Record<string, string>,
): Promise<{ assets: Map<string, BadgeAssets>; logosSkipped: string[] }> {
  const logosSkipped: string[] = [];
  const entries = await Promise.all(
    teams.map(async (team) => {
      const [qr, logo] = await Promise.all([
        qrByTeamId[team.id] ? loadImage(qrByTeamId[team.id]) : Promise.resolve(null),
        team.logoUrl ? loadImage(team.logoUrl) : Promise.resolve(null),
      ]);
      if (team.logoUrl && !logo) logosSkipped.push(team.name);
      return [team.id, { qr, logo }] as const;
    }),
  );
  return { assets: new Map(entries), logosSkipped };
}

/** Schriften müssen geladen sein, sonst misst die Canvas mit Ersatzschrift. */
async function fontsReady(): Promise<void> {
  try {
    await document.fonts?.ready;
  } catch {
    // Nicht kritisch — Systemschriften stehen ohnehin sofort bereit.
  }
}

/**
 * Rendert ein einzelnes Badge in eine Canvas.
 * `scale` ist der Faktor gegenüber der 380px-Vorlage (4 ≈ 385 dpi bei 100 mm).
 */
export async function renderBadge(
  team: BadgeTeam,
  qrDataUrl: string,
  scale = 4,
  palette: BadgePalette = PALETTE_DUNKEL,
): Promise<RenderResult> {
  return renderBadgeSheet(
    [team],
    { [team.id]: qrDataUrl },
    { scale, columns: 1, padding: 0, gap: 0, background: null, palette },
  );
}

export type SingleBadge = {
  team: BadgeTeam;
  canvas: HTMLCanvasElement;
};

/**
 * Rendert jedes Badge in eine EIGENE Canvas — für den Druck, wo jede Karte
 * ein eigenes Bild auf dem Bogen ist.
 *
 * Alle Karten bekommen die Höhe der höchsten: gedruckt haben dann sämtliche
 * Badges dasselbe Format, was das Ausschneiden erheblich vereinfacht.
 */
export async function renderBadgesIndividually(
  teams: BadgeTeam[],
  qrByTeamId: Record<string, string>,
  scale = 3,
  palette: BadgePalette = PALETTE_DUNKEL,
): Promise<{ badges: SingleBadge[]; logosSkipped: string[] }> {
  if (teams.length === 0) throw new Error("Keine Teams zum Rendern");

  await fontsReady();
  const { assets, logosSkipped } = await loadAssets(teams, qrByTeamId);

  const measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) throw new Error("Canvas-Kontext nicht verfügbar");

  const prepared = teams.map((team) =>
    prepareBadge(measureCtx, team, assets.get(team.id) ?? { qr: null, logo: null }),
  );
  const cellH = Math.max(...prepared.map((p) => p.height));

  const badges = prepared.map((badge) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(CARD_W * scale);
    canvas.height = Math.round(cellH * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas-Kontext nicht verfügbar");
    ctx.scale(scale, scale);
    drawBadge(ctx, badge, 0, 0, cellH, palette);
    return { team: badge.team, canvas };
  });

  return { badges, logosSkipped };
}

/**
 * Lädt die Canvas als PNG herunter.
 * Über `toBlob` statt `toDataURL`: Ein Sammelbogen mit vielen Badges ergibt
 * einen Data-URI von etlichen Megabyte als String — der Blob-Weg ist deutlich
 * sparsamer und kippt nicht an String-Grenzen.
 */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("PNG konnte nicht erzeugt werden"));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = filename;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      resolve();
    }, "image/png");
  });
}

export type SheetOptions = {
  scale?: number;
  columns?: number;
  padding?: number;
  gap?: number;
  /** `null` = transparent. */
  background?: string | null;
  palette?: BadgePalette;
};

/**
 * Rendert mehrere Badges als Raster in eine Canvas.
 * Alle Karten bekommen dieselbe Höhe (höchste Karte), damit das Raster sauber
 * bleibt, auch wenn Mottos unterschiedlich viele Zeilen brauchen.
 */
export async function renderBadgeSheet(
  teams: BadgeTeam[],
  qrByTeamId: Record<string, string>,
  options: SheetOptions = {},
): Promise<RenderResult> {
  const {
    scale = 3,
    columns = 4,
    padding = 32,
    gap = 32,
    background = "#FFFFFF",
    palette = PALETTE_DUNKEL,
  } = options;

  if (teams.length === 0) throw new Error("Keine Teams zum Rendern");

  await fontsReady();
  const { assets, logosSkipped } = await loadAssets(teams, qrByTeamId);

  // Messen auf einer Wegwerf-Canvas — das Ergebnis bestimmt die Zielgrösse.
  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  if (!measureCtx) throw new Error("Canvas-Kontext nicht verfügbar");

  const prepared = teams.map((team) =>
    prepareBadge(measureCtx, team, assets.get(team.id) ?? { qr: null, logo: null }),
  );

  const cols = Math.max(1, Math.min(columns, prepared.length));
  const rows = Math.ceil(prepared.length / cols);
  const cellH = Math.max(...prepared.map((p) => p.height));

  const cssW = padding * 2 + cols * CARD_W + (cols - 1) * gap;
  const cssH = padding * 2 + rows * cellH + (rows - 1) * gap;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cssW * scale);
  canvas.height = Math.round(cssH * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas-Kontext nicht verfügbar");

  ctx.scale(scale, scale);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, cssW, cssH);
  }

  prepared.forEach((badge, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    drawBadge(
      ctx,
      badge,
      padding + col * (CARD_W + gap),
      padding + row * (cellH + gap),
      cellH,
      palette,
    );
  });

  return { canvas, logosSkipped };
}
