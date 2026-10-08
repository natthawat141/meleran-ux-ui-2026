import React from 'react';
import { Route } from 'react-router-dom';
import { featureElement } from '@legacy/components/FeatureRoute';
import { AdminDashboardPage, AdminUsersPage, AdminUserDetailPage, AdminInstructorsPage, AdminCoursesPage, AdminCourseDetailPage } from '../../features/management/pages/AdminPages';
import { CourseReviewPage } from '@legacy/pages/admin/CourseReviewPage';
import { AccessCodesPage } from '@legacy/pages/admin/AccessCodesPage';
import { AdminBlogPage, AdminBlogEditorPage } from '../../features/blog/pages/BlogAdminPages';
import { ProfilePage } from '../../features/account/pages/ProfilePage';
import { admin } from './access';

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
    <Route path="/admin/access-codes" element={featureElement('/admin/access-codes', admin(<AccessCodesPage />))} />
    <Route path="/account/profile" element={featureElement('/account/profile', admin(<ProfilePage />))} />
  </>
);
