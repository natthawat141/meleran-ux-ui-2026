import type { WireAttemptQuestion as AttemptQuestion, WireAttemptView as AttemptView, WireGradingQueueItem as GradingQueueItem } from '@melearn/contracts';
export type { WireAttemptQuestion as AttemptQuestion, WireAttemptView as AttemptView, WireGradingQueueItem as GradingQueueItem } from '@melearn/contracts';
import { apiClient as http } from '../../../shared/api/client';
const record = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid assessment response'); return value as Record<string, unknown>; };
const str = (value: unknown): string => { if (typeof value !== 'string') throw new TypeError('Invalid assessment response'); return value; };

function decodeAttempt(value: unknown): AttemptView {
  const a = record(value);
  if (!Array.isArray(a.questions) || !Array.isArray(a.answers) && (a.answers === null || typeof a.answers !== 'object')) throw new TypeError('Invalid attempt');
  return {
    id: str(a.id), item_id: str(a.item_id), course_id: str(a.course_id), number: Number(a.number), status: str(a.status) as AttemptView['status'],
    started_at: str(a.started_at), submitted_at: a.submitted_at as string | null, graded_at: a.graded_at as string | null,
    questions: a.questions.map((question) => { const q = record(question); return { id: str(q.id), type: str(q.type) as AttemptQuestion['type'], prompt: str(q.prompt), prompt_doc:(q.prompt_doc??null) as AttemptQuestion['prompt_doc'], points: Number(q.points), options: Array.isArray(q.options) ? q.options.map((option) => { const o = record(option); return { id: str(o.id), text: str(o.text) }; }) : [] }; }),
    answers: a.answers as AttemptView['answers'], max: Number(a.max), earned: a.earned as number | null, percent: a.percent as number | null, passed: a.passed as boolean | null,
    question_results: Array.isArray(a.question_results) ? a.question_results.map((row) => { const q = record(row); return { question_id: str(q.question_id), score: Number(q.score), max: Number(q.max), comment: q.comment as string | null }; }) : null,
  };
}
export const assessmentApi = {
  start: (itemId: string) => http.request(`learn/items/${encodeURIComponent(itemId)}/attempts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', decoder: decodeAttempt }),
  attempt: (attemptId: string, signal?: AbortSignal) => http.request(`learn/attempts/${encodeURIComponent(attemptId)}`, { method: 'GET', signal, decoder: decodeAttempt }),
  saveAnswers: (attemptId: string, answers: AttemptView['answers']) => http.request(`learn/attempts/${encodeURIComponent(attemptId)}/answers`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ answers }), decoder: decodeAttempt }),
  submit: (attemptId: string) => http.request(`learn/attempts/${encodeURIComponent(attemptId)}/submit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', decoder: decodeAttempt }),
  gradingQueue: (signal?: AbortSignal) => http.request('instructor/grading-queue', { method: 'GET', signal, decoder: (value) => {
    const items = record(value).items; if (!Array.isArray(items)) throw new TypeError('Invalid grading queue');
    return items.map((entry) => { const row = record(entry); if (!Array.isArray(row.questions_to_grade)) throw new TypeError('Invalid grading queue item'); return {
      attempt_id: str(row.attempt_id), course_id: str(row.course_id), item_id: str(row.item_id), learner_display_name: str(row.learner_display_name), submitted_at: str(row.submitted_at),
      questions_to_grade: row.questions_to_grade.map((raw) => { const q = record(raw); const answer = record(q.answer); return { question_id: str(q.question_id), type: str(q.type) as 'essay' | 'image', prompt: str(q.prompt), max: Number(q.max), answer: { ...(typeof answer.text === 'string' ? { text: answer.text } : {}), ...(typeof answer.image_url === 'string' ? { image_url: answer.image_url } : {}) } }; }),
    }; });
  } }),
  grade: (attemptId: string, questionId: string, score: number, comment: string | null) => http.request(`instructor/attempts/${encodeURIComponent(attemptId)}/questions/${encodeURIComponent(questionId)}/grade`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ score, comment }), decoder: decodeAttempt }),
};
