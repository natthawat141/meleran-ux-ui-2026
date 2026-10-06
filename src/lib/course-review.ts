import type { Course, CourseReviewEvent, Quiz, Role, User } from '../types';

export function canEditCourse(user: { id: string; role: Role } | null, course: Course): boolean {
  return Boolean(user && (user.role === 'admin' || (user.role === 'instructor' && course.instructorId === user.id)));
}

export function canSubmitCourse(user: { id: string; role: Role } | null, course: Course): boolean {
  return Boolean(user && course.status === 'draft' && (user.role === 'admin' || (user.role === 'instructor' && course.instructorId === user.id)));
}

export function canReviewCourse(user: { role: Role } | null, course: Course): boolean {
  return Boolean(user?.role === 'admin' && course.status === 'pending_review');
}

export function canPublishCourse(user: { id: string; role: Role } | null, course: Course): boolean {
  return Boolean(
    course.status === 'approved' &&
      user &&
      (user.role === 'admin' || (user.role === 'instructor' && course.instructorId === user.id))
  );
}

export function coursePublicationIssue(course: Course, users: User[], quizzes: Quiz[]): string | null {
  if (!course.title.trim()) return 'กรอกชื่อคอร์สก่อนส่งตรวจหรือเผยแพร่';
  if (!users.some((user) => user.id === course.instructorId && user.role === 'instructor')) return 'กำหนดผู้สอนที่ใช้งานได้ก่อนส่งตรวจหรือเผยแพร่';
  if (!course.chapters.some((chapter) => chapter.items.length > 0)) return 'เพิ่มเนื้อหาอย่างน้อยหนึ่งรายการก่อนส่งตรวจหรือเผยแพร่';
  const courseQuizIds = new Set(course.chapters.flatMap((chapter) => chapter.items.flatMap((item) => item.type === 'quiz' ? [item.quizId] : [])));
  if ([...courseQuizIds].some((quizId) => !quizzes.some((quiz) => quiz.id === quizId && quiz.courseId === course.id))) return 'แบบทดสอบในบทเรียนต้องอ้างอิงคอร์สนี้และมีข้อมูลครบ';
  if (quizzes.some((quiz) => courseQuizIds.has(quiz.id) && quiz.questions.length === 0)) return 'เติมคำถามในแบบทดสอบก่อนส่งตรวจหรือเผยแพร่';
  return null;
}

export function invalidateCourseReview(course: Course, actorId: string, at: string): Course {
  if (course.status !== 'approved' && course.status !== 'pending_review') return course;
  const event: CourseReviewEvent = { action: 'approval_invalidated', actorId, at };
  return { ...course, status: 'draft', reviewHistory: [...(course.reviewHistory ?? []), event] };
}
