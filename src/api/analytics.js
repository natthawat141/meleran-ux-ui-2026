import { flattenItems } from '../data.js';

function isItemComplete(data, course, item, userId) {
  if (item.type === 'quiz') return data.attempts.some((attempt) => attempt.quizId === item.quizId && attempt.userId === userId && attempt.passed === true);
  return Boolean(data.progress[`${course.id}:${item.id}`]?.[userId]);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function buildAnalytics(data, scope, now = new Date()) {
  const { role, userId = scope.id } = scope;
  const courses = data.courses.filter((course) => role === 'admin' || course.instructorId === userId);
  const courseIds = new Set(courses.map((course) => course.id));
  const enrollments = data.enrollments.filter((entry) => courseIds.has(entry.courseId) && data.users.some((user) => user.id === entry.userId && user.role === 'learner'));
  const attempts = data.attempts.filter((attempt) => courseIds.has(attempt.courseId));
  const submitted = attempts.filter((attempt) => attempt.status === 'submitted');
  const evaluated = submitted.filter((attempt) => typeof attempt.passed === 'boolean');
  const pendingReviews = submitted.filter((attempt) => attempt.essayStatus === 'pending');
  const orders = data.orders.filter((order) => courseIds.has(order.courseId));

  const courseRows = courses.map((course) => {
    const courseEnrollments = enrollments.filter((entry) => entry.courseId === course.id);
    const courseAttempts = attempts.filter((entry) => entry.courseId === course.id);
    const courseSubmitted = courseAttempts.filter((entry) => entry.status === 'submitted');
    const courseEvaluated = courseSubmitted.filter((entry) => typeof entry.passed === 'boolean');
    const items = flattenItems(course);
    const progressValues = courseEnrollments.map((enrollment) => {
      const completeCount = items.filter((item) => isItemComplete(data, course, item, enrollment.userId)).length;
      return items.length ? Math.round((completeCount / items.length) * 100) : null;
    }).filter((value) => value !== null);
    const averageProgress = progressValues.length ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length) : null;
    return {
      id: course.id,
      title: course.title,
      instructorName: data.users.find((user) => user.id === course.instructorId)?.name ?? '—',
      learnerCount: courseEnrollments.length,
      averageProgress,
      itemCount: items.length,
      attemptCount: courseAttempts.length,
      submittedCount: courseSubmitted.length,
      pendingReviewCount: courseSubmitted.filter((attempt) => attempt.essayStatus === 'pending').length,
      passRate: courseEvaluated.length ? Math.round((courseEvaluated.filter((attempt) => attempt.passed).length / courseEvaluated.length) * 100) : null,
    };
  });

  const trend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = monthKey(date);
    return {
      key,
      month: new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit' }).format(date),
      enrollments: enrollments.filter((entry) => monthKey(new Date(entry.createdAt)) === key).length,
      submissions: submitted.filter((entry) => entry.submittedAt && monthKey(new Date(entry.submittedAt)) === key).length,
    };
  });

  return {
    courseRows,
    trend,
    totals: {
      learnerCount: new Set(enrollments.map((entry) => entry.userId)).size,
      enrollmentCount: enrollments.length,
      completedEnrollmentCount: courseRows.reduce((sum, course) => sum + enrollments.filter((entry) => entry.courseId === course.id && course.itemCount > 0 && isCourseComplete(data, entry, course.id)).length, 0),
      submittedCount: submitted.length,
      pendingReviewCount: pendingReviews.length,
      passRate: evaluated.length ? Math.round((evaluated.filter((attempt) => attempt.passed).length / evaluated.length) * 100) : null,
      simulatedPaidOrderCount: orders.filter((order) => order.status === 'paid').length,
      simulatedRevenue: orders.filter((order) => order.status === 'paid').reduce((sum, order) => sum + Number(order.amount || 0), 0),
    },
  };
}

function isCourseComplete(data, enrollment, courseId) {
  const course = data.courses.find((entry) => entry.id === courseId);
  const items = flattenItems(course);
  return items.length > 0 && items.every((item) => isItemComplete(data, course, item, enrollment.userId));
}
