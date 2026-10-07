import React from 'react';
import { Route } from 'react-router-dom';
import { featureElement } from '@legacy/components/FeatureRoute';
import { CourseEditorPage, InstructorCourseOverviewPage } from '@legacy/pages/instructor/CoursePages';
import { CurriculumPage, ContentEditorPage } from '@legacy/pages/instructor/CurriculumPages';
import { ChapterWorkspace as ChapterEditorPage } from '@legacy/pages/instructor/ChapterWorkspace';
import { QuizManagerPage, QuizEditorPage } from '@legacy/pages/instructor/QuizPages';
import { CoursePreviewPage, InstructorLearnersPage } from '@legacy/pages/instructor/InsightPages';
import { admin } from './access';

export const authoringRoutes = (
  <>
    <Route path="/admin/courses/new" element={featureElement('/teach/courses/new', admin(<CourseEditorPage />))} />
    <Route path="/admin/courses/:courseId/settings" element={featureElement('/teach/courses/:courseId/settings', admin(<CourseEditorPage />))} />
    <Route path="/admin/courses/:courseId/overview" element={featureElement('/teach/courses/:courseId', admin(<InstructorCourseOverviewPage />))} />
    <Route path="/admin/courses/:courseId/curriculum" element={featureElement('/teach/courses/:courseId/curriculum', admin(<CurriculumPage />))} />
    <Route path="/admin/courses/:courseId/chapters/:chapterId" element={featureElement('/teach/courses/:courseId/chapters/:chapterId', admin(<ChapterEditorPage />))} />
    <Route path="/admin/courses/:courseId/videos/:itemId" element={featureElement('/teach/courses/:courseId/videos/:itemId', admin(<ContentEditorPage type="video" />))} />
    <Route path="/admin/courses/:courseId/articles/:itemId" element={featureElement('/teach/courses/:courseId/articles/:itemId', admin(<ContentEditorPage type="article" />))} />
    <Route path="/admin/courses/:courseId/quizzes" element={featureElement('/teach/courses/:courseId/quizzes', admin(<QuizManagerPage />))} />
    <Route path="/admin/quizzes" element={featureElement('/teach/quizzes', admin(<QuizManagerPage />))} />
    <Route path="/admin/quizzes/:quizId" element={featureElement('/teach/quizzes/:quizId', admin(<QuizEditorPage />))} />
    <Route path="/admin/courses/:courseId/preview" element={featureElement('/teach/courses/:courseId/preview', admin(<CoursePreviewPage />))} />
    <Route path="/admin/courses/:courseId/learners" element={featureElement('/teach/courses/:courseId/learners', admin(<InstructorLearnersPage />))} />
    <Route path="/admin/learners" element={featureElement('/teach/learners', admin(<InstructorLearnersPage />))} />
  </>
);
