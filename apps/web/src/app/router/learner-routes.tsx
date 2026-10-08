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
const ProvisionalAiPage = import.meta.env.DEV ? React.lazy(() => import('../../features/ai/pages/ProvisionalAiPage').then((page) => ({ default: page.ProvisionalAiPage }))) : null;
const ProvisionalCheckoutPage = import.meta.env.DEV ? React.lazy(() => import('../../features/payment/pages/ProvisionalPaymentPages').then((page) => ({ default: page.ProvisionalCheckoutPage }))) : null;
const ProvisionalPaymentResultPage = import.meta.env.DEV ? React.lazy(() => import('../../features/payment/pages/ProvisionalPaymentPages').then((page) => ({ default: page.ProvisionalPaymentResultPage }))) : null;
const ProvisionalRedeemPage = import.meta.env.DEV ? React.lazy(() => import('../../features/payment/pages/ProvisionalPaymentPages').then((page) => ({ default: page.ProvisionalRedeemPage }))) : null;

function AiRoute() {
  return import.meta.env.DEV && ProvisionalAiPage
    ? <React.Suspense fallback={<div className="public-page">กำลังเปิด Melearn AI…</div>}><ProvisionalAiPage /></React.Suspense>
    : <React.Suspense fallback={<div className="public-page">กำลังเปิด Melearn AI…</div>}><LearnerAiPage /></React.Suspense>;
}
function CheckoutRoute({ result = false }: { result?: boolean }) {
  if (import.meta.env.DEV && (result ? ProvisionalPaymentResultPage : ProvisionalCheckoutPage)) {
    const Page = result ? ProvisionalPaymentResultPage! : ProvisionalCheckoutPage!;
    return <React.Suspense fallback={<div className="public-page">กำลังโหลดข้อมูลชำระเงิน…</div>}><Page /></React.Suspense>;
  }
  return result ? <CheckoutResultPage /> : <CheckoutPage />;
}
function RedeemRoute() {
  return import.meta.env.DEV && ProvisionalRedeemPage
    ? <React.Suspense fallback={<div className="public-page">กำลังเปิดหน้าแลกรหัส…</div>}><ProvisionalRedeemPage /></React.Suspense>
    : <RedeemCourseCodePage />;
}

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
    <Route path="/learn/redeem" element={featureElement('/learn/redeem', learner(<RedeemRoute />))} />
    <Route path="/learn/ai" element={featureElement('/learn/ai', <RolePage roles={['learner', 'instructor']} standalone><AiRoute /></RolePage>)} />
    <Route path="/learn/courses/:courseId" element={featureElement('/learn/courses/:courseId', learner(import.meta.env.DEV ? <LearningCoursePage /> : <LearnerCoursePage />))} />
    <Route path="/learn/courses/:courseId/videos/:itemId" element={featureElement('/learn/courses/:courseId/videos/:itemId', learner(import.meta.env.DEV ? <LessonPage expectedType="video" /> : <VideoLessonPage />))} />
    <Route path="/learn/courses/:courseId/articles/:itemId" element={featureElement('/learn/courses/:courseId/articles/:itemId', learner(import.meta.env.DEV ? <LessonPage expectedType="article" /> : <ArticleLessonPage />))} />
    <Route path="/learn/courses/:courseId/quizzes/:itemId" element={featureElement('/learn/courses/:courseId/quizzes/:itemId', learner(import.meta.env.DEV ? <QuizStartPage /> : <QuizIntroPage />))} />
    <Route path="/learn/quizzes/:quizId" element={featureElement('/learn/quizzes/:quizId', learner(import.meta.env.DEV ? <QuizStartPage /> : <QuizIntroPage />))} />
    <Route path="/learn/attempts/:attemptId" element={featureElement('/learn/attempts/:attemptId', learner(import.meta.env.DEV ? <QuizAttemptPage /> : <LegacyQuizAttemptPage />))} />
    <Route path="/learn/attempts/:attemptId/result" element={featureElement('/learn/attempts/:attemptId/result', learner(import.meta.env.DEV ? <QuizResultPage /> : <LegacyQuizResultPage />))} />
    <Route path="/checkout/:courseId" element={featureElement('/checkout/:courseId', paymentUser(<CheckoutRoute />))} />
    <Route path="/checkout/:orderId/result" element={featureElement('/checkout/:orderId/result', paymentUser(<CheckoutRoute result />))} />
    <Route path="/account/certificates" element={featureElement('/account/certificates', accountUser(import.meta.env.DEV ? <ServerCertificatesPage /> : <CertificatesPage />))} />
    <Route path="/account/certificates/:certificateId" element={featureElement('/account/certificates/:certificateId', accountUser(import.meta.env.DEV ? <ServerCertificateDetailPage /> : <CertificateDetailPage />))} />
    <Route path="/account/profile" element={featureElement('/account/profile', accountUser(<ProfilePage />))} />
  </>
);
