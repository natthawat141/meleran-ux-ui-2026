/**
 * Central Read-Model and Selectors for Learner Analytics, Reviews Queue, and Pre/Post Assessment
 * Follows LEARNER-ANALYTICS-UI-SPEC.md strictly:
 * - Single source of truth for formulas and metrics
 * - Paired difference calculated on matched n only
 * - Pending essay excluded from final score calculations
 */

import type {
  ComparisonSet,
  Course,
  Enrollment,
  LmsData,
  Question,
  Quiz,
  QuizAttempt,
  Role,
  User,
} from '../types';

export function calculateAverage(numbers: (number | null | undefined)[]): number {
  if (!numbers || !numbers.length) return 0;
  const valid = numbers.filter((n): n is number => typeof n === 'number' && !Number.isNaN(n));
  if (!valid.length) return 0;
  const sum = valid.reduce((acc, curr) => acc + curr, 0);
  return Math.round((sum / valid.length) * 10) / 10;
}

export function calculateMedian(numbers: (number | null | undefined)[]): number {
  if (!numbers || !numbers.length) return 0;
  const valid = numbers.filter((n): n is number => typeof n === 'number' && !Number.isNaN(n));
  if (!valid.length) return 0;
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) return sorted[mid];
  return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
}

export function getFinalScorePercent(attempt?: QuizAttempt | null): number | null {
  if (!attempt) return null;
  if (attempt.essayStatus === 'pending') return null; // Pending items have no final score yet
  if (typeof attempt.finalPercent === 'number') return attempt.finalPercent;
  if (typeof attempt.percent === 'number') return attempt.percent;
  return null;
}

export interface ReviewQueueOptions {
  instructorId?: string;
  role?: Role;
  courseId?: string;
  quizId?: string;
  responseMode?: 'all' | 'text' | 'image' | string;
}

export interface ReviewQueueItem extends QuizAttempt {
  course?: Course;
  quiz?: Quiz;
  learner?: User;
  essayQuestions: Question[];
  mode: 'text' | 'image';
  ageDays: number;
  ageText: string;
}

/**
 * Filter review queue items with pending essays/images
 */
export function getReviewQueue(data: LmsData, options: ReviewQueueOptions = {}): ReviewQueueItem[] {
  const { instructorId, role, courseId, quizId, responseMode } = options;
  const courses = data.courses || [];
  const quizzes = data.quizzes || [];
  const attempts = data.attempts || [];
  const users = data.users || [];

  // Scoping: instructor sees only their courses, admin sees all
  const allowedCourseIds = courses
    .filter((c) => role === 'admin' || !instructorId || c.instructorId === instructorId)
    .map((c) => c.id);

  const filtered = attempts.filter((att) => {
    if (att.status !== 'submitted') return false;
    if (att.essayStatus !== 'pending') return false;
    if (!allowedCourseIds.includes(att.courseId)) return false;
    if (courseId && att.courseId !== courseId) return false;
    if (quizId && att.quizId !== quizId) return false;
    return true;
  });

  const enriched: ReviewQueueItem[] = filtered.map((att) => {
    const course = courses.find((c) => c.id === att.courseId);
    const quiz = quizzes.find((q) => q.id === att.quizId);
    const learner = users.find((u) => u.id === att.userId);
    const essayQuestions = (quiz?.questions || []).filter((q) => q.type === 'essay');

    // Determine submission mode based on answers
    let mode: 'text' | 'image' = 'text';
    const hasImage = Object.values(att.answers || {}).some(
      (ans: unknown) => {
        if (typeof ans === 'object' && ans !== null) {
          const answerObj = ans as { image?: string; images?: unknown[] };
          if (answerObj.image || (Array.isArray(answerObj.images) && answerObj.images.length > 0)) {
            return true;
          }
        }
        return typeof ans === 'string' && ans.startsWith('data:image');
      }
    );
    if (hasImage) mode = 'image';

    const submittedDate = att.submittedAt ? new Date(att.submittedAt) : new Date();
    const ageDays = Math.max(0, Math.floor((Date.now() - submittedDate.getTime()) / (1000 * 60 * 60 * 24)));
    const ageHours = Math.max(0, Math.floor((Date.now() - submittedDate.getTime()) / (1000 * 60 * 60)));

    let ageText = 'เพิ่งส่งมา';
    if (ageDays >= 1) ageText = `${ageDays} วันที่แล้ว`;
    else if (ageHours >= 1) ageText = `${ageHours} ชั่วโมงที่แล้ว`;

    return {
      ...att,
      course,
      quiz,
      learner,
      essayQuestions,
      mode,
      ageDays,
      ageText,
    };
  });

  // Filter by responseMode if specified
  if (responseMode && responseMode !== 'all') {
    return enriched.filter((item) => item.mode === responseMode);
  }

  // Sort oldest first (FIFO for grading queue)
  return enriched.sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());
}

