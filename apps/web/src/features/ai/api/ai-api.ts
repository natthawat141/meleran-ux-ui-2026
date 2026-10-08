import type { WireAiConversation as AiConversation, WireAiOption as AiOption, WireAiPracticeQuestion as AiPracticeQuestion, WireAiMessage as AiMessage, WireAiUsage as AiUsage, WireAiContextCourse as AiContextCourse, WireAiPracticeAnswer as AiPracticeAnswer } from '@melearn/contracts';
export type { WireAiConversation as AiConversation, WireAiOption as AiOption, WireAiPracticeQuestion as AiPracticeQuestion, WireAiMessage as AiMessage, WireAiUsage as AiUsage, WireAiContextCourse as AiContextCourse, WireAiPracticeAnswer as AiPracticeAnswer } from '@melearn/contracts';
import { apiClient as http } from '../../../shared/api/client';
import type { ApiSessionUser } from '../../auth/api/auth-session';

const record = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid provisional AI response'); return value as Record<string, unknown>; };
const text = (value: unknown): string => { if (typeof value !== 'string') throw new TypeError('Invalid provisional AI response'); return value; };
const count = (value: unknown): number => { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new TypeError('Invalid provisional AI response'); return value; };
const boolean = (value: unknown): boolean => { if (typeof value !== 'boolean') throw new TypeError('Invalid provisional AI response'); return value; };

function decodeUsage(value: unknown): AiUsage {
  const row = record(value); return { limit: count(row.limit), used: count(row.used), remaining: count(row.remaining), reset_at: text(row.reset_at) };
}

function decodePracticeAnswer(value: unknown): AiPracticeAnswer {
  const row = record(value); const summary = row.summary === null ? null : record(row.summary);
  return { question_id: text(row.question_id), correct: boolean(row.correct), explanation: text(row.explanation),
    summary: summary ? { answered: count(summary.answered), total: count(summary.total), correct_count: count(summary.correct_count) } : null };
}

function decodeConversation(value: unknown): AiConversation {
  const row = record(value); return { id: text(row.id), title: text(row.title), course_id: row.course_id === null ? null : text(row.course_id), created_at: text(row.created_at), updated_at: text(row.updated_at) };
}
function decodeMessage(value: unknown): AiMessage {
  const row = record(value); let practice: AiMessage['practice'] = null;
  if (row.practice !== null) {
    const rawPractice = record(row.practice); const questions = rawPractice.questions;
    if (!Array.isArray(questions)) throw new TypeError('Invalid provisional AI practice');
    practice = { topic_id: text(rawPractice.topic_id), questions: questions.map((raw) => {
      const question = record(raw); const options = question.options;
      if (!Array.isArray(options)) throw new TypeError('Invalid provisional AI options');
      const result = question.result === undefined ? undefined : record(question.result);
      return { id: text(question.id), prompt: text(question.prompt), options: options.map((entry) => { const option = record(entry); return { id: text(option.id), text: text(option.text) }; }), answered: boolean(question.answered),
        ...(typeof question.my_option_id === 'string' ? { my_option_id: question.my_option_id } : {}),
        ...(result ? { result: { correct: boolean(result.correct), explanation: text(result.explanation) } } : {}),
      };
    }) };
  }
  const roles = ['user', 'assistant'];
  if (!roles.includes(String(row.role))) throw new TypeError('Invalid provisional AI message role');
  return { id: text(row.id), role: row.role as AiMessage['role'], kind: text(row.kind), content: text(row.content), status: text(row.status), request_id: text(row.request_id), created_at: text(row.created_at), completed_at: row.completed_at === null ? null : text(row.completed_at), error_code: row.error_code === null ? null : text(row.error_code), practice };
}
function decodePage<T>(value: unknown, decoder: (entry: unknown) => T) {
  const row = record(value); if (!Array.isArray(row.items)) throw new TypeError('Invalid provisional AI page');
  return { items: row.items.map(decoder), next_cursor: row.next_cursor === null ? null : text(row.next_cursor) };
}

export const aiApi = {
  conversations: (query = '', signal?: AbortSignal) => http.request(`me/ai/conversations?limit=50${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ''}`, { method: 'GET', signal, decoder: (value) => decodePage(value, decodeConversation) }),
  messages: (conversationId: string, signal?: AbortSignal) => http.request(`me/ai/conversations/${encodeURIComponent(conversationId)}/messages?limit=50`, { method: 'GET', signal, decoder: (value) => decodePage(value, decodeMessage) }),
  usage: (signal?: AbortSignal) => http.request('me/ai/usage', { method: 'GET', signal, decoder: decodeUsage }),
  createConversation: (courseId: string | null) => http.request('me/ai/conversations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(courseId ? { course_id: courseId } : {}), decoder: decodeConversation }),
  renameConversation: (id: string, title: string) => http.request(`me/ai/conversations/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title }), decoder: decodeConversation }),
  deleteConversation: (id: string) => http.request(`me/ai/conversations/${encodeURIComponent(id)}`, { method: 'DELETE', decoder: () => undefined }),
  sendMessage: (id: string, content: string, requestId: string, courseId: string | null) => http.request(`me/ai/conversations/${encodeURIComponent(id)}/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content, request_id: requestId, ...(courseId ? { course_id: courseId } : {}) }), decoder: (value) => { const row = record(value); return { message: decodeMessage(row.message), usage: decodeUsage(row.usage) }; } }),
  answerPractice: (conversationId: string, messageId: string, questionId: string, optionId: string) => http.request(`me/ai/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/practice/answers`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question_id: questionId, option_id: optionId }), decoder: decodePracticeAnswer }),
  contextCourses: async (roles: ApiSessionUser['roles'], signal?: AbortSignal): Promise<AiContextCourse[]> => {
    const [enrollmentResult, instructorResult] = await Promise.all([
      http.request('me/enrollments?limit=50', { method: 'GET', signal, decoder: (value) => decodePage(value, (entry) => { const row = record(entry); const course = record(row.course); return { id: text(course.id), title: text(course.title) }; }) }),
      roles.includes('instructor') ? http.request('instructor/courses?limit=50', { method: 'GET', signal, decoder: (value) => decodePage(value, (entry) => { const row = record(entry); return { id: text(row.id), title: text(row.title), status: text(row.status) }; }) }) : Promise.resolve(null),
    ]);
    const map = new Map(enrollmentResult.items.map((course) => [course.id, course]));
    for (const course of instructorResult?.items ?? []) if (course.status === 'published') map.set(course.id, { id: course.id, title: course.title });
    return [...map.values()];
  },
};
