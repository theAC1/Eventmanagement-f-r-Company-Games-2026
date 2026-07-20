// Pure helpers for the referee score-entry QR flow.
// Kept free of DOM/camera dependencies so the team-resolution logic can be
// unit-tested without exercising the camera pipeline.

/**
 * Extracts a team token from a scanned QR value.
 * The payload may be a portal URL (…/team/<token>), a URL with a `token`
 * query param, or a raw token string.
 */
export function parseQrToken(raw: string): string {
  let token = raw.trim();
  const tokenMatch = raw.match(/team\/([a-z0-9]+)/i);
  if (tokenMatch) {
    return tokenMatch[1];
  }
  try {
    const url = new URL(raw);
    token = url.searchParams.get("token") ?? url.pathname.split("/").filter(Boolean).pop() ?? token;
  } catch {
    // Not a URL — use the raw value.
  }
  return token;
}

export type QrResolution = { verified?: boolean; teamId?: string | null };

export const QR_NOT_FOUND_ERROR = "Unbekannter QR-Code – Team nicht gefunden";

export type ScanResult =
  | { ok: true; teamId: string }
  | { ok: false; error: string };

/**
 * Validates the /api/qr response. An unverified response or one without a
 * teamId is treated as an unknown QR code.
 */
export function resolveScanResult(data: QrResolution | null | undefined): ScanResult {
  if (!data || !data.verified || !data.teamId) {
    return { ok: false, error: QR_NOT_FOUND_ERROR };
  }
  return { ok: true, teamId: data.teamId };
}

export type TeamSelection = { selectedTeamId: string; selectedTeamId2: string };

/**
 * Applies a resolved team to the correct slot. Target "B" fills Team B (duel),
 * anything else fills Team A. Returns a new selection object; the other slot is
 * preserved.
 */
export function applyScannedTeam(
  current: TeamSelection,
  target: "A" | "B" | null,
  teamId: string,
): TeamSelection {
  if (target === "B") {
    return { ...current, selectedTeamId2: teamId };
  }
  return { ...current, selectedTeamId: teamId };
}
