import { createHttpClient } from '@melearn/api-client';

const http = createHttpClient({ baseUrl: '/mock-api/v1', fetcher: globalThis.fetch.bind(globalThis), headers: { accept: 'application/json', 'x-melearn-app': 'admin' }, credentials: 'same-origin', timeoutMs: 8_000 });
const record = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid provisional AI admin response'); return value as Record<string, unknown>; };
const string = (value: unknown): string => { if (typeof value !== 'string') throw new TypeError('Invalid provisional AI admin response'); return value; };
export interface AdminAiCourse { id: string; title: string; status: string }
export interface AdminAiVideo { id: string; title: string; type: 'video' | 'article' | 'quiz'; has_ai_transcript: boolean }
export interface AdminAiAuthoring { id: string; title: string; status: string; ai_enabled: boolean; chapters: Array<{ id: string; title: string; items: AdminAiVideo[] }> }
export interface AdminTranscript { item_id: string; text: string; edited_by: string | null; edited_at: string | null }

export const adminAiApi = {
  courses: (signal?: AbortSignal) => http.request('admin/courses?limit=50', { method: 'GET', signal, decoder: (value) => {
    const items = record(value).items; if (!Array.isArray(items)) throw new TypeError('Invalid admin courses');
    return items.map((entry) => { const row = record(entry); return { id: string(row.id), title: string(row.title), status: string(row.status) } satisfies AdminAiCourse; });
  } }),
  authoring: (courseId: string, signal?: AbortSignal) => http.request(`courses/${encodeURIComponent(courseId)}/authoring`, { method: 'GET', signal, decoder: (value) => {
    const row = record(value); const chapters = row.chapters;
    if (!Array.isArray(chapters)) throw new TypeError('Invalid course authoring response');
    if (typeof row.ai_enabled !== 'boolean') throw new TypeError('Invalid AI setting');
    return { id: string(row.id), title: string(row.title), status: string(row.status), ai_enabled: row.ai_enabled, chapters: chapters.map((entry) => { const chapter = record(entry); if (!Array.isArray(chapter.items)) throw new TypeError('Invalid authoring items'); return { id: string(chapter.id), title: string(chapter.title), items: chapter.items.map((raw) => { const item = record(raw); const type = string(item.type); if (!['video', 'article', 'quiz'].includes(type)) throw new TypeError('Invalid content item type'); if (typeof item.has_ai_transcript !== 'boolean') throw new TypeError('Invalid transcript metadata'); return { id: string(item.id), title: string(item.title), type: type as AdminAiVideo['type'], has_ai_transcript: item.has_ai_transcript }; }) }; }) } satisfies AdminAiAuthoring;
  } }),
  setAiEnabled: (courseId: string, enabled: boolean) => http.request(`admin/courses/${encodeURIComponent(courseId)}/ai-support`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ai_enabled: enabled }), decoder: (value) => { const row = record(value); if (typeof row.ai_enabled !== 'boolean') throw new TypeError('Invalid AI setting'); return { course_id: string(row.course_id), ai_enabled: row.ai_enabled }; } }),
  transcript: (courseId: string, itemId: string, signal?: AbortSignal) => http.request(`admin/courses/${encodeURIComponent(courseId)}/videos/${encodeURIComponent(itemId)}/ai-transcript`, { method: 'GET', signal, decoder: (value) => { const row = record(value); return { item_id: string(row.item_id), text: string(row.text), edited_by: row.edited_by === null ? null : string(row.edited_by), edited_at: row.edited_at === null ? null : string(row.edited_at) } satisfies AdminTranscript; } }),
  saveTranscript: (courseId: string, itemId: string, text: string) => http.request(`admin/courses/${encodeURIComponent(courseId)}/videos/${encodeURIComponent(itemId)}/ai-transcript`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }), decoder: (value) => { const row = record(value); return { item_id: string(row.item_id), text: string(row.text), edited_by: row.edited_by === null ? null : string(row.edited_by), edited_at: row.edited_at === null ? null : string(row.edited_at) } satisfies AdminTranscript; } }),
};
