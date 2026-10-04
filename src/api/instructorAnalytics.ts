import { average, buildPairedAssessmentRows, firstSubmittedAttempt, getFinalScorePercent, median } from './assessmentComparison';
import type { AssessmentAttemptLike, AssessmentEnrollmentLike } from './assessmentComparison';

export interface InstructorUser { id: string; name: string; email?: string; role?: string; avatar?: string }
export interface InstructorQuestion {
  id: string; type: 'choice' | 'essay' | string; prompt?: string; options?: string[]; answer?: number; points?: number;
  responseMode?: 'text' | 'image' | 'either';
}
export interface InstructorQuiz { id: string; courseId: string; title: string; assessmentStage?: string; passPercent?: number; questions?: InstructorQuestion[] }
export interface InstructorCourseItem { id: string; type: string; quizId?: string; title?: string }
export interface InstructorCourse { id: string; title: string; instructorId: string; cover?: string; status?: string; price?: number; chapters?: { items?: InstructorCourseItem[] }[] }
export interface InstructorEnrollment extends AssessmentEnrollmentLike { id?: string; createdAt?: string }
export interface InstructorAttempt extends AssessmentAttemptLike {
  answers?: Record<string, unknown>; essayFeedback?: string; essayScore?: number; score?: number; maxChoice?: number;
  totalScore?: number; maxScore?: number; passed?: boolean | null; gradedAt?: string;
}
export interface InstructorComparisonSet { id: string; courseId: string; title: string; preQuizId: string; postQuizId: string }
export interface InstructorAnalyticsData {
  users: InstructorUser[]; courses: InstructorCourse[]; quizzes: InstructorQuiz[];
  enrollments: InstructorEnrollment[]; attempts: InstructorAttempt[];
  comparisonSets?: InstructorComparisonSet[]; progress?: Record<string, Record<string, boolean>>;
}

export interface InstructorScope {
  courses: InstructorCourse[]; courseIds: Set<string>; enrollments: InstructorEnrollment[];
  quizzes: InstructorQuiz[]; attempts: InstructorAttempt[]; users: InstructorUser[];
  progress?: Record<string, Record<string, boolean>>;
}

export function scopeInstructorData(data: InstructorAnalyticsData, instructorId: string): InstructorScope {
  const courses = data.courses.filter((course) => course.instructorId === instructorId);
  const courseIds = new Set(courses.map((course) => course.id));
  const enrollments = data.enrollments.filter((enrollment) => courseIds.has(enrollment.courseId));
  const quizzes = data.quizzes.filter((quiz) => courseIds.has(quiz.courseId));
  const enrolledPairs = new Set(enrollments.map((enrollment) => `${enrollment.courseId}\u0000${enrollment.userId}`));
  const quizzesById = new Map(quizzes.map((quiz) => [quiz.id, quiz]));
  const attempts = data.attempts.filter((attempt) => {
    const quiz = quizzesById.get(attempt.quizId);
    return courseIds.has(attempt.courseId) && quiz?.courseId === attempt.courseId && enrolledPairs.has(`${attempt.courseId}\u0000${attempt.userId}`);
  });
  const learnerIds = new Set(enrollments.map((enrollment) => enrollment.userId));
  return { courses, courseIds, enrollments, quizzes, attempts, users: data.users.filter((user) => learnerIds.has(user.id)), progress: data.progress };
}

export function validateInstructorCourse(scope: InstructorScope, courseId: string | null): InstructorCourse | null {
  if (!courseId) return null;
  return scope.courses.find((course) => course.id === courseId) ?? null;
}

export function safeComparisonSet(data: InstructorAnalyticsData, scope: InstructorScope, courseId: string, comparisonSetId?: string): InstructorComparisonSet | null {
  const set = (data.comparisonSets ?? []).find((candidate) => candidate.id === comparisonSetId && candidate.courseId === courseId);
  if (!set || !scope.courseIds.has(set.courseId)) return null;
  const pre = scope.quizzes.find((quiz) => quiz.id === set.preQuizId && quiz.courseId === courseId);
  const post = scope.quizzes.find((quiz) => quiz.id === set.postQuizId && quiz.courseId === courseId);
  return pre && post ? set : null;
}

