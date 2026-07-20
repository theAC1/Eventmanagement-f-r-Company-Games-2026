import { prisma } from "./prisma";
import { generateUniqueCheckinCode } from "./checkin-code";
import { logger } from "./logger";

const VALID_CHECKIN_CODE = /^[A-Z][2-9][A-Z]$/;

/**
 * Ensures every team has a manually-typeable 3-character check-in code.
 * Legacy teams were created with a cuid() default (long, non-typeable), which
 * breaks the manual check-in fallback on the referee page. This backfill is
 * idempotent: teams that already have a valid 3-char code are left untouched.
 */
export async function backfillCheckinCodes(): Promise<void> {
  const teams = await prisma.team.findMany({ select: { id: true, checkinCode: true } });
  const existingCodes = new Set<string>(
    teams
      .map((t) => t.checkinCode)
      .filter((c): c is string => !!c && VALID_CHECKIN_CODE.test(c)),
  );

  const invalid = teams.filter((t) => !t.checkinCode || !VALID_CHECKIN_CODE.test(t.checkinCode));
  if (invalid.length === 0) return;

  for (const team of invalid) {
    const code = generateUniqueCheckinCode(existingCodes);
    existingCodes.add(code);
    await prisma.team.update({ where: { id: team.id }, data: { checkinCode: code } });
  }
  logger.info({ count: invalid.length }, "Backfilled legacy check-in codes");
}
