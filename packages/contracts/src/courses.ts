import type { Money } from './common.ts';

export type CourseStatus = 'draft' | 'pending_review' | 'approved' | 'published' | 'archived';
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced' | string;
export type CourseItemType = 'article' | 'video' | 'quiz';

export interface VideoItem {
  id: string;
  type: 'video';
  title: string;
  videoUrl?: string;
  duration?: string;
  description?: string;
  summary?: string;
  videoFilename?: string;
  transcript?: string;
  transcriptUpdatedAt?: string;
  transcriptUpdatedBy?: string;
}

export interface ArticleItem {
  id: string;
  type: 'article';
  title: string;
  content?: string;
  articleBody?: string;
  articleDoc?: unknown;
  readingMinutes?: number;
}

export interface QuizItem {
  id: string;
  type: 'quiz';
  title: string;
  quizId: string;
  duration?: string;
}

export type CourseItem = VideoItem | ArticleItem | QuizItem;

export interface Chapter {
  id: string;
  title: string;
  description?: string;
  items: CourseItem[];
}

export interface CourseReviewEvent {
  action: 'submitted' | 'approved' | 'returned' | 'published' | 'approval_invalidated';
  actorId: string;
  at: string;
  reason?: string;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  description?: string;
  category: string;
  level: CourseLevel;
  price: number;
  instructorId: string;
  status: CourseStatus;
  cover: string;
  chapters: Chapter[];
  outcomes?: string[];
  updatedAt?: string;
  createdAt?: string;
  publishedAt?: string | null;
  reviewHistory?: CourseReviewEvent[];
  aiEnabled?: boolean;
}

export interface InstructorSummary {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface CourseSummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  cover_url: string | null;
  category: string;
  level: string;
  price: Money | null;
  instructor: InstructorSummary;
  published_at: string;
}

export interface CourseOutlineItemSummary {
  id: string;
  type: CourseItemType;
  title: string;
}

export interface CourseOutlineChapterSummary {
  id: string;
  title: string;
  items: CourseOutlineItemSummary[];
}

export interface CourseDetail extends CourseSummary {
  description: string | null;
  outcomes: string[];
  outline: CourseOutlineChapterSummary[];
}

export interface CoursePage { items: CourseSummary[]; next_cursor: string | null }
