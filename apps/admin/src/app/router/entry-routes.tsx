import React from 'react';
import { Navigate, Route } from 'react-router-dom';
import { LoginPage, VerifyEmailPage, DemoAccountPage } from '../../features/auth/pages/AuthPages';
import { BlogArticlePreviewPage } from '../../features/blog/pages/BlogArticlePreviewPage';

export const entryRoutes = (
  <>
    <Route path="/" element={<Navigate to="/admin" replace />} />
    <Route path="/login" element={<LoginPage audience="admin" />} />
    <Route path="/verify-email" element={<VerifyEmailPage />} />
    <Route path="/forgot-password" element={<DemoAccountPage type="forgot" />} />
    <Route path="/reset-password" element={<DemoAccountPage type="reset" />} />
    <Route path="/articles/:id" element={<BlogArticlePreviewPage />} />
  </>
);
