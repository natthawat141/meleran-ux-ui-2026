import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { PublicShell, WorkspaceShell } from '@legacy/components/Shell';
import { useLms } from '@legacy/store';
import { NoAccessPage } from '@melearn/ui';
import type { Role } from '@melearn/contracts';
import { VerifyEmailPage } from '../../features/auth/pages/AuthPages';
import { useAuthSession } from '../../features/auth/api/AuthSessionProvider';
import type { ApiSessionUser } from '../../features/auth/api/auth-session';

function sessionIdentity(user: ApiSessionUser, role: Role) {
  return { id: user.id, name: user.display_name, email: user.email ?? '', role, avatar: user.avatar_url ?? undefined,
    emailVerified: user.email_verified, roles: user.roles };
}

export function Public({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}

export function RolePage({ roles, children, standalone = false }: { roles: Role[]; children: React.ReactNode; standalone?: boolean }) {
  const { currentUser, data } = useLms();
  const session = useAuthSession();
  const location = useLocation();
  const params = useParams<{ courseId?: string; quizId?: string; attemptId?: string }>();
  if (session.enabled) {
    if (session.status === 'loading') return <div className="public-page" aria-live="polite">กำลังตรวจสอบบัญชี</div>;
    if (session.status === 'error') return <div className="public-page" role="alert">เชื่อมต่อระบบบัญชีจำลองไม่ได้ กรุณาลองเปิดหน้าใหม่</div>;
    if (!session.user) return <Navigate to={`/login?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} replace />;
    const user = session.user;
    const role: Role = user.roles.includes('admin') ? 'admin'
      : location.pathname.startsWith('/teach') && user.roles.includes('instructor') ? 'instructor' : 'learner';
    if (!roles.includes(role) || !user.roles.includes(role)) {
      return <WorkspaceShell identity={sessionIdentity(user, role)} availableRoles={roles.filter((value) => user.roles.includes(value))} onLogout={session.logout}><NoAccessPage /></WorkspaceShell>;
    }
    const needsEmailVerification = role !== 'admin' && !user.email_verified;
    const learningPath = location.pathname === '/learn' || location.pathname.startsWith('/learn/') || location.pathname === '/learn/redeem' || location.pathname.startsWith('/checkout/');
    if (needsEmailVerification && learningPath) return <Public><VerifyEmailPage /></Public>;
    return standalone ? <>{children}</> : <WorkspaceShell identity={sessionIdentity(user, role)} availableRoles={roles.filter((value) => user.roles.includes(value))} onLogout={session.logout}>{children}</WorkspaceShell>;
  }
  if (!currentUser) return <Navigate to={`/login?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} replace />;
  if (!roles.includes(currentUser.role)) return <WorkspaceShell availableRoles={['learner', 'instructor']}><NoAccessPage /></WorkspaceShell>;
  const needsEmailVerification = currentUser.role !== 'admin' && currentUser.emailVerified === false;
  const learningPath = location.pathname === '/learn'
    || location.pathname === '/learn/courses'
    || location.pathname.startsWith('/learn/courses/')
    || location.pathname === '/learn/redeem'
    || location.pathname.startsWith('/learn/quizzes/')
    || location.pathname.startsWith('/learn/attempts/')
    || location.pathname.startsWith('/checkout/');
  if (needsEmailVerification && learningPath) return <Public><VerifyEmailPage /></Public>;
  if (currentUser.role === 'instructor' && location.pathname.startsWith('/teach/')) {
    const attempt = data.attempts.find((item) => item.id === params.attemptId);
    const quiz = data.quizzes.find((item) => item.id === params.quizId);
    const query = new URLSearchParams(location.search);
    const courseId = params.courseId ?? quiz?.courseId ?? attempt?.courseId ?? query.get('course') ?? query.get('courseId');
    const course = data.courses.find((item) => item.id === courseId);
    if (course && course.instructorId !== currentUser.id) return <WorkspaceShell availableRoles={['learner', 'instructor']}><NoAccessPage /></WorkspaceShell>;
  }
  return standalone ? <>{children}</> : <WorkspaceShell availableRoles={['learner', 'instructor']}>{children}</WorkspaceShell>;
}

export const learner = (element: React.ReactNode) => <RolePage roles={['learner', 'instructor']}>{element}</RolePage>;
export const accountUser = (element: React.ReactNode) => <RolePage roles={['learner', 'instructor']}>{element}</RolePage>;
export const grader = (element: React.ReactNode) => <RolePage roles={['instructor']}>{element}</RolePage>;
export const paymentUser = (element: React.ReactNode) => <RolePage roles={['learner', 'instructor']}>{element}</RolePage>;
export const instructor = (element: React.ReactNode) => <RolePage roles={['instructor']}>{element}</RolePage>;
