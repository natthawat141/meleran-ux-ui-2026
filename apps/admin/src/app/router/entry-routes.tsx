import React from 'react';
import { Navigate, Route } from 'react-router-dom';
import { LoginPage, VerifyEmailPage, DemoAccountPage } from '@legacy/pages/AuthPages';
import { BlogArticlePage } from '@legacy/pages/blog/BlogPages';

export const entryRoutes = (
  <>
    <Route path="/" element={<Navigate to="/admin" replace />} />
    <Route path="/login" element={<LoginPage audience="admin" />} />
    <Route path="/verify-email" element={<VerifyEmailPage />} />
    <Route path="/forgot-password" element={<DemoAccountPage type="forgot" />} />
    <Route path="/reset-password" element={<DemoAccountPage type="reset" />} />
    <Route path="/articles/:id" element={<BlogArticlePage />} />
  </>
);
