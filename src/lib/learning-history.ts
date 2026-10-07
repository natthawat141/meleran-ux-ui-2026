import type { Course, CourseItem, LmsData, User } from '../types';

type LearningData = Pick<LmsData, 'courses' | 'attempts' | 'progress'>;

export function canManageCourse(user: User | null, course: Course | undefined): boolean {
  return Boolean(course && user && (user.role === 'admin' || (user.role === 'instructor' && course.instructorId === user.id)));
}

export function contentRemovalIssue(data: LearningData, user: User | null, courseId: string, items: CourseItem[]): string | null {
  const course = data.courses.find((entry) => entry.id === courseId);
  if (!canManageCourse(user, course)) return 'ไม่มีสิทธิ์ลบเนื้อหาในคอร์สนี้';
  const quizIds = items.flatMap((item) => 'quizId' in item && item.quizId ? [item.quizId] : []);
  if (items.some((item) => Object.values(data.progress[`${courseId}:${item.id}`] || {}).some(Boolean))) {
    return 'เนื้อหานี้มีประวัติการเรียนแล้ว จึงลบไม่ได้';
  }
  if (data.attempts.some((attempt) => quizIds.includes(attempt.quizId))) {
    return 'แบบฝึกหัดนี้มีประวัติคำตอบแล้ว จึงลบไม่ได้';
  }
  return null;
}
