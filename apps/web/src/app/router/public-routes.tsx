import React from 'react';
import { Navigate, Route, useLocation, useParams } from 'react-router-dom';
import { featureElement } from '@melearn/ui';
import { InstructorProfilePage } from '../../features/instructors/pages/InstructorProfilePage';
import { PublicCatalogPage } from '../../features/courses/pages/public/CatalogPage';
import { PublicCourseDetailPage } from '../../features/courses/pages/public/CourseDetailPage';
import { LandingPage } from '../../features/landing/pages/LandingPage';
import { AboutPage } from '../../features/landing/pages/AboutPage';
import { BlogIndexPage, BlogArticlePage } from '../../features/blog/pages/BlogPages';
import { useAuthSession } from '../../features/auth/api/AuthSessionProvider';
import { Public } from './access';

function PublicCourseEntry({ detail = false }: { detail?: boolean }) {
  const session = useAuthSession();
  const location = useLocation();
  const { slug } = useParams<{ slug?: string }>();
  if (!session.enabled && session.user) {
    return <Navigate to={`/explore/courses${detail && slug ? `/${encodeURIComponent(slug)}` : ''}${location.search}${location.hash}`} replace />;
  }
  return <Public>{detail ? <PublicCourseDetailPage /> : <PublicCatalogPage />}</Public>;
}

export const publicEntryRoutes = (
  <>
    <Route path="/" element={featureElement('/', <LandingPage />)} />
    <Route path="/about" element={featureElement('/about', <AboutPage />)} />
    <Route path="/courses" element={featureElement('/courses', <PublicCourseEntry />)} />
    <Route path="/courses/:slug" element={featureElement('/courses/:slug', <PublicCourseEntry detail />)} />
  </>
);

export const publicContentRoutes = (
  <>
    <Route path="/articles" element={featureElement('/articles', <BlogIndexPage />)} />
    <Route path="/articles/:id" element={featureElement('/articles/:id', <BlogArticlePage />)} />
    <Route path="/instructors/:id" element={featureElement('/instructors/:id', <Public><InstructorProfilePage /></Public>)} />
  </>
);
