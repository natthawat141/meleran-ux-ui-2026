import React from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { featureElement } from '@legacy/components/FeatureRoute';
import { PublicShell, WorkspaceShell } from '@legacy/components/Shell';
import { useLms } from '@legacy/store';
import { InstructorProfilePage } from '@legacy/pages/PublicPages';
import { PublicCatalogPage } from '@legacy/pages/public/CatalogPage';
import { PublicCourseDetailPage } from '@legacy/pages/public/CourseDetailPage';
import { MemberCatalogPage } from '@legacy/pages/member/CatalogPage';
import { MemberCourseDetailPage } from '@legacy/pages/member/CourseDetailPage';
import { LandingPage } from '@legacy/pages/landing/LandingPage';
import { AboutPage } from '@legacy/pages/landing/AboutPage';
import { BlogIndexPage, BlogArticlePage } from '@legacy/pages/blog/BlogPages';
import { LoginPage, RegisterPage, DemoAccountPage, VerifyEmailPage } from '@legacy/pages/AuthPages';
import { LearnerDashboardPage, MyCoursesPage } from '@legacy/pages/learner/DashboardPages';
import { LearnerCoursePage, VideoLessonPage, ArticleLessonPage } from '@legacy/pages/learner/LessonPages';
import { QuizIntroPage, QuizAttemptPage, QuizResultPage } from '@legacy/pages/learner/QuizPages';
import { RedeemCourseCodePage } from '@legacy/pages/learner/RedeemCourseCodePage';
import { CheckoutPage, CheckoutResultPage } from '@legacy/pages/learner/PaymentPages';
import { CertificatesPage, CertificateDetailPage, ProfilePage } from '@legacy/pages/learner/AccountPages';
import { InstructorDashboardPage, InstructorCoursesPage, CourseEditorPage, InstructorCourseOverviewPage } from '@legacy/pages/instructor/CoursePages';
import { CurriculumPage, ContentEditorPage } from '@legacy/pages/instructor/CurriculumPages';
import { ChapterWorkspace as ChapterEditorPage } from '@legacy/pages/instructor/ChapterWorkspace';
import { QuizManagerPage, QuizEditorPage, QuizAttemptsPage, GradeEssayPage } from '@legacy/pages/instructor/QuizPages';
import { CoursePreviewPage, InstructorLearnersPage } from '@legacy/pages/instructor/InsightPages';
import { LearnerReviewQueuePage } from '@legacy/pages/instructor/LearnerReviewQueuePage';
import { NoAccessPage, NotFoundPage } from '@legacy/pages/SystemPages';
import type { Role } from '@legacy/types';

const LearnerAiPage = React.lazy(() => import('@legacy/pages/learner/LearnerAiPage').then((page) => ({ default: page.LearnerAiPage })));

