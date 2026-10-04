import React from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { PublicShell, WorkspaceShell } from './components/Shell.jsx';
import { useLms } from './store.jsx';
import { CatalogPage, CourseDetailPage, InstructorProfilePage } from './pages/PublicPages.jsx';
import { LandingPage } from './pages/landing/LandingPage.jsx';
import { AboutPage } from './pages/landing/AboutPage.jsx';
import { BlogIndexPage, BlogArticlePage } from './pages/blog/BlogPages.jsx';
import { AdminBlogPage, AdminBlogEditorPage } from './pages/admin/BlogAdminPages.jsx';
import { LoginPage, RegisterPage, BecomeInstructorPage, DemoAccountPage, VerifyEmailPage } from './pages/AuthPages.jsx';
import { LearnerDashboardPage, MyCoursesPage } from './pages/learner/DashboardPages.jsx';
import { LearnerCoursePage, VideoLessonPage, ArticleLessonPage } from './pages/learner/LessonPages.jsx';
import { QuizIntroPage, QuizAttemptPage, QuizResultPage } from './pages/learner/QuizPages.jsx';
import { CheckoutPage, CheckoutResultPage, OrdersPage, OrderDetailPage } from './pages/learner/CommercePages.jsx';
import { CertificatesPage, CertificateDetailPage, ProfilePage, VerifyCertificatePage } from './pages/learner/AccountPages.jsx';
import { InstructorDashboardPage, InstructorCoursesPage, CourseEditorPage, InstructorCourseOverviewPage } from './pages/instructor/CoursePages.jsx';
import { CurriculumPage, ContentEditorPage } from './pages/instructor/CurriculumPages.jsx';
import { ChapterWorkspace as ChapterEditorPage } from './pages/instructor/ChapterWorkspace.jsx';
import { QuizManagerPage, QuizEditorPage, QuizAttemptsPage, GradeEssayPage } from './pages/instructor/QuizPages.jsx';
import { CoursePreviewPage, InstructorLearnersPage } from './pages/instructor/InsightPages.jsx';
import { AdminDashboardPage, AdminUsersPage, AdminUserDetailPage, AdminInstructorRequestsPage, AdminInstructorRequestDetailPage, AdminCoursesPage, AdminCourseDetailPage } from './pages/admin/AdminPages.jsx';
import { NoAccessPage, NotFoundPage } from './pages/SystemPages.jsx';
import { AssignmentsPage } from './pages/AssignmentsPage.jsx';
import { AnalyticsPage } from './pages/AnalyticsPage.jsx';

function Public({ children }) { return <PublicShell>{children}</PublicShell>; }

function RolePage({ roles, children }) {
  const { currentUser, data } = useLms();
  const location = useLocation();
  const params = useParams();
  if (!currentUser) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace/>;
  if (!roles.includes(currentUser.role)) return <WorkspaceShell><NoAccessPage/></WorkspaceShell>;
  if (currentUser.role === 'instructor' && location.pathname.startsWith('/teach/')) {
    const attempt = data.attempts.find((item) => item.id === params.attemptId);
    const quiz = data.quizzes.find((item) => item.id === params.quizId);
    const courseId = params.courseId ?? quiz?.courseId ?? attempt?.courseId ?? new URLSearchParams(location.search).get('course');
    const course = data.courses.find((item) => item.id === courseId);
    if (course && course.instructorId !== currentUser.id) return <WorkspaceShell><NoAccessPage/></WorkspaceShell>;
  }
  return <WorkspaceShell>{children}</WorkspaceShell>;
}

const learner = (element) => <RolePage roles={['learner', 'admin']}>{element}</RolePage>;
const instructor = (element) => <RolePage roles={['instructor', 'admin']}>{element}</RolePage>;
const admin = (element) => <RolePage roles={['admin']}>{element}</RolePage>;

