/**
 * Pure state-transition for a referee re-scanning a team QR on the mobile
 * score-entry screen. Kept camera-free so the "new team → reset inputs" rule
 * can be unit-tested.
 */

export type CheckinResponse = {
  verified?: boolean;
  teamId?: string | null;
  teamName?: string | null;
};

export type RescanOutcome =
  | { ok: true; teamId: string; teamName: string; resetValues: true }
  | { ok: false; error: string };

export const RESCAN_NOT_FOUND = 'Team nicht gefunden';

/**
 * Resolves a check-in response into the next screen state. A verified team
 * switches the badge and signals that the previously entered scores must be
 * cleared. Anything unverified surfaces the "Team nicht gefunden" error.
 */
export function resolveRescan(res: CheckinResponse | null | undefined): RescanOutcome {
  if (!res || !res.verified || !res.teamId) {
    return { ok: false, error: RESCAN_NOT_FOUND };
  }
  return {
    ok: true,
    teamId: res.teamId,
    teamName: res.teamName ?? 'Team',
    resetValues: true,
  };
}
