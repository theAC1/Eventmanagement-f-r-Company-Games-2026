/**
 * Druckdokument für Badges.
 *
 * Gedruckt werden dieselben Canvas-PNGs, die auch der Export erzeugt
 * ([[badge-canvas]]) — nicht eine zweite HTML-Nachbildung des Badges. Damit
 * können Vorschau, PNG und Ausdruck nicht auseinanderlaufen, und der Druck
 * hängt an keinem CSS, das im frisch geöffneten Fenster fehlen könnte.
 */

export type PrintBadge = {
  name: string;
  /** PNG als Data-URI. */
  dataUrl: string;
};

/**
 * Badge-Breite im Ausdruck.
 *
 * 85 mm statt 90: Ein Badge ist rund 1.56× so hoch wie breit, bei 90 mm also
 * bis zu 141 mm hoch — zwei Reihen plus Abstand sprengten damit die 277 mm
 * nutzbare A4-Höhe, und es landeten nur zwei statt vier Badges pro Blatt.
 * Mit 85 mm Breite und 8 mm Seitenrand passen verlässlich 2×2 Karten aufs Blatt.
 */
const BADGE_WIDTH_MM = 85;
const GAP_MM = 6;
const PAGE_MARGIN_MM = 8;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Baut ein eigenständiges Druckdokument.
 * Der eingebettete Load-Handler wartet, bis alle Bilder wirklich dekodiert
 * sind, und löst erst dann den Druckdialog aus — ein fester Timeout wäre bei
 * vielen Badges ein Ratespiel.
 */
export function buildPrintDocument(badges: PrintBadge[], title: string): string {
  const cards = badges
    .map(
      (b) =>
        `<figure class="badge"><img src="${b.dataUrl}" alt="${escapeHtml(b.name)}"></figure>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #fff; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, ${BADGE_WIDTH_MM}mm);
    gap: ${GAP_MM}mm;
    justify-content: center;
    padding: ${GAP_MM}mm 0;
  }
  .badge {
    width: ${BADGE_WIDTH_MM}mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .badge img { width: 100%; height: auto; display: block; }
  @page { size: A4 portrait; margin: ${PAGE_MARGIN_MM}mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .grid { padding: 0; }
  }
</style>
</head>
<body>
<div class="grid">
${cards}
</div>
<script>
  // Bewusst KEIN window.close() nach dem Drucken: "afterprint" feuert auch
  // beim Abbrechen des Druckdialogs. Das Fenster würde sich dann schliessen
  // und alle Badges wären weg — ausgerechnet wenn jemand nur kurz das Format
  // prüfen oder einen anderen Drucker wählen wollte.
  window.addEventListener("load", function () {
    // Ein zusätzlicher Frame, damit das Layout sicher steht, bevor der
    // Druckdialog die Seite einfriert.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { window.print(); });
    });
  });
</script>
</body>
</html>`;
}

/**
 * Öffnet SOFORT ein leeres Druckfenster.
 *
 * Muss synchron im Klick-Handler passieren: Browser erlauben `window.open` nur
 * während der "transient activation" eines echten Klicks. Wird zuerst das
 * Rendern der Badges abgewartet (mehrere Sekunden bei 14 Karten), ist dieses
 * Zeitfenster abgelaufen und der Popup-Blocker greift — der Druck schlüge
 * regelmässig fehl, obwohl der Benutzer nichts falsch gemacht hat.
 *
 * Gibt `null` zurück, wenn der Blocker trotzdem zugeschlagen hat.
 */
export function openPrintWindow(): Window | null {
  // Fester Fenstername statt "_blank": wiederholtes Drucken benutzt denselben
  // Tab, statt bei jedem Klick einen neuen aufzumachen.
  const printWindow = window.open("", "cg26-badge-print");
  if (!printWindow) return null;
  printWindow.document.open();
  printWindow.document.write(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Badges werden vorbereitet…</title></head>
     <body style="font-family:sans-serif;padding:2rem;color:#334">Badges werden vorbereitet…</body></html>`,
  );
  printWindow.document.close();
  return printWindow;
}

/** Schreibt das fertige Dokument in das bereits geöffnete Fenster. */
export function writePrintDocument(printWindow: Window, html: string): void {
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