export interface CourseAnalyticsRow {
  courseId: string;
  title: string;
  cover: string;
  instructorId: string;
  instructorName: string;
  enrolledCount: number;
  completedCount: number;
  completionRate: number;
  submissionsCount: number;
  pendingCount: number;
  passRate: number;
}

export interface InstructorAnalyticsResult {
  totalEnrolled: number;
  totalCompleted: number;
  totalSubmissions: number;
  totalPendingReview: number;
  oldestPending: ReviewQueueItem[];
  courseRows: CourseAnalyticsRow[];
}

/**
 * Overview analytics for an instructor or admin
 */
export function getInstructorAnalytics(
  data: LmsData,
  instructorId?: string,
  role: Role = 'instructor'
): InstructorAnalyticsResult {
  const courses = data.courses || [];
  const enrollments = data.enrollments || [];
  const attempts = data.attempts || [];

  const targetCourses = courses.filter((c) => role === 'admin' || !instructorId || c.instructorId === instructorId);
  const targetCourseIds = targetCourses.map((c) => c.id);

  // Distinct enrolled learners in these courses
  const targetEnrollments = enrollments.filter((e) => targetCourseIds.includes(e.courseId));
  const distinctLearnerIds = [...new Set(targetEnrollments.map((e) => e.userId))];

  // Pending review attempts
  const pendingAttempts = attempts.filter(
    (att) => targetCourseIds.includes(att.courseId) && att.status === 'submitted' && att.essayStatus === 'pending'
  );

  // Submissions count
  const submittedAttempts = attempts.filter(
    (att) => targetCourseIds.includes(att.courseId) && att.status === 'submitted'
  );

  // Completed learners: learner who completed curriculum items in target courses
  let completedCount = 0;
  distinctLearnerIds.forEach((learnerId) => {
    const hasCompletedCourse = targetCourses.some((course) => {
      const items = (course.chapters || []).flatMap((ch) => ch.items || []);
      if (!items.length) return false;
      const isEnrolled = enrollments.some((e) => e.courseId === course.id && e.userId === learnerId);
      if (!isEnrolled) return false;
      return items.every((item) => {
        if (item.type === 'quiz') {
          return attempts.some((att) => att.quizId === item.quizId && att.userId === learnerId && att.passed === true);
        }
        return Boolean(data.progress?.[`${course.id}:${item.id}`]?.[learnerId]);
      });
    });
    if (hasCompletedCourse) completedCount += 1;
  });

  // Oldest pending review items (needs attention)
  const oldestPending = getReviewQueue(data, { instructorId, role }).slice(0, 5);

  // Course breakdown
  const courseRows: CourseAnalyticsRow[] = targetCourses.map((course) => {
    const courseEnrollments = enrollments.filter((e) => e.courseId === course.id);
    const courseAttempts = attempts.filter((att) => att.courseId === course.id && att.status === 'submitted');
    const coursePending = courseAttempts.filter((att) => att.essayStatus === 'pending');
    const gradedAttempts = courseAttempts.filter((att) => att.essayStatus !== 'pending' && typeof att.passed === 'boolean');
    const passedAttempts = gradedAttempts.filter((att) => att.passed);

    const items = (course.chapters || []).flatMap((ch) => ch.items || []);
    let courseCompletedLearners = 0;
    courseEnrollments.forEach((e) => {
      const isComplete =
        items.length > 0 &&
        items.every((item) => {
          if (item.type === 'quiz') {
            return attempts.some((att) => att.quizId === item.quizId && att.userId === e.userId && att.passed === true);
          }
          return Boolean(data.progress?.[`${course.id}:${item.id}`]?.[e.userId]);
        });
      if (isComplete) courseCompletedLearners += 1;
    });

    const completionRate = courseEnrollments.length
      ? Math.round((courseCompletedLearners / courseEnrollments.length) * 100)
      : 0;

    const passRate = gradedAttempts.length
      ? Math.round((passedAttempts.length / gradedAttempts.length) * 100)
      : 0;

    return {
      courseId: course.id,
      title: course.title,
      cover: course.cover,
      instructorId: course.instructorId,
      instructorName: data.users?.find((u) => u.id === course.instructorId)?.name || 'ผู้สอน',
      enrolledCount: courseEnrollments.length,
      completedCount: courseCompletedLearners,
      completionRate,
      submissionsCount: courseAttempts.length,
      pendingCount: coursePending.length,
      passRate,
    };
  });

  return {
    totalEnrolled: distinctLearnerIds.length,
    totalCompleted: completedCount,
    totalSubmissions: submittedAttempts.length,
    totalPendingReview: pendingAttempts.length,
    oldestPending,
    courseRows,
  };
}

