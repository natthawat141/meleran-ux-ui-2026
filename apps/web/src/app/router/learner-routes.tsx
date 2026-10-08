import React from 'react';
import { Route } from 'react-router-dom';
import { featureElement } from '@legacy/components/FeatureRoute';
import { MemberCatalogPage } from '@legacy/pages/member/CatalogPage';
import { MemberCourseDetailPage } from '@legacy/pages/member/CourseDetailPage';
import { RedeemCourseCodePage } from '@legacy/pages/learner/RedeemCourseCodePage';
import { LearnerDashboardPage, MyCoursesPage as LegacyMyCoursesPage } from '@legacy/pages/learner/DashboardPages';
import { LearnerCoursePage, VideoLessonPage, ArticleLessonPage } from '@legacy/pages/learner/LessonPages';
import { QuizIntroPage, QuizAttemptPage as LegacyQuizAttemptPage, QuizResultPage as LegacyQuizResultPage } from '@legacy/pages/learner/QuizPages';
import { CertificatesPage, CertificateDetailPage } from '../../features/certificate/pages/AccountPages';
import { CheckoutPage, CheckoutResultPage } from '@legacy/pages/learner/PaymentPages';
import { LearningCoursePage, LessonPage, MyCoursesPage, QuizAttemptPage, QuizResultPage, QuizStartPage, ServerCertificateDetailPage, ServerCertificatesPage } from '../../features/learning/pages/LearningPages';
import { ProfilePage } from '../../features/account/pages/ProfilePage';
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
    <Route path="/learn" element={featureElement('/learn', learner(import.meta.env.DEV ? <MyCoursesPage /> : <LearnerDashboardPage />))} />
    <Route path="/learn/courses" element={featureElement('/learn/courses', learner(import.meta.env.DEV ? <MyCoursesPage /> : <LegacyMyCoursesPage />))} />
    <Route path="/learn/redeem" element={featureElement('/learn/redeem', learner(<RedeemCourseCodePage />))} />
    <Route path="/learn/ai" element={featureElement('/learn/ai', <RolePage roles={['learner', 'instructor']} standalone><React.Suspense fallback={<div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>กำลังเปิด Melearn AI…</div>}><LearnerAiPage /></React.Suspense></RolePage>)} />
    <Route path="/learn/courses/:courseId" element={featureElement('/learn/courses/:courseId', learner(import.meta.env.DEV ? <LearningCoursePage /> : <LearnerCoursePage />))} />
    <Route path="/learn/courses/:courseId/videos/:itemId" element={featureElement('/learn/courses/:courseId/videos/:itemId', learner(import.meta.env.DEV ? <LessonPage expectedType="video" /> : <VideoLessonPage />))} />
    <Route path="/learn/courses/:courseId/articles/:itemId" element={featureElement('/learn/courses/:courseId/articles/:itemId', learner(import.meta.env.DEV ? <LessonPage expectedType="article" /> : <ArticleLessonPage />))} />
    <Route path="/learn/courses/:courseId/quizzes/:itemId" element={featureElement('/learn/courses/:courseId/quizzes/:itemId', learner(import.meta.env.DEV ? <QuizStartPage /> : <QuizIntroPage />))} />
    <Route path="/learn/quizzes/:quizId" element={featureElement('/learn/quizzes/:quizId', learner(import.meta.env.DEV ? <QuizStartPage /> : <QuizIntroPage />))} />
    <Route path="/learn/attempts/:attemptId" element={featureElement('/learn/attempts/:attemptId', learner(import.meta.env.DEV ? <QuizAttemptPage /> : <LegacyQuizAttemptPage />))} />
    <Route path="/learn/attempts/:attemptId/result" element={featureElement('/learn/attempts/:attemptId/result', learner(import.meta.env.DEV ? <QuizResultPage /> : <LegacyQuizResultPage />))} />
    <Route path="/checkout/:courseId" element={featureElement('/checkout/:courseId', paymentUser(<CheckoutPage />))} />
    <Route path="/checkout/:orderId/result" element={featureElement('/checkout/:orderId/result', paymentUser(<CheckoutResultPage />))} />
    <Route path="/account/certificates" element={featureElement('/account/certificates', accountUser(import.meta.env.DEV ? <ServerCertificatesPage /> : <CertificatesPage />))} />
    <Route path="/account/certificates/:certificateId" element={featureElement('/account/certificates/:certificateId', accountUser(import.meta.env.DEV ? <ServerCertificateDetailPage /> : <CertificateDetailPage />))} />
    <Route path="/account/profile" element={featureElement('/account/profile', accountUser(<ProfilePage />))} />
  </>
);
