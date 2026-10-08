import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuthSession } from '../../auth/api/AuthSessionProvider';
import { resource, resourceList } from '../../../shared/api/resources';
import { authoringForm, authoringWrite, type EditorCourse } from '@melearn/course-authoring';
import type {
  AuthoringCourseDto,
  ManagedCourseSummaryDto,
  Course,
  Chapter,
  Quiz,
  CourseItem,
  User,
  CourseMetadataRequest,
  AdminUserSummaryDto,
} from '@melearn/contracts';
const scope: string = 'instructor';
const id = (value: string) => encodeURIComponent(value);
export function useAuthoringWorkspace() {
  const { user } = useAuthSession();
  const params = useParams();
  const [search] = useSearchParams();
  const cache = useQueryClient();
  const key = ['authoring', scope, user?.id];
  const { data: result } = useSuspenseQuery({
    queryKey: [...key, params.courseId, params.quizId, search.get('course'), search.get('courseId')],
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const list = await resourceList<ManagedCourseSummaryDto>(scope + '/courses', signal);
      let selected = params.courseId;
      if (params.quizId && params.quizId !== 'new')
        selected = (
          await resource<{ course_id: string }>(
            'managed-quizzes/' + id(params.quizId),
            'GET',
            undefined,
            signal,
          )
        ).course_id;
      selected =
        selected ??
        search.get('course') ??
        search.get('courseId') ??
        (params.quizId === 'new' ? list[0]?.id : undefined);
      const detail =
        selected && selected !== 'new'
          ? await resource<AuthoringCourseDto>(
              'courses/' + id(selected) + '/authoring',
              'GET',
              undefined,
              signal,
            )
          : null;
      const instructors =
        scope === 'admin' ? await resourceList<AdminUserSummaryDto>('admin/users', signal) : [];
      const transcripts: Record<
        string,
        { text: string | null; edited_at: string | null; edited_by: string | null }
      > = {};
      if (scope === 'admin' && detail && params.chapterId)
        await Promise.all(
          detail.chapters
            .find((c) => c.id === params.chapterId)
            ?.items.filter((i) => i.type === 'video')
            .map(async (i) => {
              transcripts[i.id] = await resource(
                'admin/courses/' + id(detail.id) + '/videos/' + id(i.id) + '/ai-transcript',
                'GET',
                undefined,
                signal,
              );
            }) ?? [],
        );
      return { list, detail, instructors, transcripts };
    },
  });
  const forms = result.list.map((c) => authoringForm(result.detail?.id === c.id ? result.detail : c));
  const courses = forms.map((f) => f.course);
  const quizzes = forms.flatMap((f) => f.quizzes);
  for (const c of courses)
    for (const ch of c.chapters)
      for (const i of ch.items)
        if (i.type === 'video' && result.transcripts[i.id]) {
          const t = result.transcripts[i.id];
          i.transcript = t.text ?? '';
          i.transcriptUpdatedAt = t.edited_at ?? undefined;
          i.transcriptUpdatedBy = t.edited_by ?? undefined;
        }
  const currentUser = user
    ? {
        ...user.profile,
        id: user.id,
        name: user.display_name,
        email: user.email ?? '',
        username: user.username ?? undefined,
        role: scope === 'admin' ? ('admin' as const) : ('instructor' as const),
        roles: user.roles,
        status: 'active' as const,
      }
    : null;
  const users: User[] = [
    ...result.instructors.map((u) => ({
      ...u,
      id: u.id,
      name: u.display_name,
      email: u.email ?? '',
      username: u.username ?? undefined,
      role: u.roles.includes('admin')
        ? ('admin' as const)
        : u.roles.includes('instructor')
          ? ('instructor' as const)
          : ('learner' as const),
      status: u.status,
    })),
    ...result.list.map((c) => ({
      id: c.instructor.id,
      name: c.instructor.display_name,
      email: '',
      role: 'instructor' as const,
    })),
  ];
  if (currentUser && !users.some((u) => u.id === currentUser.id)) users.push(currentUser);
  const data = {
    courses,
    quizzes,
    users,
    currentUserId: currentUser?.id,
    attempts: [] as import('@melearn/contracts').QuizAttempt[],
    enrollments: [] as import('@melearn/contracts').Enrollment[],
    certificates: [] as import('@melearn/contracts').Certificate[],
    progress: {} as Record<string, Record<string, boolean>>,
  };
  const refresh = () =>
    cache.invalidateQueries({
      predicate: (q) =>
        ['authoring', 'management', 'instructor-data', 'public-courses', 'public-blog', 'grading'].includes(
          String(q.queryKey[0]),
        ),
    });
  const mutate = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await refresh();
      return { ok: true, message: 'บันทึกแล้ว' };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ' };
    }
  };
  const detailFor = (courseId: string) => {
    if (!result.detail || result.detail.id !== courseId) throw new Error('เปิดคอร์สนี้ก่อนแก้ไข');
    return result.detail;
  };
  const patch = async (c: Course, qs: Quiz[] = quizzes, revision?: number) => {
    const original = detailFor(c.id);
    const saved = await resource<AuthoringCourseDto>('courses/' + id(c.id), 'PATCH', {
      expected_revision: revision ?? original.revision,
      chapters: authoringWrite(c, qs, original),
    });
    await refresh();
    return authoringForm(saved);
  };
  return {
    data,
    currentUser,
    async saveCourse(values: Partial<Course>, courseId?: string, revision?: number) {
      const body: CourseMetadataRequest = {
        title: values.title ?? '',
        subtitle: values.subtitle ?? null,
        description: values.description ?? null,
        cover_url: values.cover ?? null,
        category: values.category,
        level: values.level,
        price: values.price ? { amount_minor: Math.round(values.price * 100), currency: 'THB' } : null,
        outcomes: values.outcomes ?? [],
      };
      const saved = await resource<AuthoringCourseDto>(
        courseId ? 'courses/' + id(courseId) : scope + '/courses',
        courseId ? 'PATCH' : 'POST',
        {
          ...body,
          ...(courseId
            ? {
                expected_revision: revision ?? detailFor(courseId).revision,
                ...(scope === 'admin' ? { instructor_id: values.instructorId } : {}),
              }
            : scope === 'admin'
              ? { instructor_id: values.instructorId }
              : {}),
        },
      );
      await refresh();
      return saved.id;
    },
    saveChapter: async (courseId: string, values: Partial<Chapter>) => {
      const c = courses.find((c) => c.id === courseId)!;
      await patch({
        ...c,
        chapters: [
          ...c.chapters,
          {
            id: 'draft-' + crypto.randomUUID(),
            title: values.title ?? '',
            description: values.description,
            items: [],
          },
        ],
      });
    },
    removeChapter: (courseId: string, chapterId: string) =>
      mutate(async () => {
        const c = courses.find((c) => c.id === courseId)!;
        await patch({ ...c, chapters: c.chapters.filter((ch) => ch.id !== chapterId) });
      }),
    removeItem: (courseId: string, chapterId: string, itemId: string) =>
      mutate(async () => {
        const c = courses.find((c) => c.id === courseId)!;
        await patch({
          ...c,
          chapters: c.chapters.map((ch) =>
            ch.id === chapterId ? { ...ch, items: ch.items.filter((i) => i.id !== itemId) } : ch,
          ),
        });
      }),
    reorderCurriculum: (courseId: string, chapterId: string | null, ids: string[]) =>
      mutate(async () => {
        const c = courses.find((c) => c.id === courseId)!;
        await patch({
          ...c,
          chapters: chapterId
            ? c.chapters.map((ch) =>
                ch.id === chapterId
                  ? { ...ch, items: ids.map((id) => ch.items.find((i) => i.id === id)!) }
                  : ch,
              )
            : ids.map((id) => c.chapters.find((ch) => ch.id === id)!),
        });
      }),
    async saveChapterWorkspace(
      courseId: string,
      chapter: Chapter,
      qs: Quiz[],
      _baseline: string,
      revision?: number,
    ) {
      try {
        const c = courses.find((c) => c.id === courseId)!;
        const saved = await patch(
          { ...c, chapters: c.chapters.map((ch) => (ch.id === chapter.id ? chapter : ch)) },
          [...quizzes.filter((q) => q.chapterId !== chapter.id), ...qs],
          revision,
        );
        return {
          ok: true,
          message: 'บันทึกบทแล้ว',
          chapter: saved.course.chapters.find((ch) => ch.id === chapter.id)!,
          quizzes: saved.quizzes.filter((q) => q.chapterId === chapter.id),
          revision: saved.course.revision,
        };
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ' };
      }
    },
    async saveItem(
      courseId: string,
      chapterId: string,
      values: Partial<CourseItem> & { type: CourseItem['type'] },
      revision?: number,
    ) {
      const c = courses.find((c) => c.id === courseId)!;
      const previous = c.chapters.flatMap((ch) => ch.items).find((i) => i.id === values.id);
      const item = { ...previous, ...values, id: values.id ?? 'draft-' + crypto.randomUUID() } as CourseItem;
      await patch(
        {
          ...c,
          chapters: c.chapters.map((ch) =>
            ch.id === chapterId
              ? {
                  ...ch,
                  items: values.id
                    ? ch.items.map((i) => (i.id === values.id ? item : i))
                    : [...ch.items, item],
                }
              : ch,
          ),
        },
        quizzes,
        revision,
      );
    },
    async saveQuiz(values: Omit<Quiz, 'id'>, quizId?: string, revision?: number) {
      const original =
        result.detail?.id === values.courseId
          ? result.detail
          : await resource<AuthoringCourseDto>('courses/' + id(values.courseId) + '/authoring');
      const f = authoringForm(original);
      const c = f.course;
      const temporary = quizId ?? 'draft-' + crypto.randomUUID();
      const q = { ...values, id: temporary };
      if (quizId && quizzes.find((q) => q.id === quizId)?.courseId !== values.courseId)
        throw new Error('ย้ายแบบฝึกหัดข้ามคอร์สไม่ได้');
      const chapters = c.chapters.map((ch) => {
        const existing = ch.items.some((i) => i.type === 'quiz' && i.quizId === temporary);
        const items = ch.items.flatMap((i) =>
          i.type === 'quiz' && i.quizId === temporary
            ? ch.id === values.chapterId
              ? [{ ...i, title: values.title }]
              : []
            : [i],
        );
        return {
          ...ch,
          items:
            ch.id === values.chapterId && !existing
              ? [...items, { id: temporary, type: 'quiz' as const, quizId: temporary, title: values.title }]
              : items,
        };
      });
      const saved = await resource<AuthoringCourseDto>('courses/' + id(c.id), 'PATCH', {
        expected_revision:
          revision ?? courses.find((c) => c.id === values.courseId)?.revision ?? original.revision,
        chapters: authoringWrite(
          { ...c, chapters },
          [...f.quizzes.filter((q) => q.id !== temporary), q],
          original,
        ),
      });
      await refresh();
      const savedId = quizId ?? saved.chapters.find((c) => c.id === values.chapterId)?.items.at(-1)?.id;
      return {
        id: savedId,
        quiz: authoringForm(saved).quizzes.find((q) => q.id === savedId),
        revision: saved.revision,
      };
    },
    removeQuiz: async (quizId: string) => {
      try {
        const locator = await resource<{ course_id: string }>('managed-quizzes/' + id(quizId));
        const dto = await resource<AuthoringCourseDto>('courses/' + id(locator.course_id) + '/authoring');
        const f = authoringForm(dto);
        await resource('courses/' + id(dto.id), 'PATCH', {
          expected_revision: dto.revision,
          chapters: authoringWrite(
            {
              ...f.course,
              chapters: f.course.chapters.map((ch) => ({
                ...ch,
                items: ch.items.filter((i) => i.id !== quizId),
              })),
            },
            f.quizzes,
            dto,
          ),
        });
        await refresh();
        return { ok: true, message: 'ลบแบบฝึกหัดแล้ว' };
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : 'ลบไม่สำเร็จ' };
      }
    },
    submitCourseForReview: (courseId: string) =>
      mutate(() =>
        resource('courses/' + id(courseId) + '/submit-review', 'POST', {
          expected_revision: detailFor(courseId).revision,
        }),
      ),
    publishCourse: (courseId: string) =>
      mutate(() => resource('courses/' + id(courseId) + '/publish', 'POST', {})),
    setCourseAiEnabled: (courseId: string, enabled: boolean) =>
      mutate(() =>
        resource('admin/courses/' + id(courseId) + '/ai-support', 'PATCH', { ai_enabled: enabled }),
      ),
    async saveVideoTranscript(courseId: string, _chapterId: string, itemId: string, text: string) {
      try {
        const t = await resource<{ edited_at: string; edited_by: string }>(
          'admin/courses/' + id(courseId) + '/videos/' + id(itemId) + '/ai-transcript',
          'PUT',
          { text },
        );
        await refresh();
        return {
          ok: true,
          message: 'บันทึก Transcript แล้ว',
          updatedAt: t.edited_at,
          updatedBy: t.edited_by,
        };
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ' };
      }
    },
  };
}
