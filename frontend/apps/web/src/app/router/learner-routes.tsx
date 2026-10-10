import React from 'react';
import { Route } from 'react-router-dom';
import { featureElement } from '@melearn/ui';
import { MemberCatalogPage } from '../../features/courses/pages/member/MemberCatalogPage';
import { MemberCourseDetailPage } from '../../features/courses/pages/member/MemberCourseDetailPage';
import { LearningCoursePage, LessonPage, MyCoursesPage, QuizAttemptPage, QuizResultPage, QuizStartPage, ServerCertificateDetailPage, ServerCertificatesPage } from '../../features/learning/pages/LearningPages';
import { ProfilePage } from '../../features/account/pages/ProfilePage';
import { RolePage, learner, accountUser, paymentUser } from './access';

const AiPage = React.lazy(() => import('../../features/ai/pages/ProvisionalAiPage').then((page) => ({ default: page.ProvisionalAiPage })));
const CheckoutPage = React.lazy(() => import('../../features/payment/pages/ProvisionalPaymentPages').then((page) => ({ default: page.ProvisionalCheckoutPage })));
const PaymentResultPage = React.lazy(() => import('../../features/payment/pages/ProvisionalPaymentPages').then((page) => ({ default: page.ProvisionalPaymentResultPage })));
const RedeemPage = React.lazy(() => import('../../features/payment/pages/ProvisionalPaymentPages').then((page) => ({ default: page.ProvisionalRedeemPage })));

function AiRoute() {
  return (
    <React.Suspense fallback={<div className="public-page">กำลังเปิด Melearn AI…</div>}>
      <AiPage />
    </React.Suspense>
  );
}

function CheckoutRoute({ result = false }: { result?: boolean }) {
  const Page = result ? PaymentResultPage : CheckoutPage;
  return (
    <React.Suspense fallback={<div className="public-page">กำลังโหลดข้อมูลชำระเงิน…</div>}>
      <Page />
    </React.Suspense>
  );
}

function RedeemRoute() {
  return (
    <React.Suspense fallback={<div className="public-page">กำลังเปิดหน้าแลกรหัส…</div>}>
      <RedeemPage />
    </React.Suspense>
  );
}

export const memberCatalogRoutes = (
  <>
    <Route path="/explore/courses" element={featureElement('/explore/courses', <RolePage roles={['learner', 'instructor']}><MemberCatalogPage /></RolePage>)} />
    <Route path="/explore/courses/:slug" element={featureElement('/explore/courses/:slug', <RolePage roles={['learner', 'instructor']}><MemberCourseDetailPage /></RolePage>)} />
  </>
);

export const learnerRoutes = (
  <>
    <Route path="/learn" element={featureElement('/learn', learner(<MyCoursesPage />))} />
    <Route path="/learn/courses" element={featureElement('/learn/courses', learner(<MyCoursesPage />))} />
    <Route path="/learn/redeem" element={featureElement('/learn/redeem', learner(<RedeemRoute />))} />
    <Route path="/learn/ai" element={featureElement('/learn/ai', <RolePage roles={['learner', 'instructor']} standalone><AiRoute /></RolePage>)} />
    <Route path="/learn/courses/:courseId" element={featureElement('/learn/courses/:courseId', learner(<LearningCoursePage />))} />
    <Route path="/learn/courses/:courseId/videos/:itemId" element={featureElement('/learn/courses/:courseId/videos/:itemId', learner(<LessonPage expectedType="video" />))} />
    <Route path="/learn/courses/:courseId/articles/:itemId" element={featureElement('/learn/courses/:courseId/articles/:itemId', learner(<LessonPage expectedType="article" />))} />
    <Route path="/learn/courses/:courseId/quizzes/:itemId" element={featureElement('/learn/courses/:courseId/quizzes/:itemId', learner(<QuizStartPage />))} />
    <Route path="/learn/quizzes/:quizId" element={featureElement('/learn/quizzes/:quizId', learner(<QuizStartPage />))} />
    <Route path="/learn/attempts/:attemptId" element={featureElement('/learn/attempts/:attemptId', learner(<QuizAttemptPage />))} />
    <Route path="/learn/attempts/:attemptId/result" element={featureElement('/learn/attempts/:attemptId/result', learner(<QuizResultPage />))} />
    <Route path="/checkout/:courseId" element={featureElement('/checkout/:courseId', paymentUser(<CheckoutRoute />))} />
    <Route path="/checkout/:orderId/result" element={featureElement('/checkout/:orderId/result', paymentUser(<CheckoutRoute result />))} />
    <Route path="/account/certificates" element={featureElement('/account/certificates', accountUser(<ServerCertificatesPage />))} />
    <Route path="/account/certificates/:certificateId" element={featureElement('/account/certificates/:certificateId', accountUser(<ServerCertificateDetailPage />))} />
    <Route path="/account/profile" element={featureElement('/account/profile', accountUser(<ProfilePage />))} />
  </>
);
