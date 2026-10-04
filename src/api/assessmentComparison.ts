export interface AssessmentAttemptLike {
  id: string;
  courseId: string;
  quizId: string;
  userId: string;
  status: string;
  submittedAt?: string | null;
  essayStatus?: string | null;
  finalPercent?: number | null;
  percent?: number | null;
  passed?: boolean | null;
}

export interface AssessmentEnrollmentLike {
  courseId: string;
  userId: string;
}

export interface PairedAssessmentRow<TAttempt extends AssessmentAttemptLike> {
  learnerId: string;
  preAttempt?: TAttempt;
  postAttempt?: TAttempt;
  preScore: number | null;
  postScore: number | null;
  diff: number | null;
  status: 'matched' | 'pending_grading' | 'missing' | 'pre_only' | 'post_only' | 'neither';
}

export function getFinalScorePercent<TAttempt extends AssessmentAttemptLike>(attempt?: TAttempt | null): number | null {
  if (!attempt || attempt.essayStatus === 'pending') return null;
  if (typeof attempt.finalPercent === 'number' && Number.isFinite(attempt.finalPercent)) return attempt.finalPercent;
  if (typeof attempt.percent === 'number' && Number.isFinite(attempt.percent)) return attempt.percent;
  return null;
}

export function firstSubmittedAttempt<TAttempt extends AssessmentAttemptLike>(attempts: readonly TAttempt[]): TAttempt | undefined {
  return attempts
    .filter((attempt) => attempt.status === 'submitted')
    .slice()
    .sort((left, right) => {
      const leftDate = left.submittedAt ? Date.parse(left.submittedAt) : Number.NEGATIVE_INFINITY;
      const rightDate = right.submittedAt ? Date.parse(right.submittedAt) : Number.NEGATIVE_INFINITY;
      const safeLeft = Number.isFinite(leftDate) ? leftDate : Number.NEGATIVE_INFINITY;
      const safeRight = Number.isFinite(rightDate) ? rightDate : Number.NEGATIVE_INFINITY;
      return safeLeft - safeRight || left.id.localeCompare(right.id);
    })[0];
}

export function buildPairedAssessmentRows<TAttempt extends AssessmentAttemptLike>(args: {
  courseId: string;
  preQuizId: string;
  postQuizId: string;
  enrollments: readonly AssessmentEnrollmentLike[];
  attempts: readonly TAttempt[];
}): PairedAssessmentRow<TAttempt>[] {
  const scopedEnrollments = args.enrollments.filter((row) => row.courseId === args.courseId);
  const scopedAttempts = args.attempts.filter((row) => row.courseId === args.courseId && row.status === 'submitted');
  const learnerIds = [...new Set(scopedEnrollments.map((row) => row.userId))];

  return learnerIds.map((learnerId) => {
    const preAttempt = firstSubmittedAttempt(scopedAttempts.filter((row) => row.userId === learnerId && row.quizId === args.preQuizId));
    const postAttempt = firstSubmittedAttempt(scopedAttempts.filter((row) => row.userId === learnerId && row.quizId === args.postQuizId));
    const preScore = getFinalScorePercent(preAttempt);
    const postScore = getFinalScorePercent(postAttempt);
    let status: PairedAssessmentRow<TAttempt>['status'];
    let diff: number | null = null;

    if (preAttempt && postAttempt) {
      if (preAttempt.essayStatus === 'pending' || postAttempt.essayStatus === 'pending') status = 'pending_grading';
      else if (preScore === null || postScore === null) status = 'missing';
      else {
        status = 'matched';
        diff = Math.round((postScore - preScore) * 10) / 10;
      }
    } else if (preAttempt) status = 'pre_only';
    else if (postAttempt) status = 'post_only';
    else status = 'neither';

    return { learnerId, preAttempt, postAttempt, preScore, postScore, diff, status };
  });
}

export function average(values: readonly (number | null | undefined)[]): number | null {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (valid.length === 0) return null;
  return valid.reduce((total, value) => total + value, 0) / valid.length;
}

export function median(values: readonly (number | null | undefined)[]): number | null {
  const sorted = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)).slice().sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
