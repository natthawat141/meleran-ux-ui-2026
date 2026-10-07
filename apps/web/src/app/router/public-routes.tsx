import React from 'react';
import { Navigate, Route, useLocation, useParams } from 'react-router-dom';
import { featureElement } from '@legacy/components/FeatureRoute';
import { useLms } from '@legacy/store';
import { InstructorProfilePage } from '@legacy/pages/PublicPages';
import { PublicCatalogPage } from '@legacy/pages/public/CatalogPage';
import { PublicCourseDetailPage } from '@legacy/pages/public/CourseDetailPage';
import { LandingPage } from '@legacy/pages/landing/LandingPage';
import { AboutPage } from '@legacy/pages/landing/AboutPage';
import { BlogIndexPage, BlogArticlePage } from '@legacy/pages/blog/BlogPages';
import { Public } from './access';

function PublicCourseEntry({ detail = false }: { detail?: boolean }) {
  const { currentUser } = useLms();
  const location = useLocation();
  const { slug } = useParams<{ slug?: string }>();
  if (currentUser) {
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
