import type {
  AdminUserSummaryDto,
  AdminUserDetailDto,
  CurrentUser,
  User,
  ManagedAttemptDto,
  QuizAttempt,
  Quiz,
  LearnerRosterDto,
} from '@melearn/contracts';
import { questionView } from '@melearn/course-authoring';
export type ManagedUser = User &
  import('@melearn/contracts').ProfileDetails & { roles: import('@melearn/contracts').Role[] };
export function userView(u: AdminUserSummaryDto | AdminUserDetailDto | CurrentUser): ManagedUser {
  return {
    ...('profile' in u ? u.profile : {}),
    id: u.id,
    name: u.display_name,
    email: u.email ?? '',
    username: u.username ?? undefined,
    avatar: u.avatar_url ?? undefined,
    role: u.roles.includes('admin') ? 'admin' : u.roles.includes('instructor') ? 'instructor' : 'learner',
    roles: u.roles,
    emailVerified: u.email_verified,
    status: 'status' in u ? u.status : u.origin === 'self_email' && !u.email_verified ? 'pending' : 'active',
  };
}
export function attemptView(a: ManagedAttemptDto): QuizAttempt {
  const quiz: Quiz = {
    id: a.item_id,
    courseId: a.course_id,
    title: 'แบบฝึกหัด',
    passPercent: 70,
    questions: a.questions.map(questionView),
  };
  return {
    id: a.id,
    courseId: a.course_id,
    quizId: a.item_id,
    userId: a.user_id,
    status: a.status === 'in_progress' ? 'in_progress' : 'submitted',
    essayStatus:
      a.status === 'pending_review'
        ? 'pending'
        : a.questions.some((q) => q.type === 'essay' || q.type === 'image')
          ? 'graded'
          : 'none',
    answers: Object.fromEntries(
      a.questions.map((q) => {
        const r = a.answers[q.id];
        return [
          q.id,
          r?.option_ids
            ? (q.options ?? []).findIndex((o) => r.option_ids?.includes(o.id))
            : { text: r?.text ?? '', image: r?.image_url },
        ];
      }),
    ),
    score: a.choice_earned,
    maxChoice: a.choice_max,
    maxScore: a.max,
    totalScore: a.earned ?? undefined,
    finalPercent: a.earned === null ? undefined : (a.earned / a.max) * 100,
    percent: a.earned === null ? undefined : (a.earned / a.max) * 100,
    passed: a.passed,
    startedAt: a.started_at,
    submittedAt: a.submitted_at ?? undefined,
    gradedAt: a.graded_at ?? undefined,
    quizSnapshot: quiz,
  };
}
export const enrollmentView = (r: LearnerRosterDto) => ({
  id: r.id,
  courseId: r.course_id,
  userId: r.user_id,
  createdAt: r.granted_at,
  percent: r.percent,
  completed: r.completed_items,
  total: r.total_items,
});
export const certificateView = (r: LearnerRosterDto) =>
  r.certificate
    ? {
        id: r.certificate.id,
        code: r.certificate.code,
        courseId: r.course_id,
        userId: r.user_id,
        recipientName: r.certificate.learner_name,
        issuedAt: r.certificate.issued_at,
      }
    : null;