function courseItems(course: InstructorCourse) { return (course.chapters ?? []).flatMap((chapter) => chapter.items ?? []); }
function firstAttempts(attempts: InstructorAttempt[]) {
  const groups = new Map<string, InstructorAttempt[]>();
  for (const attempt of attempts) {
    if (attempt.status !== 'submitted') continue;
    const key = `${attempt.quizId}\u0000${attempt.userId}`;
    groups.set(key, [...(groups.get(key) ?? []), attempt]);
  }
  return [...groups.values()].map((group) => firstSubmittedAttempt(group)).filter((attempt): attempt is InstructorAttempt => Boolean(attempt));
}

export interface CourseOverviewRow {
  course: InstructorCourse; enrolled: number; completed: number; completionRate: number;
  submitted: number; pending: number; scored: number; passRate: number | null;
}
export function getInstructorOverview(data: InstructorAnalyticsData, scope: InstructorScope) {
  const courseRows: CourseOverviewRow[] = scope.courses.map((course) => {
    const enrollments = [...new Map(scope.enrollments.filter((row) => row.courseId === course.id).map((row) => [row.userId, row])).values()];
    const items = courseItems(course);
    const quizIds = new Set(scope.quizzes.filter((quiz) => quiz.courseId === course.id).map((quiz) => quiz.id));
    const attempts = scope.attempts.filter((attempt) => attempt.courseId === course.id && quizIds.has(attempt.quizId));
    const completed = enrollments.filter((enrollment) => items.length > 0 && items.every((item) => item.type === 'quiz'
      ? attempts.some((attempt) => attempt.status === 'submitted' && attempt.quizId === item.quizId && attempt.userId === enrollment.userId && attempt.passed === true)
      : Boolean(data.progress?.[`${course.id}:${item.id}`]?.[enrollment.userId]))).length;
    const selected = firstAttempts(attempts);
    const valid = selected.filter((attempt) => getFinalScorePercent(attempt) !== null);
    const passed = valid.filter((attempt) => attempt.passed === true).length;
    return { course, enrolled: enrollments.length, completed, completionRate: enrollments.length ? Math.round(completed / enrollments.length * 100) : 0,
      submitted: attempts.filter((attempt) => attempt.status === 'submitted').length,
      pending: attempts.filter((attempt) => attempt.status === 'submitted' && attempt.essayStatus === 'pending').length,
      scored: valid.length, passRate: valid.length ? Math.round(passed / valid.length * 100) : null };
  });
  const uniqueLearners = new Set(scope.enrollments.map((row) => row.userId));
  const pendingAttempts = scope.attempts.filter((attempt) => attempt.status === 'submitted' && attempt.essayStatus === 'pending');
  return { courseRows, learnerCount: uniqueLearners.size, enrollmentCount: scope.enrollments.length,
    completedCount: courseRows.reduce((sum, row) => sum + row.completed, 0), pendingAttempts };
}

