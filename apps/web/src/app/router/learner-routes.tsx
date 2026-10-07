import React from 'react';
import { Navigate, Route, useLocation } from 'react-router-dom';
import { featureElement } from '@legacy/components/FeatureRoute';
import { useLms } from '@legacy/store';
import { MemberCatalogPage } from '@legacy/pages/member/CatalogPage';
import { MemberCourseDetailPage } from '@legacy/pages/member/CourseDetailPage';
import { LearnerDashboardPage, MyCoursesPage } from '@legacy/pages/learner/DashboardPages';
import { LearnerCoursePage, VideoLessonPage, ArticleLessonPage } from '@legacy/pages/learner/LessonPages';
import { QuizIntroPage, QuizAttemptPage, QuizResultPage } from '@legacy/pages/learner/QuizPages';
import { RedeemCourseCodePage } from '@legacy/pages/learner/RedeemCourseCodePage';
import { CheckoutPage, CheckoutResultPage } from '@legacy/pages/learner/PaymentPages';
import { CertificatesPage, CertificateDetailPage, ProfilePage } from '@legacy/pages/learner/AccountPages';
import { RolePage, learner, accountUser, paymentUser } from './access';

const LearnerAiPage = React.lazy(() => import('@legacy/pages/learner/LearnerAiPage').then((page) => ({ default: page.LearnerAiPage })));

export const memberCatalogRoutes = (
  <>
    <Route path="/explore/courses" element={featureElement('/explore/courses', <RolePage roles={['learner', 'instructor']}><MemberCatalogPage /></RolePage>)} />
    <Route path="/explore/courses/:slug" element={featureElement('/explore/courses/:slug', <RolePage roles={['learner', 'instructor']}><MemberCourseDetailPage /></RolePage>)} />
  </>
);

export const learnerRoutes = (
  <>
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
  </>
);

function RedirectCourseQuiz() {
  const location = useLocation();
  const { data } = useLms();
  const [, , , courseId, , itemId] = location.pathname.split('/');
  const item = data.courses.find((course) => course.id === courseId)?.chapters.flatMap((chapter) => chapter.items).find((entry) => entry.id === itemId);
  const quizId = item?.type === 'quiz' ? item.quizId : undefined;
  return <Navigate to={quizId ? `/learn/quizzes/${quizId}` : '/404'} replace />;
}