function Public({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}

function PublicCourseEntry({ detail = false }: { detail?: boolean }) {
  const { currentUser } = useLms();
  const location = useLocation();
  const { slug } = useParams<{ slug?: string }>();
  if (currentUser) {
    return <Navigate to={`/explore/courses${detail && slug ? `/${encodeURIComponent(slug)}` : ''}${location.search}${location.hash}`} replace />;
  }
  return <Public>{detail ? <PublicCourseDetailPage /> : <PublicCatalogPage />}</Public>;
}

function RolePage({ roles, children, standalone = false }: { roles: Role[]; children: React.ReactNode; standalone?: boolean }) {
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

const learner = (element: React.ReactNode) => <RolePage roles={['learner', 'instructor']}>{element}</RolePage>;
const accountUser = (element: React.ReactNode) => <RolePage roles={['learner', 'instructor']}>{element}</RolePage>;
const grader = (element: React.ReactNode) => <RolePage roles={['instructor']}>{element}</RolePage>;
const paymentUser = (element: React.ReactNode) => <RolePage roles={['learner', 'instructor']}>{element}</RolePage>;
const instructor = (element: React.ReactNode) => <RolePage roles={['instructor']}>{element}</RolePage>;

export function WebRoutes() {
  return (
    <Routes>
      <Route path="/" element={featureElement('/', <LandingPage />)} />
      <Route path="/about" element={featureElement('/about', <AboutPage />)} />
      <Route path="/courses" element={featureElement('/courses', <PublicCourseEntry />)} />
      <Route path="/courses/:slug" element={featureElement('/courses/:slug', <PublicCourseEntry detail />)} />
      <Route path="/explore/courses" element={featureElement('/explore/courses', <RolePage roles={['learner', 'instructor']}><MemberCatalogPage /></RolePage>)} />
      <Route path="/explore/courses/:slug" element={featureElement('/explore/courses/:slug', <RolePage roles={['learner', 'instructor']}><MemberCourseDetailPage /></RolePage>)} />
      <Route path="/articles" element={featureElement('/articles', <BlogIndexPage />)} />
      <Route path="/articles/:id" element={featureElement('/articles/:id', <BlogArticlePage />)} />
      <Route path="/instructors/:id" element={featureElement('/instructors/:id', <Public><InstructorProfilePage /></Public>)} />
      <Route path="/login" element={featureElement('/login', <LoginPage />)} />
      <Route path="/register" element={featureElement('/register', <RegisterPage />)} />
      <Route path="/verify-email" element={featureElement('/verify-email', <VerifyEmailPage />)} />
      <Route path="/forgot-password" element={featureElement('/forgot-password', <DemoAccountPage type="forgot" />)} />
      <Route path="/reset-password" element={featureElement('/reset-password', <DemoAccountPage type="reset" />)} />
      <Route path="/learn" element={featureElement('/learn', learner(<LearnerDashboardPage />))} />
      <Route path="/learn/courses" element={featureElement('/learn/courses', learner(<MyCoursesPage />))} />
      <Route path="/learn/redeem" element={featureElement('/learn/redeem', learner(<RedeemCourseCodePage />))} />
      <Route path="/learn/ai" element={featureElement('/learn/ai', <RolePage roles={['learner', 'instructor']} standalone><React.Suspense fallback={<div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>กำลังเปิด Melearn AI…</div>}><LearnerAiPage /></React.Suspense></RolePage>)} />
      <Route path="/learn/courses/:courseId" element={featureElement('/learn/courses/:courseId', learner(<LearnerCoursePage />))} />
      <Route path="/learn/courses/:courseId/videos/:itemId" element={featureElement('/learn/courses/:courseId/videos/:itemId', learner(<VideoLessonPage />))} />
      <Route path="/learn/courses/:courseId/articles/:itemId" element={featureElement('/learn/courses/:courseId/articles/:itemId', learner(<ArticleLessonPage />))} />
      <Route path="/learn/courses/:courseId/quizzes/:itemId" element={featureElement('/learn/courses/:courseId/quizzes/:itemId', learner(<RedirectCourseQuiz />))} />
      <Route path="/learn/quizzes/:quizId" element={featureElement('/learn/quizzes/:quizId', learner(<QuizIntroPage />))} />
      <Route path="/learn/attempts/:attemptId" element={featureElement('/learn/attempts/:attemptId', learner(<QuizAttemptPage />))} />
      <Route path="/learn/attempts/:attemptId/result" element={featureElement('/learn/attempts/:attemptId/result', learner(<QuizResultPage />))} />
      <Route path="/checkout/:courseId" element={featureElement('/checkout/:courseId', paymentUser(<CheckoutPage />))} />
      <Route path="/checkout/:orderId/result" element={featureElement('/checkout/:orderId/result', paymentUser(<CheckoutResultPage />))} />
      <Route path="/account/certificates" element={featureElement('/account/certificates', accountUser(<CertificatesPage />))} />
      <Route path="/account/certificates/:certificateId" element={featureElement('/account/certificates/:certificateId', accountUser(<CertificateDetailPage />))} />
      <Route path="/account/profile" element={featureElement('/account/profile', accountUser(<ProfilePage />))} />
      <Route path="/teach" element={featureElement('/teach', instructor(<InstructorDashboardPage />))} />
      <Route path="/teach/reviews" element={featureElement('/teach/reviews', grader(<LearnerReviewQueuePage />))} />
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
      <Route path="/teach/attempts/:attemptId/grade" element={featureElement('/teach/attempts/:attemptId/grade', grader(<GradeEssayPage />))} />
      <Route path="/teach/courses/:courseId/preview" element={featureElement('/teach/courses/:courseId/preview', instructor(<CoursePreviewPage />))} />
      <Route path="/teach/courses/:courseId/learners" element={featureElement('/teach/courses/:courseId/learners', instructor(<InstructorLearnersPage />))} />
      <Route path="/teach/learners" element={featureElement('/teach/learners', instructor(<InstructorLearnersPage />))} />
      <Route path="/403" element={<Public><NoAccessPage /></Public>} />
      <Route path="*" element={<Public><NotFoundPage /></Public>} />
    </Routes>
  );
}

function RedirectCourseQuiz() {
  const location = useLocation();
  const { data } = useLms();
  const [, , , courseId, , itemId] = location.pathname.split('/');
  const item = data.courses.find((course) => course.id === courseId)?.chapters.flatMap((chapter) => chapter.items).find((entry) => entry.id === itemId);
  const quizId = item?.type === 'quiz' ? item.quizId : undefined;
  return <Navigate to={quizId ? `/learn/quizzes/${quizId}` : '/404'} replace />;
}
