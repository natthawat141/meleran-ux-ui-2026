import type { Chapter, Course, CourseItem, CourseReviewEvent } from './courses.ts';
import type { Quiz } from './assessment.ts';

export interface CourseDraft extends Course {
  dirty?: boolean;
}

export interface ChapterDraft extends Chapter {
  dirty?: boolean;
}

export interface QuizDraft extends Quiz {
  dirty?: boolean;
}

export type { CourseItem, CourseReviewEvent };
