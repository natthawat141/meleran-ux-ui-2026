import React from 'react';
import { Route } from 'react-router-dom';
import { featureElement } from '@melearn/ui';
import { AdminDashboardPage, AdminUsersPage, AdminUserDetailPage, AdminInstructorsPage, AdminCoursesPage, AdminCourseDetailPage } from '../../features/management/pages/AdminPages';
import { CourseReviewPage } from '../../features/course-approval/pages/CourseReviewPage';
import { AccessCodesPage } from '../../features/management/pages/AccessCodesPage';
import { AdminBlogPage, AdminBlogEditorPage } from '../../features/blog/pages/BlogAdminPages';
import { ProfilePage } from '../../features/account/pages/ProfilePage';
import { admin } from './access';

const ProvisionalAccessCodesPage = import.meta.env.DEV ? React.lazy(() => import('../../features/redeem/pages/ProvisionalAccessCodesPage').then((page) => ({ default: page.ProvisionalAccessCodesPage }))) : null;
const ProvisionalAiAdminPage = import.meta.env.DEV ? React.lazy(() => import('../../features/ai/pages/ProvisionalAiAdminPage').then((page) => ({ default: page.ProvisionalAiAdminPage }))) : null;
const ProvisionalPaymentLookupPage = import.meta.env.DEV ? React.lazy(() => import('../../features/payment/pages/ProvisionalPaymentLookupPage').then((page) => ({ default: page.ProvisionalPaymentLookupPage }))) : null;
function AccessCodesRoute() {
  return import.meta.env.DEV && ProvisionalAccessCodesPage
    ? <React.Suspense fallback={<div className="public-page">กำลังโหลดรหัสแลกคอร์ส…</div>}><ProvisionalAccessCodesPage /></React.Suspense>
    : <AccessCodesPage />;
}
function AiAdminRoute() {
  return import.meta.env.DEV && ProvisionalAiAdminPage
    ? <React.Suspense fallback={<div className="public-page">กำลังโหลดการตั้งค่า AI…</div>}><ProvisionalAiAdminPage /></React.Suspense>
    : <div className="public-page">หน้า AI Admin เปิดใช้เมื่อ API พร้อมเท่านั้น</div>;
}
function PaymentLookupRoute() {
  return import.meta.env.DEV && ProvisionalPaymentLookupPage
    ? <React.Suspense fallback={<div className="public-page">กำลังโหลดรายการ Payment…</div>}><ProvisionalPaymentLookupPage /></React.Suspense>
    : <div className="public-page">หน้า Payment Admin ใช้ได้เมื่อ API พร้อมเท่านั้น</div>;
}

export const managementRoutes = (
  <>
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
    <Route path="/admin/access-codes" element={featureElement('/admin/access-codes', admin(<AccessCodesRoute />))} />
    <Route path="/admin/payments" element={featureElement('/admin/payments', admin(<PaymentLookupRoute />))} />
    <Route path="/admin/ai" element={featureElement('/admin/ai', admin(<AiAdminRoute />))} />
    <Route path="/account/profile" element={featureElement('/account/profile', admin(<ProfilePage />))} />
  </>
);
