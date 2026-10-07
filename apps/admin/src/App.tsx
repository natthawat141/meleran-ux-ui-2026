import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { featureElement } from '@legacy/components/FeatureRoute';
import { WorkspaceShell } from '@legacy/components/Shell';
import { useLms } from '@legacy/store';
import { AdminDashboardPage, AdminUsersPage, AdminUserDetailPage, AdminInstructorsPage, AdminCoursesPage, AdminCourseDetailPage } from '@legacy/pages/admin/AdminPages';
import { CourseReviewPage } from '@legacy/pages/admin/CourseReviewPage';
import { AccessCodesPage } from '@legacy/pages/admin/AccessCodesPage';
import { AdminBlogPage, AdminBlogEditorPage } from '@legacy/pages/admin/BlogAdminPages';
import { LoginPage, VerifyEmailPage, DemoAccountPage } from '@legacy/pages/AuthPages';
import { ProfilePage } from '@legacy/pages/learner/AccountPages';
import { BlogArticlePage } from '@legacy/pages/blog/BlogPages';
import { CourseEditorPage, InstructorCourseOverviewPage } from '@legacy/pages/instructor/CoursePages';
import { CurriculumPage, ContentEditorPage } from '@legacy/pages/instructor/CurriculumPages';
import { ChapterWorkspace as ChapterEditorPage } from '@legacy/pages/instructor/ChapterWorkspace';
import { QuizManagerPage, QuizEditorPage } from '@legacy/pages/instructor/QuizPages';
import { CoursePreviewPage, InstructorLearnersPage } from '@legacy/pages/instructor/InsightPages';
import { NoAccessPage, NotFoundPage } from '@legacy/pages/SystemPages';
import { resolveAdminCompatibilityRoute } from './route-compatibility';

function AdminPage({ children }: { children: React.ReactNode }) {
  const { currentUser } = useLms();
  const location = useLocation();
  if (!currentUser) return <Navigate to={`/login?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} replace />;
  if (currentUser.role !== 'admin') return <WorkspaceShell availableRoles={['admin']}><NoAccessPage /></WorkspaceShell>;
  return <WorkspaceShell availableRoles={['admin']}>{children}</WorkspaceShell>;
}

const admin = (element: React.ReactNode) => <AdminPage>{element}</AdminPage>;

export function AdminRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<DemoAccountPage type="forgot" />} />
      <Route path="/reset-password" element={<DemoAccountPage type="reset" />} />
      <Route path="/articles/:id" element={<BlogArticlePage />} />
      <Route path="/admin" element={featureElement('/admin', admin(<AdminDashboardPage />))} />
      <Route path="/admin/articles" element={featureElement('/admin/articles', admin(<AdminBlogPage />))} />
      <Route path="/admin/articles/new" element={featureElement('/admin/articles/new', admin(<AdminBlogEditorPage />))} />
      <Route path="/admin/articles/:id/edit" element={featureElement('/admin/articles/:id/edit', admin(<AdminBlogEditorPage />))} />
      <Route path="/admin/users" element={featureElement('/admin/users', admin(<AdminUsersPage />))} />
      <Route path="/admin/users/:id" element={featureElement('/admin/users/:id', admin(<AdminUserDetailPage />))} />
      <Route path="/admin/instructors" element={featureElement('/admin/instructors', admin(<AdminInstructorsPage />))} />
      <Route path="/admin/courses" element={featureElement('/admin/courses', admin(<AdminCoursesPage />))} />
      <Route path="/admin/courses/reviews" element={featureElement('/admin/courses/reviews', admin(<CourseReviewPage />))} />
      <Route path="/admin/courses/:courseId" element={featureElement('/admin/courses/:courseId', admin(<AdminCourseDetailPage />))} />
      <Route path="/admin/access-codes" element={featureElement('/admin/access-codes', admin(<AccessCodesPage />))} />
      <Route path="/account/profile" element={featureElement('/account/profile', admin(<ProfilePage />))} />

      <Route path="/admin/courses/new" element={featureElement('/teach/courses/new', admin(<CourseEditorPage />))} />
      <Route path="/admin/courses/:courseId/settings" element={featureElement('/teach/courses/:courseId/settings', admin(<CourseEditorPage />))} />
      <Route path="/admin/courses/:courseId/overview" element={featureElement('/teach/courses/:courseId', admin(<InstructorCourseOverviewPage />))} />
      <Route path="/admin/courses/:courseId/curriculum" element={featureElement('/teach/courses/:courseId/curriculum', admin(<CurriculumPage />))} />
      <Route path="/admin/courses/:courseId/chapters/:chapterId" element={featureElement('/teach/courses/:courseId/chapters/:chapterId', admin(<ChapterEditorPage />))} />
      <Route path="/admin/courses/:courseId/videos/:itemId" element={featureElement('/teach/courses/:courseId/videos/:itemId', admin(<ContentEditorPage type="video" />))} />
      <Route path="/admin/courses/:courseId/articles/:itemId" element={featureElement('/teach/courses/:courseId/articles/:itemId', admin(<ContentEditorPage type="article" />))} />
      <Route path="/admin/courses/:courseId/quizzes" element={featureElement('/teach/courses/:courseId/quizzes', admin(<QuizManagerPage />))} />
      <Route path="/admin/quizzes" element={featureElement('/teach/quizzes', admin(<QuizManagerPage />))} />
      <Route path="/admin/quizzes/:quizId" element={featureElement('/teach/quizzes/:quizId', admin(<QuizEditorPage />))} />
      <Route path="/admin/courses/:courseId/preview" element={featureElement('/teach/courses/:courseId/preview', admin(<CoursePreviewPage />))} />
      <Route path="/admin/courses/:courseId/learners" element={featureElement('/teach/courses/:courseId/learners', admin(<InstructorLearnersPage />))} />
      <Route path="/admin/learners" element={featureElement('/teach/learners', admin(<InstructorLearnersPage />))} />

      {/* Allowlisted migration paths; Instructor and retired grading paths fail closed. */}
      <Route path="/teach" element={<LegacyAdminRedirect />} />
      <Route path="/teach/*" element={<LegacyAdminRedirect />} />
      <Route path="/403" element={<WorkspaceShell availableRoles={['admin']}><NoAccessPage /></WorkspaceShell>} />
      <Route path="*" element={<WorkspaceShell availableRoles={['admin']}><NotFoundPage /></WorkspaceShell>} />
    </Routes>
  );
}

function LegacyAdminRedirect() {
  const location = useLocation();
  const target = resolveAdminCompatibilityRoute(location.pathname, location.search, location.hash);
  return target ? <Navigate to={target} replace /> : <WorkspaceShell availableRoles={['admin']}><NotFoundPage /></WorkspaceShell>;
}