export interface LearnerAnalyticsRow {
  learnerId: string;
  learner?: User;
  enrollment: Enrollment;
  progressPercent: number;
  completedItems: number;
  totalItems: number;
  submissionsCount: number;
  pendingReviews: number;
  latestScore: number | null;
  status: 'not_started' | 'completed' | 'pending_review' | 'in_progress';
  lastActivity: string | null;
}

export interface AssessmentSummaryRow {
  quizId: string;
  title: string;
  stage: string;
  submittedCount: number;
  eligibleCount: number;
  pendingCount: number;
  avgScore: number;
  medScore: number;
  passRate: number;
  validN: number;
}

export interface CourseAnalyticsResult {
  course: Course;
  enrolledCount: number;
  activeCount: number;
  completedCount: number;
  completionRate: number;
  pendingCount: number;
  avgScore: number;
  medianScore: number;
  assessmentRows: AssessmentSummaryRow[];
  learnerRows: LearnerAnalyticsRow[];
}

/**
 * Course detailed analytics
 */
export function getCourseAnalytics(data: LmsData, courseId: string): CourseAnalyticsResult | null {
  const course = (data.courses || []).find((c) => c.id === courseId);
  if (!course) return null;

  const enrollments = (data.enrollments || []).filter((e) => e.courseId === courseId);
  const attempts = (data.attempts || []).filter((att) => att.courseId === courseId && att.status === 'submitted');
  const quizzes = (data.quizzes || []).filter((q) => q.courseId === courseId);
  const users = data.users || [];

  const enrolledCount = enrollments.length;
  const items = (course.chapters || []).flatMap((ch) => ch.items || []);

  // Completion calculation
  let completedCount = 0;
  let activeCount = 0;
  const learnerRows: LearnerAnalyticsRow[] = enrollments.map((enrollment) => {
    const learner = users.find((u) => u.id === enrollment.userId);
    const learnerAttempts = attempts.filter((att) => att.userId === enrollment.userId);
    const pendingReviews = learnerAttempts.filter((att) => att.essayStatus === 'pending').length;

    // Completed items
    const completedItems = items.filter((item) => {
      if (item.type === 'quiz') {
        return attempts.some((att) => att.quizId === item.quizId && att.userId === enrollment.userId && att.passed === true);
      }
      return Boolean(data.progress?.[`${courseId}:${item.id}`]?.[enrollment.userId]);
    }).length;

    const progressPercent = items.length ? Math.round((completedItems / items.length) * 100) : 0;
    if (progressPercent === 100) completedCount += 1;
    if (progressPercent > 0 || learnerAttempts.length > 0) activeCount += 1;

    // Latest score
    const validScores = learnerAttempts.map(getFinalScorePercent).filter((s): s is number => s !== null);
    const latestScore = validScores.length ? validScores[validScores.length - 1] : null;

    // Status
    let status: 'not_started' | 'completed' | 'pending_review' | 'in_progress' = 'not_started';
    if (progressPercent === 100) status = 'completed';
    else if (pendingReviews > 0) status = 'pending_review';
    else if (progressPercent > 0 || learnerAttempts.length > 0) status = 'in_progress';

    // Last activity timestamp
    const dates = [
      ...learnerAttempts.map((a) => a.submittedAt).filter((d): d is string => Boolean(d)),
      enrollment.createdAt,
    ].sort();
    const lastActivity = dates.length ? dates[dates.length - 1] : null;

    return {
      learnerId: enrollment.userId,
      learner,
      enrollment,
      progressPercent,
      completedItems,
      totalItems: items.length,
      submissionsCount: learnerAttempts.length,
      pendingReviews,
      latestScore,
      status,
      lastActivity,
    };
  });

  // Assessment summary table
  const assessmentRows: AssessmentSummaryRow[] = quizzes.map((quiz) => {
    const quizAttempts = attempts.filter((att) => att.quizId === quiz.id);
    const pendingCount = quizAttempts.filter((att) => att.essayStatus === 'pending').length;
    const gradedAttempts = quizAttempts.filter((att) => att.essayStatus !== 'pending');
    const validScores = gradedAttempts.map(getFinalScorePercent).filter((s): s is number => s !== null);
    const passedAttempts = gradedAttempts.filter((att) => att.passed === true);

    const avgScore = calculateAverage(validScores);
    const medScore = calculateMedian(validScores);
    const passRate = gradedAttempts.length ? Math.round((passedAttempts.length / gradedAttempts.length) * 100) : 0;

    return {
      quizId: quiz.id,
      title: quiz.title,
      stage: quiz.assessmentStage || (quiz.id.includes('pre') ? 'pre_test' : quiz.id.includes('post') ? 'post_test' : 'practice'),
      submittedCount: quizAttempts.length,
      eligibleCount: enrolledCount,
      pendingCount,
      avgScore,
      medScore,
      passRate,
      validN: validScores.length,
    };
  });

  // Course overview metrics
  const allValidScores = attempts.map(getFinalScorePercent).filter((s): s is number => s !== null);
  const completionRate = enrolledCount ? Math.round((completedCount / enrolledCount) * 100) : 0;
  const pendingCount = attempts.filter((att) => att.essayStatus === 'pending').length;

  return {
    course,
    enrolledCount,
    activeCount,
    completedCount,
    completionRate,
    pendingCount,
    avgScore: calculateAverage(allValidScores),
    medianScore: calculateMedian(allValidScores),
    assessmentRows,
    learnerRows,
  };
}

