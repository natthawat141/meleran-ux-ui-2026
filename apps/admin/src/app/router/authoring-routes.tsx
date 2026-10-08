import React from 'react';
import { Route } from 'react-router-dom';
import { featureElement } from '@legacy/components/FeatureRoute';
import { CourseOverviewPage } from '../../features/course-authoring/pages/CourseOverviewPage';
import { AdminCourseEditorPage } from '../../features/course-authoring/pages/CourseEditorPage';
import { CurriculumPage } from '../../features/course-authoring/pages/CurriculumPage';
import { ChapterWorkspace as ChapterEditorPage } from '../../features/course-authoring/pages/ChapterWorkspace';
import { ContentEditorPage } from '../../features/course-authoring/pages/ContentEditorPage';
import { QuizManagerPage } from '../../features/course-authoring/pages/QuizManagerPage';
import { QuizEditorPage } from '../../features/course-authoring/pages/QuizEditorPage';
import { CoursePreviewPage, InstructorLearnersPage } from '@legacy/pages/instructor/InsightPages';
import { admin } from './access';

export const authoringRoutes = (
  <>
    <Route path="/admin/courses/new" element={featureElement('/teach/courses/new', admin(<AdminCourseEditorPage />))} />
    <Route path="/admin/courses/:courseId/settings" element={featureElement('/teach/courses/:courseId/settings', admin(<AdminCourseEditorPage />))} />
    <Route path="/admin/courses/:courseId/overview" element={featureElement('/teach/courses/:courseId', admin(<CourseOverviewPage />))} />
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
