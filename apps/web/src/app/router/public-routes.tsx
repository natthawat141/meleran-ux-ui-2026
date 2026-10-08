import React from 'react';
import { Navigate, Route, useLocation, useParams } from 'react-router-dom';
import { featureElement } from '@legacy/components/FeatureRoute';
import { useLms } from '@legacy/store';
import { InstructorProfilePage } from '../../features/instructors/pages/InstructorProfilePage';
import { PublicCatalogPage } from '../../features/courses/pages/public/CatalogPage';
import { PublicCourseDetailPage } from '../../features/courses/pages/public/CourseDetailPage';
import { LandingPage } from '../../features/landing/pages/LandingPage';
import { AboutPage } from '../../features/landing/pages/AboutPage';
import { BlogIndexPage, BlogArticlePage } from '../../features/blog/pages/BlogPages';
import { useAuthSession } from '../../features/auth/api/AuthSessionProvider';
import { Public } from './access';

function PublicCourseEntry({ detail = false }: { detail?: boolean }) {
  const { currentUser } = useLms();
  const session = useAuthSession();
  const location = useLocation();
  const { slug } = useParams<{ slug?: string }>();
  // In dev, the provisional API session is authoritative and /courses stays
  // the shared Catalog for guests and signed-in learners. Keep the legacy
  // member-catalog redirect only for the local prototype runtime.
  if (!session.enabled && currentUser) {
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
