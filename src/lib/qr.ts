import QRCode from "qrcode";

/**
 * Erzeugt einen QR-Code lokal als PNG-Data-URI.
 *
 * Bewusst KEIN externer QR-Dienst (z.B. api.qrserver.com): ein Data-URI ist
 * sofort verfügbar (kein Netzwerk-Roundtrip), funktioniert offline und kann
 * beim PNG-Export die Canvas nicht "tainten" — `toBlob()` würde sonst mit
 * einem SecurityError scheitern.
 */
export async function generateQrDataUrl(data: string, size = 250): Promise<string> {
  return QRCode.toDataURL(data, {
    width: size,
    // Ruhezone: Die QR-Spezifikation verlangt 4 Module weissen Rand, sonst
    // finden Scanner den Code auf dunklem Untergrund schlechter. Der Badge
    // setzt den Code auf eine dunkle Karte — die Ruhezone muss also im Bild
    // selbst stecken, nicht nur im Layout drumherum.
    margin: 3,
    errorCorrectionLevel: "M",
  });
}