export interface LearnerTimelineEvent {
  type: 'enrolled' | 'submitted' | 'graded';
  title: string;
  date: string;
  desc: string;
}

export interface LearnerAssessmentRecord {
  attemptId: string;
  quizId: string;
  title: string;
  stage: string;
  score?: number;
  maxScore?: number;
  percent?: number;
  essayStatus: 'none' | 'pending' | 'graded';
  passed: boolean | null;
  submittedAt?: string;
  feedback?: string;
}

export interface LearnerCourseAnalyticsResult {
  course: Course;
  learner: User;
  enrollment?: Enrollment;
  progressPercent: number;
  completedItems: number;
  totalItems: number;
  pendingCount: number;
  timeline: LearnerTimelineEvent[];
  assessmentHistory: LearnerAssessmentRecord[];
}

/**
 * Learner drill-down inside a specific course
 */
export function getLearnerCourseAnalytics(
  data: LmsData,
  courseId: string,
  learnerId: string
): LearnerCourseAnalyticsResult | null {
  const course = (data.courses || []).find((c) => c.id === courseId);
  const learner = (data.users || []).find((u) => u.id === learnerId);
  if (!course || !learner) return null;

  const enrollment = (data.enrollments || []).find((e) => e.courseId === courseId && e.userId === learnerId);
  const attempts = (data.attempts || []).filter((a) => a.courseId === courseId && a.userId === learnerId);
  const quizzes = (data.quizzes || []).filter((q) => q.courseId === courseId);
  const items = (course.chapters || []).flatMap((ch) => ch.items || []);

  const completedItems = items.filter((item) => {
    if (item.type === 'quiz') {
      return attempts.some((att) => att.quizId === item.quizId && att.passed === true);
    }
    return Boolean(data.progress?.[`${courseId}:${item.id}`]?.[learnerId]);
  }).length;

  const progressPercent = items.length ? Math.round((completedItems / items.length) * 100) : 0;
  const pendingCount = attempts.filter((a) => a.essayStatus === 'pending').length;

  // Timeline events
  const timeline: LearnerTimelineEvent[] = [];
  if (enrollment?.createdAt) {
    timeline.push({
      type: 'enrolled',
      title: 'ลงทะเบียนเรียน',
      date: enrollment.createdAt,
      desc: `เริ่มเรียนคอร์ส ${course.title}`,
    });
  }

  attempts.forEach((att) => {
    const quiz = quizzes.find((q) => q.id === att.quizId);
    if (att.submittedAt) {
      timeline.push({
        type: 'submitted',
        title: `ส่งคำตอบ: ${quiz?.title || 'แบบฝึกหัด'}`,
        date: att.submittedAt,
        desc: att.essayStatus === 'pending' ? 'รอผู้สอนตรวจข้อเขียน' : `คะแนน ${att.finalPercent ?? att.percent}%`,
      });
    }
    if (att.gradedAt) {
      timeline.push({
        type: 'graded',
        title: `ผู้สอนตรวจเสร็จสิ้น: ${quiz?.title || 'แบบฝึกหัด'}`,
        date: att.gradedAt,
        desc: `คะแนนสุดท้าย ${att.finalPercent}%${att.essayFeedback ? ` · ข้อเสนอแนะ: "${att.essayFeedback}"` : ''}`,
      });
    }
  });

  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Assessments detail
  const assessmentHistory: LearnerAssessmentRecord[] = attempts.map((att) => {
    const quiz = quizzes.find((q) => q.id === att.quizId);
    return {
      attemptId: att.id,
      quizId: att.quizId,
      title: quiz?.title || 'แบบฝึกหัด',
      stage: quiz?.assessmentStage || (att.quizId.includes('pre') ? 'pre_test' : att.quizId.includes('post') ? 'post_test' : 'practice'),
      score: att.totalScore ?? att.score,
      maxScore: att.maxScore ?? att.maxChoice,
      percent: att.finalPercent ?? att.percent,
      essayStatus: att.essayStatus,
      passed: att.passed,
      submittedAt: att.submittedAt,
      feedback: att.essayFeedback,
    };
  });

  return {
    course,
    learner,
    enrollment,
    progressPercent,
    completedItems,
    totalItems: items.length,
    pendingCount,
    timeline,
    assessmentHistory,
  };
}

