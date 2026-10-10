import React from 'react';
import { Route } from 'react-router-dom';
import { featureElement } from '@melearn/ui';
import { LoginPage, RegisterPage, DemoAccountPage, VerifyEmailPage } from '../../features/auth/pages/AuthPages';

export const authRoutes = (
  <>
    <Route path="/login" element={featureElement('/login', <LoginPage />)} />
    <Route path="/register" element={featureElement('/register', <RegisterPage />)} />
    <Route path="/verify-email" element={featureElement('/verify-email', <VerifyEmailPage />)} />
    <Route path="/forgot-password" element={featureElement('/forgot-password', <DemoAccountPage type="forgot" />)} />
    <Route path="/reset-password" element={featureElement('/reset-password', <DemoAccountPage type="reset" />)} />
  </>
);
