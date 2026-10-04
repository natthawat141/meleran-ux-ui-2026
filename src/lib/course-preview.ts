interface PreviewItem {
  id: string;
  title: string;
  type: 'video' | 'article';
  videoUrl?: string;
  duration?: string;
  description?: string;
  content?: string;
  articleBody?: string;
  articleDoc?: unknown;
  readingMinutes?: number;
}

type CourseContentItem = PreviewItem | { type: 'quiz' };

interface PreviewChapter {
  title: string;
  items: CourseContentItem[];
}

interface PreviewCourse {
  chapters: PreviewChapter[];
}

export function getCoursePreviewLesson(course: PreviewCourse) {
  for (const chapter of course.chapters) {
    const item = chapter.items.find((entry) => entry.type === 'video' || entry.type === 'article');
    if (item && (item.type === 'video' || item.type === 'article')) return { chapter, item };
  }
  return undefined;
}
