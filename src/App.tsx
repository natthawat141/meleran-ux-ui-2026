import React from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { PublicShell, WorkspaceShell } from './components/Shell';
import { featureElement } from './components/FeatureRoute';
import { useLms } from './store';
import { InstructorProfilePage } from './pages/PublicPages';
import { PublicCatalogPage } from './pages/public/CatalogPage';
import { PublicCourseDetailPage } from './pages/public/CourseDetailPage';
import { CourseLessonPreviewPage } from './pages/public/CourseLessonPreviewPage';
import { MemberCatalogPage } from './pages/member/CatalogPage';
import { MemberCourseDetailPage } from './pages/member/CourseDetailPage';
import { AdminOrdersPage } from './pages/admin/OrderPages';
import { AccessCodesPage } from './pages/admin/AccessCodesPage';
import { AdminCertificatesPage } from './pages/admin/CertificatePages';
import { LandingPage } from './pages/landing/LandingPage';
import { AboutPage } from './pages/landing/AboutPage';
import { BlogIndexPage, BlogArticlePage } from './pages/blog/BlogPages';
import { AdminBlogPage, AdminBlogEditorPage } from './pages/admin/BlogAdminPages';
import { LoginPage, RegisterPage, BecomeInstructorPage, DemoAccountPage, VerifyEmailPage } from './pages/AuthPages';
import { LearnerDashboardPage, MyCoursesPage } from './pages/learner/DashboardPages';
import { LearnerCoursePage, VideoLessonPage, ArticleLessonPage } from './pages/learner/LessonPages';
import { QuizIntroPage, QuizAttemptPage, QuizResultPage } from './pages/learner/QuizPages';
import { CheckoutPage, CheckoutResultPage, OrdersPage, OrderDetailPage, RedeemCourseCodePage } from './pages/learner/CommercePages';
import { CartPage } from './pages/learner/CartPage';
import { InstructorFinancePage } from './pages/instructor/InstructorFinancePage';
import { AdminInstructorFinancePage } from './pages/admin/AdminInstructorFinancePage';
import { CertificatesPage, CertificateDetailPage, ProfilePage, VerifyCertificatePage } from './pages/learner/AccountPages';
import { InstructorDashboardPage, InstructorCoursesPage, CourseEditorPage, InstructorCourseOverviewPage } from './pages/instructor/CoursePages';
import { CurriculumPage, ContentEditorPage } from './pages/instructor/CurriculumPages';
import { ChapterWorkspace as ChapterEditorPage } from './pages/instructor/ChapterWorkspace';
import { QuizManagerPage, QuizEditorPage, QuizAttemptsPage, GradeEssayPage } from './pages/instructor/QuizPages';
import { CoursePreviewPage, InstructorLearnersPage } from './pages/instructor/InsightPages';
import { LearnerReviewQueuePage } from './pages/instructor/LearnerReviewQueuePage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { InstructorAnalyticsRoute } from './pages/instructor/InstructorAnalyticsRoute';
import { CourseAnalyticsPage } from './pages/analytics/CourseAnalyticsPage';
import { LearnerAnalyticsPage } from './pages/analytics/LearnerAnalyticsPage';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { AdminAssignmentsPage } from './pages/admin/AssignmentPages';
import { InboxPage } from './pages/inbox/InboxPage';
import {
  AdminDashboardPage,
  AdminBusinessAnalyticsPage,
  AdminFinanceReportPage,
  AdminUsersPage,
  AdminUserDetailPage,
  AdminInstructorRequestsPage,
  AdminInstructorRequestDetailPage,
  AdminCoursesPage,
  AdminCourseDetailPage,
} from './pages/admin/AdminPages';
import { NoAccessPage, NotFoundPage } from './pages/SystemPages';
import type { Role } from './types';

const LearnerAiPage = React.lazy(() => import('./pages/learner/LearnerAiPage').then((page) => ({ default: page.LearnerAiPage })));

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

function RolePage({ roles, children, standalone = false }: { roles: Role[]; children: React.ReactNode; standalone?: boolean }) {
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
  return standalone ? <>{children}</> : <WorkspaceShell>{children}</WorkspaceShell>;
}

