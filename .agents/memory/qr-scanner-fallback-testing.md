---
name: QR scanner jsQR fallback testing
description: How to exercise the BarcodeDetector-absent jsQR camera fallback (older iOS Safari) in a headless test browser.
---

The check-in scanner uses `BarcodeDetector` when available and falls back to jsQR-on-canvas otherwise. Desktop/headless Chromium always has `BarcodeDetector`, so the fallback path is never hit by default. To test it in a browser:

1. **Truly delete the global**: `delete window.BarcodeDetector`. Do NOT set `window.BarcodeDetector = undefined` — the code checks `"BarcodeDetector" in window`, and an undefined-valued key still satisfies `in`, so it takes the detector path and `new undefined()` throws straight into the "Kamera-Zugriff verweigert" catch. This wasted two test runs.
2. **Stub the camera**: draw the target QR onto an offscreen `<canvas>` in a `requestAnimationFrame` loop, `canvas.captureStream(15)`, then replace `navigator.mediaDevices.getUserMedia` (defineProperty configurable+writable) to return that stream. Chromium plays the canvas stream to a video element at readyState=4 with real frames.

**Deterministic decode check (no browser):** feed a `qrcode`-generated PNG's RGBA `ImageData` straight into the `jsqr` library and run the page's URL regexes. The team QR encodes `.../team/<qrToken>`; the token regex is `[a-z0-9]+`, which is correct for real cuid tokens (lowercase alnum) but silently truncates at `_`/uppercase — only a concern if token format ever changes.
