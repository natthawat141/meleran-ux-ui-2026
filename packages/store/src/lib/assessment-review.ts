import type {
  Course,
  LmsData,
  Question,
  Quiz,
  QuizAttempt,
  Role,
  User,
} from '../types';

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

/** Returns pending written or image answers, ordered oldest first. */
export function getReviewQueue(data: LmsData, options: ReviewQueueOptions = {}): ReviewQueueItem[] {
  const { courseId, quizId, responseMode } = options;
  const instructorId = options.instructorId?.trim();
  if (options.role !== 'instructor' || !instructorId) return [];

  const courses = data.courses || [];
  const quizzes = data.quizzes || [];
  const attempts = data.attempts || [];
  const users = data.users || [];

  const ownedCourses = courses.filter((course) => course.instructorId === instructorId);
  const ownedCoursesById = new Map(ownedCourses.map((course) => [course.id, course]));
  const quizzesById = new Map(quizzes.map((quiz) => [quiz.id, quiz]));

  const filtered = attempts.filter((attempt) => {
    if (attempt.status !== 'submitted') return false;
    if (attempt.essayStatus !== 'pending') return false;
    const course = ownedCoursesById.get(attempt.courseId);
    const quiz = quizzesById.get(attempt.quizId);
    if (!course || !quiz || quiz.courseId !== course.id) return false;
    if (courseId && attempt.courseId !== courseId) return false;
    if (quizId && attempt.quizId !== quizId) return false;
    return true;
  });

  const enriched: ReviewQueueItem[] = filtered.map((attempt) => {
    const course = courses.find((item) => item.id === attempt.courseId);
    const quiz = quizzes.find((item) => item.id === attempt.quizId);
    const learner = users.find((item) => item.id === attempt.userId);
    const essayQuestions = (quiz?.questions || []).filter((question) => question.type === 'essay');

    let mode: 'text' | 'image' = 'text';
    const hasImage = Object.values(attempt.answers || {}).some((answer: unknown) => {
      if (typeof answer === 'object' && answer !== null) {
        const answerObject = answer as { image?: string; images?: unknown[] };
        if (answerObject.image || (Array.isArray(answerObject.images) && answerObject.images.length > 0)) {
          return true;
        }
      }
      return typeof answer === 'string' && answer.startsWith('data:image');
    });
    if (hasImage) mode = 'image';

    const submittedDate = attempt.submittedAt ? new Date(attempt.submittedAt) : new Date();
    const ageDays = Math.max(0, Math.floor((Date.now() - submittedDate.getTime()) / (1000 * 60 * 60 * 24)));
    const ageHours = Math.max(0, Math.floor((Date.now() - submittedDate.getTime()) / (1000 * 60 * 60)));

    let ageText = 'เพิ่งส่งมา';
    if (ageDays >= 1) ageText = `${ageDays} วันที่แล้ว`;
    else if (ageHours >= 1) ageText = `${ageHours} ชั่วโมงที่แล้ว`;

    return {
      ...attempt,
      course,
      quiz,
      learner,
      essayQuestions,
      mode,
      ageDays,
      ageText,
    };
  });

  const filteredByMode =
    responseMode && responseMode !== 'all' ? enriched.filter((item) => item.mode === responseMode) : enriched;

  return filteredByMode.sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());
}
