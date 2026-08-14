import { describe, it, expect } from "vitest";
import { generateQrDataUrl } from "./qr";

describe("generateQrDataUrl", () => {
  it("liefert einen PNG-Data-URI (kein externer Dienst, kein Netzwerk-Roundtrip nötig)", async () => {
    const dataUrl = await generateQrDataUrl("https://games.arvuna.ch/team/abc123");
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("erzeugt für unterschiedliche Daten unterschiedliche Codes", async () => {
    const a = await generateQrDataUrl("https://games.arvuna.ch/team/team-a");
    const b = await generateQrDataUrl("https://games.arvuna.ch/team/team-b");
    expect(a).not.toBe(b);
  });

  it("respektiert die angeforderte Grösse über die width-Option", async () => {
    const small = await generateQrDataUrl("https://games.arvuna.ch/team/x", 100);
    const large = await generateQrDataUrl("https://games.arvuna.ch/team/x", 400);
    // Grössere QR-Codes ergeben mehr Bilddaten → längerer Base64-String.
    expect(large.length).toBeGreaterThan(small.length);
  });
});
