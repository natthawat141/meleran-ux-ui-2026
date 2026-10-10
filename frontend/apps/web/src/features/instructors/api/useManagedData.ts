import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useAuthSession } from '../../auth/api/AuthSessionProvider';
import { resource, resourceList } from '../../../shared/api/resources';
import { userView, attemptView, enrollmentView, certificateView } from './management-view';
import { authoringForm } from '@melearn/course-authoring';
import type {
  ManagedCourseSummaryDto,
  AuthoringCourseDto,
  AdminUserSummaryDto,
  AdminUserDetailDto,
  ManagedAttemptDto,
  LearnerRosterDto,
  DashboardDto,
} from '@melearn/contracts';
const scope: string = 'instructor';
export function useManagedData(
  kind:
    'dashboard' | 'courses' | 'users' | 'instructors' | 'user' | 'roster' | 'attempts' | 'grade' | 'reviews',
) {
  const params = useParams();
  const { user } = useAuthSession();
  const cache = useQueryClient();
  const id = (x: string) => encodeURIComponent(x);
  const { data: r } = useSuspenseQuery({
    queryKey: [
      'instructor-data',
      user?.id,
      kind,
      params.courseId,
      params.id,
      params.quizId,
      params.attemptId,
    ],
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const courses =
        kind === 'users' ? [] : await resourceList<ManagedCourseSummaryDto>(scope + '/courses', signal);
      const users =
        scope === 'admin' && ['users', 'instructors', 'user'].includes(kind)
          ? await resourceList<AdminUserSummaryDto>('admin/users', signal)
          : [];
      const account =
        kind === 'user' && params.id
          ? await resource<AdminUserDetailDto>('admin/users/' + id(params.id), 'GET', undefined, signal)
          : null;
      const selectedAttempt =
        kind === 'grade' && params.attemptId
          ? await resource<ManagedAttemptDto>(
              'instructor/attempts/' + id(params.attemptId),
              'GET',
              undefined,
              signal,
            )
          : null;
      let courseId = params.courseId ?? selectedAttempt?.course_id;
      if (params.quizId && params.quizId !== 'new')
        courseId = (
          await resource<{ course_id: string }>(
            'managed-quizzes/' + id(params.quizId),
            'GET',
            undefined,
            signal,
          )
        ).course_id;
      const full = courseId
        ? await resource<AuthoringCourseDto>(
            'courses/' + id(courseId) + '/authoring',
            'GET',
            undefined,
            signal,
          )
        : null;
      const roster =
        kind === 'user' && params.id
          ? await resourceList<LearnerRosterDto>('admin/users/' + id(params.id) + '/enrollments', signal)
          : kind === 'roster'
            ? await resourceList<LearnerRosterDto>(
                courseId ? 'courses/' + id(courseId) + '/learners' : scope + '/learners',
                signal,
              )
            : [];
      const attempts =
        kind === 'user' && params.id
          ? await resourceList<ManagedAttemptDto>('admin/users/' + id(params.id) + '/attempts', signal)
          : ['attempts', 'grade'].includes(kind) && courseId
            ? await resourceList<ManagedAttemptDto>('courses/' + id(courseId) + '/attempts', signal)
            : [];
      const summary =
        kind === 'dashboard'
          ? await resource<DashboardDto>(scope + '/summary', 'GET', undefined, signal)
          : null;
      const queue =
        scope === 'instructor' && ['dashboard', 'grade'].includes(kind)
          ? await resourceList<{
              attempt_id: string;
              course_id: string;
              item_id: string;
              user_id: string;
              learner_display_name: string;
              submitted_at: string;
            }>('instructor/grading-queue', signal)
          : [];
      return { courses, users, account, full, roster, attempts, summary, queue, selectedAttempt };
    },
  });
  const forms = r.courses.map((c) => authoringForm(r.full?.id === c.id ? r.full : c));
  const users = r.users.map(userView);
  if (r.account) {
    const u = userView(r.account);
    const n = users.findIndex((x) => x.id === u.id);
    if (n >= 0) users[n] = u;
    else users.push(u);
  }
  for (const c of r.courses)
    if (!users.some((u) => u.id === c.instructor.id))
      users.push({
        id: c.instructor.id,
        name: c.instructor.display_name,
        email: '',
        role: 'instructor',
        roles: ['instructor'],
        avatar: c.instructor.avatar_url ?? undefined,
      });
  for (const row of [...r.roster, ...r.attempts, ...r.queue]) {
    const userId = 'user_id' in row ? row.user_id : '';
    if (userId && !users.some((u) => u.id === userId))
      users.push({
        id: userId,
        name: row.learner_display_name,
        email: '',
        role: 'learner',
        roles: ['learner'],
      });
  }
  const attempts = r.attempts.map(attemptView);
  for (const a of attempts)
    if (a.quizSnapshot)
      a.quizSnapshot.title =
        forms.flatMap((f) => f.quizzes).find((q) => q.id === a.quizId)?.title ?? a.quizSnapshot.title;
  for (const q of r.queue)
    if (!attempts.some((a) => a.id === q.attempt_id))
      attempts.push({
        id: q.attempt_id,
        courseId: q.course_id,
        quizId: q.item_id,
        userId: q.user_id,
        answers: {},
        status: 'submitted',
        essayStatus: 'pending',
        passed: null,
        submittedAt: q.submitted_at,
      });
  const data = {
    courses: forms.map((f) => f.course),
    quizzes: forms.flatMap((f) => f.quizzes),
    users,
    attempts,
    enrollments: r.roster.map(enrollmentView),
    certificates: r.roster.map(certificateView).filter((c) => !!c),
  };
  const invalidate = () =>
    cache.invalidateQueries({
      predicate: (q) =>
        ['instructor-data', 'authoring', 'grading', 'instructor-data', 'management'].includes(
          String(q.queryKey[0]),
        ),
    });
  return {
    data,
    currentUser: user ? userView(user) : null,
    roster: r.roster,
    summary: r.summary,
    attempt: r.selectedAttempt,
    async gradeAttempt(attemptId: string, values: { scores: Record<string, number>; feedback?: string }) {
      try {
        const current = r.selectedAttempt;
        if (!current || current.id !== attemptId) throw new Error('ไม่พบคำตอบนี้');
        for (const q of current.questions.filter(
          (q) => (q.type === 'essay' || q.type === 'image') && !current.grades[q.id],
        ))
          await resource(
            'instructor/attempts/' + id(attemptId) + '/questions/' + id(q.id) + '/grade',
            'PUT',
            { score: values.scores[q.id], comment: values.feedback?.trim() || null },
          );
        await invalidate();
        return { ok: true, message: 'บันทึกคะแนนแล้ว' };
      } catch (e) {
        await invalidate();
        return { ok: false, message: e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ' };
      }
    },
    assignInstructorRole: async (userId: string) => {
      try {
        await resource('admin/users/' + id(userId) + '/instructor', 'POST', {});
        await invalidate();
        return { ok: true, message: 'เพิ่มสิทธิ์ผู้สอนแล้ว' };
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ' };
      }
    },
    reviewCourse: async (courseId: string, action: 'approve' | 'return', reason?: string) => {
      try {
        const course = r.courses.find((c) => c.id === courseId);
        if (!course?.latest_review) throw new Error('ไม่พบฉบับที่รอตรวจ');
        await resource(
          'admin/course-reviews/' + id(course.latest_review.id) + '/' + action,
          'POST',
          action === 'approve' ? { expected_revision: course.revision } : { reason },
        );
        await invalidate();
        return { ok: true, message: 'บันทึกผลตรวจคอร์สแล้ว' };
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ' };
      }
    },
  };
}
