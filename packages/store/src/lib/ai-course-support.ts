import type { Course, Role, VideoItem } from '../types';

export interface AiMetadataResult {
  ok: boolean;
  message: string;
  course?: Course;
}

function hasDocumentText(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasDocumentText);
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (typeof record.text === 'string' && Boolean(record.text.trim()))
    || Object.entries(record).some(([key, child]) => key !== 'text' && hasDocumentText(child));
}

export function setCourseAiEnabled(course: Course | undefined, role: Role | undefined, enabled: boolean): AiMetadataResult {
  if (role !== 'admin') return { ok: false, message: 'เฉพาะแอดมินที่ตั้งค่า AI ของคอร์สได้' };
  if (!course) return { ok: false, message: 'ไม่พบคอร์สนี้' };
  return { ok: true, message: enabled ? 'เปิด AI สำหรับคอร์สแล้ว' : 'ปิด AI สำหรับคอร์สแล้ว', course: { ...course, aiEnabled: enabled } };
}

export function saveVideoTranscript(
  course: Course | undefined,
  role: Role | undefined,
  chapterId: string,
  videoId: string,
  transcript: string,
  actorId: string,
  updatedAt: string,
): AiMetadataResult {
  if (role !== 'admin') return { ok: false, message: 'เฉพาะแอดมินที่จัดการ Transcript ได้' };
  if (!course) return { ok: false, message: 'ไม่พบคอร์สนี้' };
  const chapter = course.chapters.find((entry) => entry.id === chapterId);
  if (!chapter) return { ok: false, message: 'ไม่พบบทของวิดีโอนี้' };
  const video = chapter.items.find((entry) => entry.id === videoId);
  if (!video || video.type !== 'video') return { ok: false, message: 'ไม่พบวิดีโอในบทนี้' };
  const chapters = course.chapters.map((entry) => entry.id !== chapterId ? entry : {
    ...entry,
    items: entry.items.map((item) => item.id === videoId ? { ...item, transcript, transcriptUpdatedAt: updatedAt, transcriptUpdatedBy: actorId } as VideoItem : item),
  });
  return { ok: true, message: 'บันทึก Transcript แล้ว', course: { ...course, chapters } };
}

/** Generic course/chapter saves cannot modify admin-controlled AI settings. */
export function preserveCourseAiMetadata(existing: Course | undefined, incoming: Course): Course {
  const { aiEnabled: _ignored, ...safeIncoming } = incoming;
  return { ...safeIncoming, aiEnabled: existing?.aiEnabled ?? false };
}

/** Generic curriculum saves retain stored transcripts and ignore injected transcript fields. */
export function preserveVideoTranscripts(existing: Course | undefined, incoming: Course): Course {
  if (!existing) {
    return { ...incoming, chapters: incoming.chapters.map((chapter) => ({
      ...chapter,
      items: chapter.items.map((item) => {
        if (item.type !== 'video') return item;
        const { transcript: _ignored, transcriptUpdatedAt: _ignoredAt, transcriptUpdatedBy: _ignoredBy, ...safe } = item;
        return safe;
      }),
    })) };
  }
  const oldVideos = new Map(existing.chapters.flatMap((chapter) => chapter.items
    .filter((item): item is VideoItem => item.type === 'video').map((item) => [item.id, item.transcript] as const)));
  return { ...incoming, chapters: incoming.chapters.map((chapter) => ({
    ...chapter,
    items: chapter.items.map((item) => {
      if (item.type !== 'video') return item;
      const { transcript: _injected, transcriptUpdatedAt: _injectedAt, transcriptUpdatedBy: _injectedBy, ...safe } = item;
      const transcript = oldVideos.get(item.id);
      const existingVideo = existing.chapters.flatMap((entry) => entry.items).find((entry): entry is VideoItem => entry.id === item.id && entry.type === 'video');
      return transcript === undefined ? safe : {
        ...safe, transcript,
        ...(existingVideo?.transcriptUpdatedAt ? { transcriptUpdatedAt: existingVideo.transcriptUpdatedAt } : {}),
        ...(existingVideo?.transcriptUpdatedBy ? { transcriptUpdatedBy: existingVideo.transcriptUpdatedBy } : {}),
      };
    }),
  })) };
}

export function aiKnowledgeCounts(course: Course) {
  const videos = course.chapters.flatMap((chapter) => chapter.items).filter((item) => item.type === 'video');
  const articles = course.chapters.flatMap((chapter) => chapter.items).filter((item) => item.type === 'article'
    && (Boolean(item.articleBody?.trim()) || hasDocumentText(item.articleDoc)));
  return {
    description: Boolean(course.description?.trim()),
    articles: articles.length,
    transcripts: videos.filter((item) => item.type === 'video' && Boolean(item.transcript?.trim())).length,
  };
}

export function canUseCourseAi(course: Course, enrolledCourseIds: ReadonlySet<string>, role: Role | undefined, userId?: string, emailVerified?: boolean) {
  if (course.aiEnabled !== true || !role || !userId || (role !== 'admin' && emailVerified === false)) return false;
  if (role === 'admin') return true;
  if (role === 'instructor' && course.instructorId === userId) return true;
  return enrolledCourseIds.has(course.id);
}

export function safeCourseAiContext(course: Course | undefined, enabledCourseIds: ReadonlySet<string>) {
  return course && enabledCourseIds.has(course.id) ? course.id : undefined;
}
