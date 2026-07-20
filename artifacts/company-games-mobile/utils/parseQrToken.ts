/**
 * Extracts a QR token from a scanned value.
 * QR payload may be a raw token or a URL containing the token as the
 * last path segment / a `token` query param.
 */
export function parseQrToken(value: string): string {
  let token = value.trim();
  try {
    const url = new URL(value);
    token = url.searchParams.get('token') ?? url.pathname.split('/').filter(Boolean).pop() ?? token;
  } catch {
    // Not a URL — use the raw value.
  }
  return token;
}
