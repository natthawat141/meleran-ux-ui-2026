import { Prisma } from '@prisma/client';
import { AI_QUOTA_TIME_ZONE } from './ai.config';

/** One trusted database instant, independent of process/database session timezone. */
export async function quotaWindow(tx: Prisma.TransactionClient, instant: Date): Promise<{ usageDate: Date; resetAt: Date }> {
  const windows = await tx.$queryRaw<Array<{ usageDate: Date; resetAt: Date }>>(Prisma.sql`
    SELECT (${instant}::timestamptz AT TIME ZONE ${AI_QUOTA_TIME_ZONE})::date AS "usageDate",
      (((${instant}::timestamptz AT TIME ZONE ${AI_QUOTA_TIME_ZONE})::date + 1)::timestamp
        AT TIME ZONE ${AI_QUOTA_TIME_ZONE}) AS "resetAt"`);
  return windows[0];
}
