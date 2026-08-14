import QRCode from "qrcode";

/**
 * Erzeugt einen QR-Code lokal als PNG-Data-URI.
 *
 * Bewusst KEIN externer QR-Dienst (z.B. api.qrserver.com): ein Data-URI ist
 * sofort verfügbar (kein Netzwerk-Roundtrip), funktioniert offline und wird
 * beim PNG-Export (html2canvas) nie durch CORS/Tainted-Canvas blockiert, weil
 * er same-origin ist.
 */
export async function generateQrDataUrl(data: string, size = 250): Promise<string> {
  return QRCode.toDataURL(data, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}