export interface PairedLearnerResult {
  learnerId: string;
  learner?: User;
  preScore: number | null;
  postScore: number | null;
  diff: number | null;
  status: 'matched' | 'pending_grading' | 'pre_only' | 'post_only' | 'neither' | 'missing';
  preAttempt?: QuizAttempt;
  postAttempt?: QuizAttempt;
}

export interface PrePostComparisonResult {
  set: ComparisonSet;
  preQuiz?: Quiz;
  postQuiz?: Quiz;
  totalEnrolled: number;
  matchedN: number;
  pendingCount: number;
  unmatchedCount: number;
  preAvg: number;
  postAvg: number;
  avgDiff: number;
  medianDiff: number;
  learnerResults: PairedLearnerResult[];
}

/**
 * Pre/Post Paired Analysis calculation
 */
export function getPrePostComparison(
  data: LmsData,
  courseId: string,
  comparisonSetId?: string
): PrePostComparisonResult | null {
  const comparisonSets = data.comparisonSets || [];
  const set = comparisonSets.find((cs) => cs.id === comparisonSetId || (cs.courseId === courseId && !comparisonSetId));
  if (!set) return null;

  const enrollments = (data.enrollments || []).filter((e) => e.courseId === courseId);
  const attempts = (data.attempts || []).filter((a) => a.courseId === courseId && a.status === 'submitted');
  const users = data.users || [];

  const preQuiz = (data.quizzes || []).find((q) => q.id === set.preQuizId);
  const postQuiz = (data.quizzes || []).find((q) => q.id === set.postQuizId);

  const learnerResults: PairedLearnerResult[] = enrollments.map((e) => {
    const learner = users.find((u) => u.id === e.userId);

    // Pick first submitted attempt per stage (sorted by submittedAt ascending)
    const learnerPreAttempts = attempts
      .filter((a) => a.quizId === set.preQuizId && a.userId === e.userId)
      .sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());
    const learnerPostAttempts = attempts
      .filter((a) => a.quizId === set.postQuizId && a.userId === e.userId)
      .sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());

    const preAttempt = learnerPreAttempts[0];
    const postAttempt = learnerPostAttempts[0];

    const preScore = getFinalScorePercent(preAttempt);
    const postScore = getFinalScorePercent(postAttempt);

    let status: 'matched' | 'pending_grading' | 'pre_only' | 'post_only' | 'neither' | 'missing' = 'missing';
    let diff: number | null = null;

    if (preAttempt && postAttempt) {
      if (preAttempt.essayStatus === 'pending' || postAttempt.essayStatus === 'pending') {
        status = 'pending_grading';
      } else if (preScore !== null && postScore !== null) {
        status = 'matched';
        diff = Math.round((postScore - preScore) * 10) / 10;
      }
    } else if (preAttempt && !postAttempt) {
      status = 'pre_only';
    } else if (!preAttempt && postAttempt) {
      status = 'post_only';
    } else {
      status = 'neither';
    }

    return {
      learnerId: e.userId,
      learner,
      preScore,
      postScore,
      diff,
      status,
      preAttempt,
      postAttempt,
    };
  });

  // Calculate paired aggregate on matched only
  const matched = learnerResults.filter((r) => r.status === 'matched');
  const preScores = matched.map((r) => r.preScore);
  const postScores = matched.map((r) => r.postScore);
  const diffs = matched.map((r) => r.diff);

  const matchedN = matched.length;
  const preAvg = calculateAverage(preScores);
  const postAvg = calculateAverage(postScores);
  const avgDiff = calculateAverage(diffs);
  const medianDiff = calculateMedian(diffs);

  const pendingCount = learnerResults.filter((r) => r.status === 'pending_grading').length;
  const unmatchedCount = learnerResults.filter((r) => r.status !== 'matched' && r.status !== 'pending_grading').length;

  return {
    set,
    preQuiz,
    postQuiz,
    totalEnrolled: enrollments.length,
    matchedN,
    pendingCount,
    unmatchedCount,
    preAvg,
    postAvg,
    avgDiff,
    medianDiff,
    learnerResults,
  };
}
