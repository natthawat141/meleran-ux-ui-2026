import React from 'react';
import { Route } from 'react-router-dom';
import { featureElement } from '@legacy/components/FeatureRoute';
import { InstructorDashboardPage, InstructorCoursesPage, CourseEditorPage, InstructorCourseOverviewPage } from '@legacy/pages/instructor/CoursePages';
import { CurriculumPage, ContentEditorPage } from '@legacy/pages/instructor/CurriculumPages';
import { ChapterWorkspace as ChapterEditorPage } from '@legacy/pages/instructor/ChapterWorkspace';
import { QuizManagerPage, QuizEditorPage, QuizAttemptsPage, GradeEssayPage } from '@legacy/pages/instructor/QuizPages';
import { CoursePreviewPage, InstructorLearnersPage } from '@legacy/pages/instructor/InsightPages';
import { LearnerReviewQueuePage } from '@legacy/pages/instructor/LearnerReviewQueuePage';
import { grader, instructor } from './access';

export const instructorRoutes = (
  <>
    <Route path="/teach" element={featureElement('/teach', instructor(<InstructorDashboardPage />))} />
    <Route path="/teach/reviews" element={featureElement('/teach/reviews', grader(<LearnerReviewQueuePage />))} />
    <Route path="/teach/courses" element={featureElement('/teach/courses', instructor(<InstructorCoursesPage />))} />
    <Route path="/teach/courses/new" element={featureElement('/teach/courses/new', instructor(<CourseEditorPage />))} />
    <Route path="/teach/courses/:courseId" element={featureElement('/teach/courses/:courseId', instructor(<InstructorCourseOverviewPage />))} />
    <Route path="/teach/courses/:courseId/settings" element={featureElement('/teach/courses/:courseId/settings', instructor(<CourseEditorPage />))} />
    <Route path="/teach/courses/:courseId/curriculum" element={featureElement('/teach/courses/:courseId/curriculum', instructor(<CurriculumPage />))} />
    <Route path="/teach/courses/:courseId/chapters/:chapterId" element={featureElement('/teach/courses/:courseId/chapters/:chapterId', instructor(<ChapterEditorPage />))} />
    <Route path="/teach/courses/:courseId/videos/:itemId" element={featureElement('/teach/courses/:courseId/videos/:itemId', instructor(<ContentEditorPage type="video" />))} />
    <Route path="/teach/courses/:courseId/articles/:itemId" element={featureElement('/teach/courses/:courseId/articles/:itemId', instructor(<ContentEditorPage type="article" />))} />
    <Route path="/teach/courses/:courseId/quizzes" element={featureElement('/teach/courses/:courseId/quizzes', instructor(<QuizManagerPage />))} />
    <Route path="/teach/quizzes" element={featureElement('/teach/quizzes', instructor(<QuizManagerPage />))} />
    <Route path="/teach/quizzes/:quizId" element={featureElement('/teach/quizzes/:quizId', instructor(<QuizEditorPage />))} />
    <Route path="/teach/quizzes/:quizId/attempts" element={featureElement('/teach/quizzes/:quizId/attempts', instructor(<QuizAttemptsPage />))} />
    <Route path="/teach/attempts/:attemptId/grade" element={featureElement('/teach/attempts/:attemptId/grade', grader(<GradeEssayPage />))} />
    <Route path="/teach/courses/:courseId/preview" element={featureElement('/teach/courses/:courseId/preview', instructor(<CoursePreviewPage />))} />
    <Route path="/teach/courses/:courseId/learners" element={featureElement('/teach/courses/:courseId/learners', instructor(<InstructorLearnersPage />))} />
    <Route path="/teach/learners" element={featureElement('/teach/learners', instructor(<InstructorLearnersPage />))} />
  </>
);
