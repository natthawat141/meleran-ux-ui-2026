import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { PublicShell, WorkspaceShell } from '@legacy/components/Shell';
import { useLms } from '@legacy/store';
import { NoAccessPage } from '@legacy/pages/SystemPages';
import type { Role } from '@legacy/types';
import { VerifyEmailPage } from '@legacy/pages/AuthPages';

export function Public({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}

export function RolePage({ roles, children, standalone = false }: { roles: Role[]; children: React.ReactNode; standalone?: boolean }) {
  const { currentUser, data } = useLms();
  const location = useLocation();
  const params = useParams<{ courseId?: string; quizId?: string; attemptId?: string }>();
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
