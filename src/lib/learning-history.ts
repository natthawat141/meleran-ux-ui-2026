import type { Assignment, Course, CourseItem, LmsData, QuizAttempt, User } from '../types';

type LearningData = Pick<LmsData, 'courses' | 'quizzes' | 'assignments' | 'attempts' | 'enrollments' | 'progress' | 'users'>;

export function canManageCourse(user: User | null, course: Course | undefined): boolean {
  return Boolean(course && user && (user.role === 'admin' || (user.role === 'instructor' && course.instructorId === user.id)));
}

export function assignmentIncludesLearner(assignment: Assignment, userId: string): boolean {
  return assignment.assigneeType === 'all_enrolled' || Boolean(assignment.assigneeIds?.includes(userId));
}

export function attemptMatchesAssignment(attempt: QuizAttempt, assignment: Assignment): boolean {
  // Older prototype attempts did not save assignmentId; retain their history.
  return attempt.quizId === assignment.quizId && (attempt.assignmentId ? attempt.assignmentId === assignment.id : assignmentIncludesLearner(assignment, attempt.userId));
}

export function assignmentHasHistory(data: Pick<LmsData, 'attempts'>, assignment: Assignment): boolean {
  return data.attempts.some((attempt) => attemptMatchesAssignment(attempt, assignment));
}

export function contentRemovalIssue(data: LearningData, user: User | null, courseId: string, items: CourseItem[]): string | null {
  const course = data.courses.find((entry) => entry.id === courseId);
  if (!canManageCourse(user, course)) return 'ไม่มีสิทธิ์ลบเนื้อหาในคอร์สนี้';
  const quizIds = items.flatMap((item) => 'quizId' in item && item.quizId ? [item.quizId] : []);
  if (items.some((item) => Object.values(data.progress[`${courseId}:${item.id}`] || {}).some(Boolean))) return 'เนื้อหานี้มีประวัติการเรียนแล้ว จึงลบไม่ได้';
  if (data.attempts.some((attempt) => quizIds.includes(attempt.quizId))) return 'แบบฝึกหัดนี้มีประวัติคำตอบแล้ว จึงลบไม่ได้';
  if ((data.assignments || []).some((assignment) => quizIds.includes(assignment.quizId))) return 'แบบฝึกหัดนี้ถูกมอบหมายแล้ว กรุณาจัดการงานมอบหมายก่อนลบ';
  return null;
}

export function assignmentSaveIssue(data: LearningData, user: User | null, values: Partial<Assignment>, assignmentId?: string): string | null {
  const course = data.courses.find((entry) => entry.id === values.courseId);
  const quiz = data.quizzes.find((entry) => entry.id === values.quizId && entry.courseId === values.courseId);
  if (!canManageCourse(user, course) || !quiz || !course?.chapters.some((chapter) => chapter.items.some((item) => 'quizId' in item && item.quizId === quiz.id))) return 'เลือกแบบฝึกหัดที่อยู่ในบทเรียนของคอร์สที่คุณจัดการได้';
  if (!values.title?.trim()) return 'กรอกชื่องานมอบหมาย';
  const existing = (data.assignments || []).find((entry) => entry.id === assignmentId);
  if (assignmentId && (!existing || existing.courseId !== course.id)) return 'ไม่พบงานมอบหมายในคอร์สนี้';
  if (existing && assignmentHasHistory(data, existing)) return 'งานนี้มีประวัติคำตอบแล้ว กรุณายกเลิกแทนการแก้ไข';
  if (values.assigneeType !== 'all_enrolled' && values.assigneeType !== 'specific') return 'เลือกประเภทผู้รับงาน';
  const recipientIds = values.assigneeType === 'all_enrolled' ? data.enrollments.filter((entry) => entry.courseId === course.id).map((entry) => entry.userId) : values.assigneeIds || [];
  if (!recipientIds.length || recipientIds.some((id) => !data.users.some((entry) => entry.id === id && entry.role === 'learner') || !data.enrollments.some((entry) => entry.courseId === course.id && entry.userId === id))) return 'ผู้รับทุกคนต้องเป็นผู้เรียนที่ลงทะเบียนในคอร์สนี้';
  return null;
}
