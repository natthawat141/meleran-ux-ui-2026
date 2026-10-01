import React from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { PublicShell, WorkspaceShell } from './components/Shell';
import { useLms } from './store';
import { InstructorProfilePage } from './pages/PublicPages';
import { PublicCatalogPage } from './pages/public/CatalogPage';
import { PublicCourseDetailPage } from './pages/public/CourseDetailPage';
import { MemberCatalogPage } from './pages/member/CatalogPage';
import { MemberCourseDetailPage } from './pages/member/CourseDetailPage';
import { AdminOrdersPage } from './pages/admin/OrderPages';
import { AdminCertificatesPage } from './pages/admin/CertificatePages';
import { LandingPage } from './pages/landing/LandingPage';
import { AboutPage } from './pages/landing/AboutPage';
import { BlogIndexPage, BlogArticlePage } from './pages/blog/BlogPages';
import { AdminBlogPage, AdminBlogEditorPage } from './pages/admin/BlogAdminPages';
import { LoginPage, RegisterPage, BecomeInstructorPage, DemoAccountPage, VerifyEmailPage } from './pages/AuthPages';
import { LearnerDashboardPage, MyCoursesPage } from './pages/learner/DashboardPages';
import { LearnerCoursePage, VideoLessonPage, ArticleLessonPage } from './pages/learner/LessonPages';
import { QuizIntroPage, QuizAttemptPage, QuizResultPage } from './pages/learner/QuizPages';
import { CheckoutPage, CheckoutResultPage, OrdersPage, OrderDetailPage } from './pages/learner/CommercePages';
import { CertificatesPage, CertificateDetailPage, ProfilePage, VerifyCertificatePage } from './pages/learner/AccountPages';
import { InstructorDashboardPage, InstructorCoursesPage, CourseEditorPage, InstructorCourseOverviewPage } from './pages/instructor/CoursePages';
import { CurriculumPage, ContentEditorPage } from './pages/instructor/CurriculumPages';
import { ChapterWorkspace as ChapterEditorPage } from './pages/instructor/ChapterWorkspace';
import { QuizManagerPage, QuizEditorPage, QuizAttemptsPage, GradeEssayPage } from './pages/instructor/QuizPages';
import { CoursePreviewPage, InstructorLearnersPage } from './pages/instructor/InsightPages';
import { LearnerReviewQueuePage } from './pages/instructor/LearnerReviewQueuePage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { CourseAnalyticsPage } from './pages/analytics/CourseAnalyticsPage';
import { LearnerAnalyticsPage } from './pages/analytics/LearnerAnalyticsPage';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { AdminAssignmentsPage } from './pages/admin/AssignmentPages';
import { InboxPage } from './pages/inbox/InboxPage';
import {
  AdminDashboardPage,
  AdminUsersPage,
  AdminUserDetailPage,
  AdminInstructorRequestsPage,
  AdminInstructorRequestDetailPage,
  AdminCoursesPage,
  AdminCourseDetailPage,
} from './pages/admin/AdminPages';
import { NoAccessPage, NotFoundPage } from './pages/SystemPages';
import type { Role } from './types';