export function getAssessmentSummaries(scope: InstructorScope, courseId: string | 'all') {
  const quizzes = scope.quizzes.filter((quiz) => courseId === 'all' || quiz.courseId === courseId);
  return quizzes.map((quiz) => {
    const enrollments = [...new Map(scope.enrollments.filter((row) => row.courseId === quiz.courseId).map((row) => [row.userId, row])).values()];
    const attempts = scope.attempts.filter((attempt) => attempt.courseId === quiz.courseId && attempt.quizId === quiz.id && attempt.status === 'submitted');
    const selected = enrollments.map((row) => firstSubmittedAttempt(attempts.filter((attempt) => attempt.userId === row.userId))).filter((attempt): attempt is InstructorAttempt => Boolean(attempt));
    const pendingCount = selected.filter((attempt) => attempt.essayStatus === 'pending').length;
    const scored = selected.map(getFinalScorePercent).filter((score): score is number => score !== null);
    const passed = selected.filter((attempt) => getFinalScorePercent(attempt) !== null && attempt.passed === true).length;
    return { quiz, stage: quiz.assessmentStage ?? 'practice', submitters: selected.length, pendingCount, validN: scored.length,
      average: average(scored), median: median(scored), passRate: scored.length ? passed / scored.length * 100 : null,
      choices: (quiz.questions ?? []).filter((question) => question.type === 'choice').map((question) => {
        let correct = 0, incorrect = 0, skipped = 0;
        for (const attempt of selected) {
          const answer = attempt.answers?.[question.id];
          if (typeof answer !== 'number' || !Number.isInteger(answer) || answer < 0 || answer >= (question.options?.length ?? 0)) skipped++;
          else if (answer === question.answer) correct++;
          else incorrect++;
        }
        const answered = correct + incorrect;
        return { question, correct, incorrect, skipped, answered, accuracy: answered ? correct / answered * 100 : null };
      }) };
  });
}

export function getInstructorLearners(scope: InstructorScope, courseId: string | 'all') {
  const filteredEnrollments = [...new Map(scope.enrollments
    .filter((row) => courseId === 'all' || row.courseId === courseId)
    .map((row) => [`${row.courseId}\u0000${row.userId}`, row])).values()];
  const unique = new Map<string, InstructorEnrollment[]>();
  for (const enrollment of filteredEnrollments) unique.set(enrollment.userId, [...(unique.get(enrollment.userId) ?? []), enrollment]);
  return [...unique.entries()].map(([learnerId, enrollments]) => {
    const scopedCourseIds = new Set(enrollments.map((row) => row.courseId));
    const attempts = scope.attempts.filter((attempt) => attempt.userId === learnerId && scopedCourseIds.has(attempt.courseId) && attempt.status === 'submitted');
    const latest = attempts.filter((attempt) => getFinalScorePercent(attempt) !== null)
      .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? '') || b.id.localeCompare(a.id))[0];
    const progressByCourse = enrollments.map((enrollment) => {
      const course = scope.courses.find((entry) => entry.id === enrollment.courseId);
      const items = course ? courseItems(course) : [];
      const done = items.filter((item) => item.type === 'quiz'
        ? attempts.some((attempt) => attempt.status === 'submitted' && attempt.courseId === enrollment.courseId && attempt.quizId === item.quizId && attempt.passed === true)
        : Boolean(scope.progress?.[`${enrollment.courseId}:${item.id}`]?.[learnerId])).length;
      return { courseId: enrollment.courseId, percent: items.length ? Math.round(done / items.length * 100) : null };
    });
    return { learner: scope.users.find((user) => user.id === learnerId), learnerId, enrollments, progressByCourse,
      latestAttempt: latest, latestScore: getFinalScorePercent(latest), attemptHistory: attempts };
  }).filter((row) => row.learner);
}

export function getInstructorPair(scope: InstructorScope, set: InstructorComparisonSet) {
  const courseEnrollments = scope.enrollments.filter((row) => row.courseId === set.courseId);
  const rows = buildPairedAssessmentRows({ courseId: set.courseId, preQuizId: set.preQuizId, postQuizId: set.postQuizId,
    enrollments: courseEnrollments, attempts: scope.attempts });
  const matched = rows.filter((row) => row.status === 'matched');
  return { rows, totalEnrolled: new Set(courseEnrollments.map((row) => row.userId)).size,
    matchedN: matched.length, pendingCount: rows.filter((row) => row.status === 'pending_grading').length,
    unmatchedCount: rows.filter((row) => row.status !== 'matched' && row.status !== 'pending_grading').length,
    preAverage: average(matched.map((row) => row.preScore)), postAverage: average(matched.map((row) => row.postScore)),
    averageGain: average(matched.map((row) => row.diff)) };
}

export function stageLabel(stage: string) {
  if (stage === 'pre_test') return 'ก่อนเรียน';
  if (stage === 'post_test') return 'หลังเรียน';
  return 'ฝึกระหว่างเรียน';
}