const learner = (element: React.ReactNode) => <RolePage roles={['learner', 'admin']}>{element}</RolePage>;
const instructor = (element: React.ReactNode) => <RolePage roles={['instructor', 'admin']}>{element}</RolePage>;
const admin = (element: React.ReactNode) => <RolePage roles={['admin']}>{element}</RolePage>;

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={featureElement('/', <LandingPage />)} />
      <Route path="/about" element={featureElement('/about', <AboutPage />)} />
      <Route path="/courses" element={featureElement('/courses', <PublicCourseEntry />)} />
      <Route path="/courses/:slug" element={featureElement('/courses/:slug', <PublicCourseEntry detail />)} />
      <Route path="/courses/:slug/preview" element={featureElement('/courses/:slug/preview', <Public><CourseLessonPreviewPage /></Public>)} />
      <Route
        path="/explore/courses"
        element={featureElement('/explore/courses',
          <RolePage roles={['learner', 'instructor', 'admin']}>
            <MemberCatalogPage />
          </RolePage>
        )}
      />
      <Route
        path="/explore/courses/:slug"
        element={featureElement('/explore/courses/:slug',
          <RolePage roles={['learner', 'instructor', 'admin']}>
            <MemberCourseDetailPage />
          </RolePage>
        )}
      />
      <Route path="/articles" element={featureElement('/articles', <BlogIndexPage />)} />
      <Route path="/articles/:id" element={featureElement('/articles/:id', <BlogArticlePage />)} />
      <Route
        path="/instructors/:id"
        element={featureElement('/instructors/:id',
          <Public>
            <InstructorProfilePage />
          </Public>
        )}
      />
      <Route path="/login" element={featureElement('/login', <LoginPage />)} />
      <Route path="/register" element={featureElement('/register', <RegisterPage />)} />
      <Route
        path="/become-instructor"
        element={featureElement('/become-instructor',
          <Public>
            <BecomeInstructorPage />
          </Public>
        )}
      />
      <Route path="/invite/:token" element={featureElement('/invite/:token', <DemoAccountPage type="invite" />)} />
      <Route path="/verify-email" element={featureElement('/verify-email', <VerifyEmailPage />)} />
      <Route path="/forgot-password" element={featureElement('/forgot-password', <DemoAccountPage type="forgot" />)} />
      <Route path="/reset-password" element={featureElement('/reset-password', <DemoAccountPage type="reset" />)} />

      <Route path="/learn" element={featureElement('/learn', learner(<LearnerDashboardPage />))} />
      <Route path="/learn/courses" element={featureElement('/learn/courses', learner(<MyCoursesPage />))} />
      <Route path="/learn/redeem" element={featureElement('/learn/redeem', learner(<RedeemCourseCodePage />))} />
      <Route path="/learn/assignments" element={featureElement('/learn/assignments', learner(<AssignmentsPage />))} />
      <Route path="/learn/ai" element={featureElement('/learn/ai',
        <RolePage roles={['learner', 'admin']} standalone>
          <React.Suspense fallback={<div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>กำลังเปิด Melearn AI…</div>}>
            <LearnerAiPage />
          </React.Suspense>
        </RolePage>
      )} />
      <Route path="/learn/inbox" element={featureElement('/learn/inbox', learner(<InboxPage />))} />
      <Route path="/learn/courses/:courseId" element={featureElement('/learn/courses/:courseId', learner(<LearnerCoursePage />))} />
      <Route path="/learn/courses/:courseId/videos/:itemId" element={featureElement('/learn/courses/:courseId/videos/:itemId', learner(<VideoLessonPage />))} />
      <Route path="/learn/courses/:courseId/articles/:itemId" element={featureElement('/learn/courses/:courseId/articles/:itemId', learner(<ArticleLessonPage />))} />
      <Route path="/learn/courses/:courseId/quizzes/:itemId" element={featureElement('/learn/courses/:courseId/quizzes/:itemId', learner(<RedirectCourseQuiz />))} />
      <Route path="/learn/quizzes/:quizId" element={featureElement('/learn/quizzes/:quizId', learner(<QuizIntroPage />))} />
      <Route path="/learn/attempts/:attemptId" element={featureElement('/learn/attempts/:attemptId', learner(<QuizAttemptPage />))} />
      <Route path="/learn/attempts/:attemptId/result" element={featureElement('/learn/attempts/:attemptId/result', learner(<QuizResultPage />))} />
      <Route path="/checkout/:courseId" element={featureElement('/checkout/:courseId', learner(<CheckoutPage />))} />
      <Route path="/checkout/:orderId/result" element={featureElement('/checkout/:orderId/result', learner(<CheckoutResultPage />))} />
      <Route path="/account/orders" element={featureElement('/account/orders', learner(<OrdersPage />))} />
      <Route path="/account/cart" element={featureElement('/account/cart', learner(<CartPage />))} />
      <Route path="/account/orders/:orderId" element={featureElement('/account/orders/:orderId', learner(<OrderDetailPage />))} />
      <Route path="/account/certificates" element={featureElement('/account/certificates', learner(<CertificatesPage />))} />
      <Route path="/account/certificates/:certificateId" element={featureElement('/account/certificates/:certificateId', learner(<CertificateDetailPage />))} />
      <Route
        path="/account/profile"
        element={featureElement('/account/profile',
          <RolePage roles={['learner', 'instructor', 'admin']}>
            <ProfilePage />
          </RolePage>
        )}
      />

      <Route path="/teach" element={featureElement('/teach', instructor(<InstructorDashboardPage />))} />
      <Route path="/teach/finance" element={featureElement('/teach/finance', instructor(<InstructorFinancePage />))} />
      <Route path="/teach/analytics" element={featureElement('/teach/analytics', instructor(<InstructorAnalyticsRoute />))} />
      <Route path="/teach/courses/:courseId/analytics" element={featureElement('/teach/courses/:courseId/analytics', instructor(<CourseAnalyticsPage />))} />
      <Route path="/teach/courses/:courseId/analytics/learners/:learnerId" element={featureElement('/teach/courses/:courseId/analytics/learners/:learnerId', instructor(<LearnerAnalyticsPage />))} />
      <Route path="/teach/assignments" element={featureElement('/teach/assignments', instructor(<AssignmentsPage />))} />
      <Route path="/teach/inbox" element={featureElement('/teach/inbox', instructor(<InboxPage />))} />
      <Route path="/teach/reviews" element={featureElement('/teach/reviews', instructor(<LearnerReviewQueuePage />))} />
      <Route path="/teach/courses" element={featureElement('/teach/courses', instructor(<InstructorCoursesPage />))} />
      <Route path="/teach/courses/new" element={featureElement('/teach/courses/new', instructor(<CourseEditorPage />))} />
      <Route path="/teach/courses/:courseId" element={featureElement('/teach/courses/:courseId', instructor(<InstructorCourseOverviewPage />))} />
      <Route path="/teach/courses/:courseId/settings" element={featureElement('/teach/courses/:courseId/settings', instructor(<CourseEditorPage />))} />
      <Route path="/teach/courses/:courseId/curriculum" element={featureElement('/teach/courses/:courseId/curriculum', instructor(<CurriculumPage />))} />
      <Route path="/teach/courses/:courseId/chapters/:chapterId" element={featureElement('/teach/courses/:courseId/chapters/:chapterId', instructor(<ChapterEditorPage />))} />
      <Route path="/teach/courses/:courseId/videos/:itemId" element={featureElement('/teach/courses/:courseId/videos/:itemId', instructor(<ContentEditorPage type="video" />))} />
      <Route path="/teach/courses/:courseId/articles/:itemId" element={featureElement('/teach/courses/:courseId/articles/:itemId', instructor(<ContentEditorPage type="article" />))} />
      <Route path="/teach/courses/:courseId/quizzes" element={featureElement('/teach/courses/:courseId/quizzes', instructor(<QuizManagerPage />))} />
      <Route path="/teach/quizzes" element={featureElement('/teach/quizzes', instructor(<QuizManagerPage />))} />
      <Route path="/teach/quizzes/:quizId" element={featureElement('/teach/quizzes/:quizId', instructor(<QuizEditorPage />))} />
      <Route path="/teach/quizzes/:quizId/attempts" element={featureElement('/teach/quizzes/:quizId/attempts', instructor(<QuizAttemptsPage />))} />
      <Route path="/teach/attempts/:attemptId/grade" element={featureElement('/teach/attempts/:attemptId/grade', instructor(<GradeEssayPage />))} />
      <Route path="/teach/courses/:courseId/preview" element={featureElement('/teach/courses/:courseId/preview', instructor(<CoursePreviewPage />))} />
      <Route path="/teach/courses/:courseId/learners" element={featureElement('/teach/courses/:courseId/learners', instructor(<InstructorLearnersPage />))} />
      <Route path="/teach/learners" element={featureElement('/teach/learners', instructor(<InstructorLearnersPage />))} />

      <Route path="/admin" element={featureElement('/admin', admin(<AdminDashboardPage />))} />
      <Route path="/admin/business-analytics" element={featureElement('/admin/business-analytics', admin(<AdminBusinessAnalyticsPage />))} />
      <Route path="/admin/finance" element={featureElement('/admin/finance', admin(<AdminInstructorFinancePage />))} />
      <Route path="/admin/reports/finance" element={featureElement('/admin/reports/finance', admin(<AdminFinanceReportPage />))} />
      <Route path="/admin/analytics" element={featureElement('/admin/analytics', admin(<AnalyticsPage />))} />
      <Route path="/admin/analytics/courses/:courseId" element={featureElement('/admin/analytics/courses/:courseId', admin(<CourseAnalyticsPage />))} />
      <Route path="/admin/analytics/courses/:courseId/learners/:learnerId" element={featureElement('/admin/analytics/courses/:courseId/learners/:learnerId', admin(<LearnerAnalyticsPage />))} />
      <Route path="/admin/assignments" element={featureElement('/admin/assignments', admin(<AdminAssignmentsPage />))} />
      <Route path="/admin/inbox" element={featureElement('/admin/inbox', admin(<InboxPage />))} />
      <Route path="/admin/articles" element={featureElement('/admin/articles', admin(<AdminBlogPage />))} />
      <Route path="/admin/articles/new" element={featureElement('/admin/articles/new', admin(<AdminBlogEditorPage />))} />
      <Route path="/admin/articles/:id/edit" element={featureElement('/admin/articles/:id/edit', admin(<AdminBlogEditorPage />))} />
      <Route path="/admin/users" element={featureElement('/admin/users', admin(<AdminUsersPage />))} />
      <Route path="/admin/users/:id" element={featureElement('/admin/users/:id', admin(<AdminUserDetailPage />))} />
      <Route path="/admin/instructors" element={featureElement('/admin/instructors', admin(<AdminInstructorRequestsPage />))} />
      <Route path="/admin/instructors/:id" element={featureElement('/admin/instructors/:id', admin(<AdminInstructorRequestDetailPage />))} />
      <Route path="/admin/courses" element={featureElement('/admin/courses', admin(<AdminCoursesPage />))} />
      <Route path="/admin/courses/:courseId" element={featureElement('/admin/courses/:courseId', admin(<AdminCourseDetailPage />))} />
      <Route path="/admin/orders" element={featureElement('/admin/orders', admin(<AdminOrdersPage />))} />
      <Route path="/admin/orders/:orderId" element={featureElement('/admin/orders/:orderId', admin(<OrderDetailPage />))} />
      <Route path="/admin/access-codes" element={featureElement('/admin/access-codes', admin(<AccessCodesPage />))} />
      <Route path="/admin/certificates" element={featureElement('/admin/certificates', admin(<AdminCertificatesPage />))} />
      <Route path="/admin/certificates/:certificateId" element={featureElement('/admin/certificates/:certificateId', admin(<CertificateDetailPage />))} />

      <Route
        path="/certificates/verify/:code"
        element={featureElement('/certificates/verify/:code',
          <Public>
            <VerifyCertificatePage />
          </Public>
        )}
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