export function AppRoutes() {
  return <Routes>
    <Route path="/" element={<LandingPage/>}/>
    <Route path="/about" element={<AboutPage/>}/>
    <Route path="/courses" element={<Public><CatalogPage/></Public>}/>
    <Route path="/courses/:slug" element={<Public><CourseDetailPage/></Public>}/>
    <Route path="/articles" element={<BlogIndexPage/>}/>
    <Route path="/articles/:id" element={<BlogArticlePage/>}/>
    <Route path="/instructors/:id" element={<Public><InstructorProfilePage/></Public>}/>
    <Route path="/login" element={<LoginPage/>}/>
    <Route path="/register" element={<RegisterPage/>}/>
    <Route path="/become-instructor" element={<Public><BecomeInstructorPage/></Public>}/>
    <Route path="/invite/:token" element={<DemoAccountPage type="invite"/>}/>
    <Route path="/verify-email" element={<VerifyEmailPage/>}/>
    <Route path="/forgot-password" element={<DemoAccountPage type="forgot"/>}/>
    <Route path="/reset-password" element={<DemoAccountPage type="reset"/>}/>

    <Route path="/learn" element={learner(<LearnerDashboardPage/>)}/>
    <Route path="/learn/courses" element={learner(<MyCoursesPage/>)}/>
    <Route path="/learn/courses/:courseId" element={learner(<LearnerCoursePage/>)}/>
    <Route path="/learn/courses/:courseId/videos/:itemId" element={learner(<VideoLessonPage/>)}/>
    <Route path="/learn/courses/:courseId/articles/:itemId" element={learner(<ArticleLessonPage/>)}/>
    <Route path="/learn/courses/:courseId/quizzes/:itemId" element={learner(<RedirectCourseQuiz/>)}/>
    <Route path="/learn/assignments" element={learner(<AssignmentsPage/>)}/>
    <Route path="/learn/quizzes/:quizId" element={learner(<QuizIntroPage/>)}/>
    <Route path="/learn/attempts/:attemptId" element={learner(<QuizAttemptPage/>)}/>
    <Route path="/learn/attempts/:attemptId/result" element={learner(<QuizResultPage/>)}/>
    <Route path="/checkout/:courseId" element={learner(<CheckoutPage/>)}/>
    <Route path="/checkout/:orderId/result" element={learner(<CheckoutResultPage/>)}/>
    <Route path="/account/orders" element={learner(<OrdersPage/>)}/>
    <Route path="/account/orders/:orderId" element={learner(<OrderDetailPage/>)}/>
    <Route path="/account/certificates" element={learner(<CertificatesPage/>)}/>
    <Route path="/account/certificates/:certificateId" element={learner(<CertificateDetailPage/>)}/>
    <Route path="/account/profile" element={<RolePage roles={['learner','instructor','admin']}><ProfilePage/></RolePage>}/>

    <Route path="/teach" element={instructor(<InstructorDashboardPage/>)}/>
    <Route path="/teach/courses" element={instructor(<InstructorCoursesPage/>)}/>
    <Route path="/teach/courses/new" element={instructor(<CourseEditorPage/>)}/>
    <Route path="/teach/courses/:courseId" element={instructor(<InstructorCourseOverviewPage/>)}/>
    <Route path="/teach/courses/:courseId/settings" element={instructor(<CourseEditorPage/>)}/>
    <Route path="/teach/courses/:courseId/curriculum" element={instructor(<CurriculumPage/>)}/>
    <Route path="/teach/courses/:courseId/chapters/:chapterId" element={instructor(<ChapterEditorPage/>)}/>
    <Route path="/teach/courses/:courseId/videos/:itemId" element={instructor(<ContentEditorPage type="video"/>)}/>
    <Route path="/teach/courses/:courseId/articles/:itemId" element={instructor(<ContentEditorPage type="article"/>)}/>
    <Route path="/teach/courses/:courseId/quizzes" element={instructor(<QuizManagerPage/>)}/>
    <Route path="/teach/quizzes" element={instructor(<QuizManagerPage/>)}/>
    <Route path="/teach/assignments" element={instructor(<AssignmentsPage/>)}/>
    <Route path="/teach/analytics" element={instructor(<AnalyticsPage/>)}/>
    <Route path="/teach/quizzes/:quizId" element={instructor(<QuizEditorPage/>)}/>
    <Route path="/teach/quizzes/:quizId/attempts" element={instructor(<QuizAttemptsPage/>)}/>
    <Route path="/teach/attempts/:attemptId/grade" element={instructor(<GradeEssayPage/>)}/>
    <Route path="/teach/courses/:courseId/preview" element={instructor(<CoursePreviewPage/>)}/>
    <Route path="/teach/courses/:courseId/learners" element={instructor(<InstructorLearnersPage/>)}/>
    <Route path="/teach/learners" element={instructor(<InstructorLearnersPage/>)}/>

    <Route path="/admin" element={admin(<AdminDashboardPage/>)}/>
    <Route path="/admin/articles" element={admin(<AdminBlogPage/>)}/>
    <Route path="/admin/articles/new" element={admin(<AdminBlogEditorPage/>)}/>
    <Route path="/admin/articles/:id/edit" element={admin(<AdminBlogEditorPage/>)}/>
    <Route path="/admin/users" element={admin(<AdminUsersPage/>)}/>
    <Route path="/admin/users/:id" element={admin(<AdminUserDetailPage/>)}/>
    <Route path="/admin/instructors" element={admin(<AdminInstructorRequestsPage/>)}/>
    <Route path="/admin/instructors/:id" element={admin(<AdminInstructorRequestDetailPage/>)}/>
    <Route path="/admin/courses" element={admin(<AdminCoursesPage/>)}/>
    <Route path="/admin/courses/:courseId" element={admin(<AdminCourseDetailPage/>)}/>
    <Route path="/admin/assignments" element={admin(<AssignmentsPage/>)}/>
    <Route path="/admin/analytics" element={admin(<AnalyticsPage/>)}/>
    <Route path="/admin/orders" element={admin(<OrdersPage/>)}/>
    <Route path="/admin/orders/:orderId" element={admin(<OrderDetailPage/>)}/>
    <Route path="/admin/certificates" element={admin(<CertificatesPage/>)}/>

    <Route path="/certificates/verify/:code" element={<Public><VerifyCertificatePage/></Public>}/>
    <Route path="/403" element={<Public><NoAccessPage/></Public>}/>
    <Route path="*" element={<Public><NotFoundPage/></Public>}/>
  </Routes>;
}

function RedirectCourseQuiz() {
  const location = useLocation();
  const parts = location.pathname.split('/');
  const { data } = useLms();
  const item = data.courses.find((course) => course.id === parts[3])?.chapters.flatMap((chapter) => chapter.items).find((entry) => entry.id === parts[5]);
  return <Navigate to={item?.quizId ? `/learn/quizzes/${item.quizId}` : '/404'} replace/>;
}
