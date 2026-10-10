/** Pure form/view mapping. No HTTP, query cache, permissions or persistence in this package. */
import type {
  AuthoringCourseDto,
  ManagedCourseSummaryDto,
  Course,
  Quiz,
  Question,
  AuthoringChapterWrite,
  AuthoringQuestionDto,
  AuthoringQuestionWrite,
} from '@melearn/contracts';
export type EditorCourse = Course & {
  revision: number;
  enrollmentCount: number;
  itemHistory: Record<string, boolean>;
  reviewId?: string;
};
export type EditorQuiz = Quiz & { questionCount: number; attemptCount: number };
export function questionView(q: AuthoringQuestionDto): Question {
  const common = { id: q.id, prompt: q.prompt, promptDoc: q.prompt_doc ?? undefined, points: q.points };
  return q.type === 'single_choice' || q.type === 'multiple_choice'
    ? {
        ...common,
        type: 'choice',
        options: (q.options ?? []).map((o) => o.text),
        answer: (q.options ?? []).findIndex((o) => q.correct_option_ids?.includes(o.id)),
      }
    : {
        ...common,
        type: 'essay',
        rubric: q.rubric ?? undefined,
        responseMode: q.response_mode ?? (q.type === 'image' ? 'image' : 'either'),
      };
}
export function authoringForm(dto: AuthoringCourseDto | ManagedCourseSummaryDto): {
  course: EditorCourse;
  quizzes: EditorQuiz[];
} {
  const quizzes: EditorQuiz[] = [];
  const history: Record<string, boolean> = {};
  const chapters = dto.chapters.map((c) => ({
    id: c.id,
    title: c.title,
    description: 'description' in c ? c.description : undefined,
    items: c.items.map((i) => {
      history[i.id] = i.has_history;
      if (i.type === 'quiz') {
        const q = i.quiz;
        const questions = q && 'questions' in q ? q.questions.map(questionView) : [];
        quizzes.push({
          id: i.id,
          courseId: dto.id,
          chapterId: c.id,
          title: i.title,
          passPercent: 70,
          questions,
          questionCount: q ? ('questions' in q ? q.questions.length : q.question_count) : 0,
          attemptCount: q && 'attempt_count' in q ? q.attempt_count : 0,
        });
        return { id: i.id, type: 'quiz' as const, title: i.title, quizId: i.id };
      }
      return i.type === 'article'
        ? {
            id: i.id,
            type: 'article' as const,
            title: i.title,
            articleBody: 'body' in i ? i.body : undefined,
            articleDoc: 'body_doc' in i ? i.body_doc : undefined,
            readingMinutes: 'reading_minutes' in i ? i.reading_minutes : undefined,
          }
        : {
            id: i.id,
            type: 'video' as const,
            title: i.title,
            videoUrl: 'video_url' in i ? i.video_url : undefined,
            description: 'description' in i ? i.description : undefined,
            duration: 'duration' in i ? i.duration : undefined,
          };
    }),
  }));
  const r = dto.latest_review;
  return {
    course: {
      id: dto.id,
      slug: dto.slug,
      title: dto.title,
      subtitle: dto.subtitle ?? undefined,
      description: dto.description ?? undefined,
      cover: dto.cover_url ?? '',
      category: dto.category,
      level: dto.level,
      price: (dto.price?.amount_minor ?? 0) / 100,
      instructorId: dto.instructor.id,
      status: dto.status,
      chapters,
      outcomes: dto.outcomes,
      updatedAt: dto.updated_at,
      publishedAt: dto.published_at,
      aiEnabled: dto.ai_enabled,
      revision: dto.revision,
      enrollmentCount: dto.enrollment_count,
      itemHistory: history,
      reviewId: r?.id,
      reviewHistory: r
        ? [
            { action: 'submitted', actorId: r.submitted_by, at: r.submitted_at },
            ...(r.decided_at
              ? [
                  {
                    action: r.status === 'returned' ? ('returned' as const) : ('approved' as const),
                    actorId: r.decided_by ?? '',
                    at: r.decided_at,
                    reason: r.reason ?? undefined,
                  },
                ]
              : []),
          ]
        : [],
    },
    quizzes,
  };
}
export function authoringWrite(
  course: Course,
  quizzes: Quiz[],
  original: AuthoringCourseDto,
): AuthoringChapterWrite[] {
  const oldChapters = new Map(original.chapters.map((c) => [c.id, c]));
  const oldItems = new Map(original.chapters.flatMap((c) => c.items).map((i) => [i.id, i]));
  return course.chapters.map((c) => ({
    ...(oldChapters.has(c.id) ? { id: c.id } : {}),
    title: c.title,
    description: c.description ?? '',
    items: c.items.map((i) => {
      const old = oldItems.get(i.id);
      const common = { ...(old ? { id: i.id } : {}), title: i.title, type: i.type };
      if (i.type === 'video')
        return {
          ...common,
          type: 'video' as const,
          video_url: i.videoUrl ?? '',
          description: i.description ?? '',
          duration: i.duration ?? '',
        };
      if (i.type === 'article')
        return {
          ...common,
          type: 'article' as const,
          body: i.articleBody ?? i.content ?? '',
          body_doc: (i.articleDoc ?? null) as import('@melearn/contracts').JsonValue,
          reading_minutes: i.readingMinutes ?? 2,
        };
      const quiz = quizzes.find((q) => q.id === i.quizId);
      if (!quiz) throw new Error('ไม่พบข้อมูลแบบฝึกหัด');
      return {
        ...common,
        type: 'quiz' as const,
        quiz: {
          pass_percent: 70,
          questions: quiz.questions.map((q) => {
            const previous = old?.quiz?.questions.find((x) => x.id === q.id);
            const core = {
              ...(previous ? { id: q.id } : {}),
              prompt: q.prompt,
              prompt_doc: (q.promptDoc ?? null) as import('@melearn/contracts').JsonValue,
              points: q.points,
            };
            if (q.type === 'essay')
              return {
                ...core,
                type: q.responseMode === 'image' ? ('image' as const) : ('essay' as const),
                response_mode: q.responseMode ?? 'either',
                rubric: q.rubric ?? null,
              };
            // Preserve an unchanged multiple-choice definition even though this editor offers single-choice creation.
            const unchanged =
              previous?.type === 'multiple_choice' &&
              JSON.stringify(q.options) === JSON.stringify(previous.options?.map((o) => o.text));
            return {
              ...core,
              type: unchanged ? ('multiple_choice' as const) : ('single_choice' as const),
              options: q.options.map((text, n) => ({
                ...(previous?.options?.[n] ? { id: previous.options[n].id } : {}),
                text,
              })),
              correct_option_indices: unchanged
                ? (previous.options ?? []).flatMap((o, n) =>
                    previous.correct_option_ids?.includes(o.id) ? [n] : [],
                  )
                : [q.answer],
            };
          }) as AuthoringQuestionWrite[],
        },
      };
    }),
  }));
}