function Public({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}

function PublicCourseEntry({ detail = false }: { detail?: boolean }) {
  const { currentUser } = useLms();
  const location = useLocation();
  const { slug } = useParams<{ slug?: string }>();
  if (currentUser) {
    return (
      <Navigate
        to={`/explore/courses${detail && slug ? `/${encodeURIComponent(slug)}` : ''}${location.search}${location.hash}`}
        replace
      />
    );
  }
  return <Public>{detail ? <PublicCourseDetailPage /> : <PublicCatalogPage />}</Public>;
}

function RolePage({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { currentUser, data } = useLms();
  const location = useLocation();
  const params = useParams<{ courseId?: string; quizId?: string; attemptId?: string }>();
  if (!currentUser) {
    return <Navigate to={`/login?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} replace />;
  }
  if (!roles.includes(currentUser.role)) {
    return (
      <WorkspaceShell>
        <NoAccessPage />
      </WorkspaceShell>
    );
  }
  if (currentUser.role === 'instructor' && location.pathname.startsWith('/teach/')) {
    const attempt = data.attempts.find((item) => item.id === params.attemptId);
    const quiz = data.quizzes.find((item) => item.id === params.quizId);
    const queryCourse = new URLSearchParams(location.search).get('course') || new URLSearchParams(location.search).get('courseId');
    const courseId = params.courseId ?? quiz?.courseId ?? attempt?.courseId ?? queryCourse;
    const course = data.courses.find((item) => item.id === courseId);
    if (course && course.instructorId !== currentUser.id) {
      return (
        <WorkspaceShell>
          <NoAccessPage />
        </WorkspaceShell>
      );
    }
  }
  return <WorkspaceShell>{children}</WorkspaceShell>;
}

const learner = (element: React.ReactNode) => <RolePage roles={['learner', 'admin']}>{element}</RolePage>;
const instructor = (element: React.ReactNode) => <RolePage roles={['instructor', 'admin']}>{element}</RolePage>;
const admin = (element: React.ReactNode) => <RolePage roles={['admin']}>{element}</RolePage>;

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/courses" element={<PublicCourseEntry />} />
      <Route path="/courses/:slug" element={<PublicCourseEntry detail />} />
      <Route
        path="/explore/courses"
        element={
          <RolePage roles={['learner', 'instructor', 'admin']}>
            <MemberCatalogPage />
          </RolePage>
        }
      />
      <Route
        path="/explore/courses/:slug"
        element={
          <RolePage roles={['learner', 'instructor', 'admin']}>
            <MemberCourseDetailPage />
          </RolePage>
        }
      />
      <Route path="/articles" element={<BlogIndexPage />} />
      <Route path="/articles/:id" element={<BlogArticlePage />} />
      <Route
        path="/instructors/:id"
        element={
          <Public>
            <InstructorProfilePage />
          </Public>
        }
      />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/become-instructor"
        element={
          <Public>
            <BecomeInstructorPage />
          </Public>
        }
      />
      <Route path="/invite/:token" element={<DemoAccountPage type="invite" />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<DemoAccountPage type="forgot" />} />
      <Route path="/reset-password" element={<DemoAccountPage type="reset" />} />

      <Route path="/learn" element={learner(<LearnerDashboardPage />)} />
      <Route path="/learn/courses" element={learner(<MyCoursesPage />)} />
      <Route path="/learn/assignments" element={learner(<AssignmentsPage />)} />
      <Route path="/learn/inbox" element={learner(<InboxPage />)} />
      <Route path="/learn/courses/:courseId" element={learner(<LearnerCoursePage />)} />
      <Route path="/learn/courses/:courseId/videos/:itemId" element={learner(<VideoLessonPage />)} />
      <Route path="/learn/courses/:courseId/articles/:itemId" element={learner(<ArticleLessonPage />)} />
      <Route path="/learn/courses/:courseId/quizzes/:itemId" element={learner(<RedirectCourseQuiz />)} />
      <Route path="/learn/quizzes/:quizId" element={learner(<QuizIntroPage />)} />
      <Route path="/learn/attempts/:attemptId" element={learner(<QuizAttemptPage />)} />
      <Route path="/learn/attempts/:attemptId/result" element={learner(<QuizResultPage />)} />
      <Route path="/checkout/:courseId" element={learner(<CheckoutPage />)} />
      <Route path="/checkout/:orderId/result" element={learner(<CheckoutResultPage />)} />
      <Route path="/account/orders" element={learner(<OrdersPage />)} />
      <Route path="/account/orders/:orderId" element={learner(<OrderDetailPage />)} />
      <Route path="/account/certificates" element={learner(<CertificatesPage />)} />
      <Route path="/account/certificates/:certificateId" element={learner(<CertificateDetailPage />)} />
      <Route
        path="/account/profile"
        element={
          <RolePage roles={['learner', 'instructor', 'admin']}>
            <ProfilePage />
          </RolePage>
        }
      />

      <Route path="/teach" element={instructor(<InstructorDashboardPage />)} />
      <Route path="/teach/analytics" element={instructor(<AnalyticsPage />)} />
      <Route path="/teach/courses/:courseId/analytics" element={instructor(<CourseAnalyticsPage />)} />
      <Route path="/teach/courses/:courseId/analytics/learners/:learnerId" element={instructor(<LearnerAnalyticsPage />)} />
      <Route path="/teach/assignments" element={instructor(<AssignmentsPage />)} />
      <Route path="/teach/inbox" element={instructor(<InboxPage />)} />
      <Route path="/teach/reviews" element={instructor(<LearnerReviewQueuePage />)} />
      <Route path="/teach/courses" element={instructor(<InstructorCoursesPage />)} />
      <Route path="/teach/courses/new" element={instructor(<CourseEditorPage />)} />
      <Route path="/teach/courses/:courseId" element={instructor(<InstructorCourseOverviewPage />)} />
      <Route path="/teach/courses/:courseId/settings" element={instructor(<CourseEditorPage />)} />
      <Route path="/teach/courses/:courseId/curriculum" element={instructor(<CurriculumPage />)} />
      <Route path="/teach/courses/:courseId/chapters/:chapterId" element={instructor(<ChapterEditorPage />)} />
      <Route path="/teach/courses/:courseId/videos/:itemId" element={instructor(<ContentEditorPage type="video" />)} />
      <Route path="/teach/courses/:courseId/articles/:itemId" element={instructor(<ContentEditorPage type="article" />)} />
      <Route path="/teach/courses/:courseId/quizzes" element={instructor(<QuizManagerPage />)} />
      <Route path="/teach/quizzes" element={instructor(<QuizManagerPage />)} />
      <Route path="/teach/quizzes/:quizId" element={instructor(<QuizEditorPage />)} />
      <Route path="/teach/quizzes/:quizId/attempts" element={instructor(<QuizAttemptsPage />)} />
      <Route path="/teach/attempts/:attemptId/grade" element={instructor(<GradeEssayPage />)} />
      <Route path="/teach/courses/:courseId/preview" element={instructor(<CoursePreviewPage />)} />
      <Route path="/teach/courses/:courseId/learners" element={instructor(<InstructorLearnersPage />)} />
      <Route path="/teach/learners" element={instructor(<InstructorLearnersPage />)} />

      <Route path="/admin" element={admin(<AdminDashboardPage />)} />
      <Route path="/admin/analytics" element={admin(<AnalyticsPage />)} />
      <Route path="/admin/analytics/courses/:courseId" element={admin(<CourseAnalyticsPage />)} />
      <Route path="/admin/analytics/courses/:courseId/learners/:learnerId" element={admin(<LearnerAnalyticsPage />)} />
      <Route path="/admin/assignments" element={admin(<AdminAssignmentsPage />)} />
      <Route path="/admin/inbox" element={admin(<InboxPage />)} />
      <Route path="/admin/articles" element={admin(<AdminBlogPage />)} />
      <Route path="/admin/articles/new" element={admin(<AdminBlogEditorPage />)} />
      <Route path="/admin/articles/:id/edit" element={admin(<AdminBlogEditorPage />)} />
      <Route path="/admin/users" element={admin(<AdminUsersPage />)} />
      <Route path="/admin/users/:id" element={admin(<AdminUserDetailPage />)} />
      <Route path="/admin/instructors" element={admin(<AdminInstructorRequestsPage />)} />
      <Route path="/admin/instructors/:id" element={admin(<AdminInstructorRequestDetailPage />)} />
      <Route path="/admin/courses" element={admin(<AdminCoursesPage />)} />
      <Route path="/admin/courses/:courseId" element={admin(<AdminCourseDetailPage />)} />
      <Route path="/admin/orders" element={admin(<AdminOrdersPage />)} />
      <Route path="/admin/orders/:orderId" element={admin(<OrderDetailPage />)} />
      <Route path="/admin/certificates" element={admin(<AdminCertificatesPage />)} />
      <Route path="/admin/certificates/:certificateId" element={admin(<CertificateDetailPage />)} />

      <Route
        path="/certificates/verify/:code"
        element={
          <Public>
            <VerifyCertificatePage />
          </Public>
        }
      />
      <Route
        path="/403"
        element={
          <Public>
            <NoAccessPage />
          </Public>
        }
      />
      <Route
        path="*"
        element={
          <Public>
            <NotFoundPage />
          </Public>
        }
      />
    </Routes>
  );
}

function RedirectCourseQuiz() {
  const location = useLocation();
  const parts = location.pathname.split('/');
  const { data } = useLms();
  const item = data.courses
    .find((course) => course.id === parts[3])
    ?.chapters.flatMap((chapter) => chapter.items)
    .find((entry) => entry.id === parts[5]);
  const quizId = item && item.type === 'quiz' ? item.quizId : undefined;
  return <Navigate to={quizId ? `/learn/quizzes/${quizId}` : '/404'} replace />;
}
