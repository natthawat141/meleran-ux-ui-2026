import { Prisma } from '@prisma/client';

export interface SnapshotGrade {
  maxScore: Prisma.Decimal;
  score: Prisma.Decimal | null;
}
export interface SubmittedScore {
  score: Prisma.Decimal;
  maxScore: Prisma.Decimal;
  status: 'pending_review' | 'graded';
  passed: boolean | null;
}

// Local constructor only: never change Prisma's process-wide Decimal settings.
// Extra precision retains PostgreSQL Decimal(65,30) values and aggregate sums.
const ExactDecimal = Prisma.Decimal.clone({ precision: 100 });

/** Calculate one already-submitted, fully answered attempt from trusted locked
 * snapshot/grade rows. The orchestration service owns answer completeness,
 * authorization, grading provenance and transaction persistence. This helper
 * neither selects the best attempt across versions (D06) nor writes Progress.
 */
export function summarizeSubmittedScores(grades: readonly SnapshotGrade[]): SubmittedScore {
  if (grades.length === 0) throw new Error('Missing attempt question snapshot');
  let score = new ExactDecimal(0), maxScore = new ExactDecimal(0), pending = false;
  for (const grade of grades) {
    const max = new ExactDecimal(grade.maxScore);
    if (!max.isFinite() || max.isNegative()) throw new Error('Invalid snapshot maximum');
    maxScore = maxScore.plus(max);
    if (grade.score === null) { pending = true; continue; }
    const earned = new ExactDecimal(grade.score);
    if (!earned.isFinite() || earned.isNegative() || earned.gt(max)) throw new Error('Invalid snapshot grade');
    score = score.plus(earned);
  }
  return { score, maxScore, status: pending ? 'pending_review' : 'graded',
    passed: pending ? null : maxScore.gt(0) && score.times(10).gt(maxScore.times(7)) };
}
