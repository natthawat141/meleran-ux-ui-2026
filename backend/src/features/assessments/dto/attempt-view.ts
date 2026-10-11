import { Prisma } from '@prisma/client';
import { summarizeSubmittedScores } from '../submitted-score';
import { answerComplete } from '../answer-completeness';

type QuestionType = 'single_choice' | 'multiple_choice' | 'essay' | 'image';
export interface AttemptQuestionView {
  id: string; type: QuestionType; prompt: string; prompt_doc?: Prisma.JsonValue;
  points: number; options: Array<{ id: string; text: string }>;
}
export interface AnswerView { option_ids?: string[]; text?: string; image_url?: string }
export interface AttemptView {
  id: string; item_id: string; course_id: string; number: number;
  status: 'in_progress' | 'pending_review' | 'graded'; started_at: string;
  submitted_at: string | null; graded_at: string | null;
  questions: AttemptQuestionView[]; answers: Record<string, AnswerView>;
  max: number; earned: number | null; percent: number | null; passed: boolean | null;
  question_results: Array<{ question_id: string; score: number; max: number; comment: string | null }> | null;
}
export interface StoredAttemptRead {
  id: string; itemId: unknown; courseId: string; number: number; status: string;
  startedAt: Date; submittedAt: Date | null; gradedAt: Date | null;
  maxScore: Prisma.Decimal; earnedScore: Prisma.Decimal | null; passed: boolean | null;
}
export interface StoredQuestionRead {
  questionId: string; type: string; prompt: unknown; options: unknown;
  hasPromptDoc: boolean; promptDoc: Prisma.JsonValue; maxScore: Prisma.Decimal;
  answerId: string | null; response: unknown; score: Prisma.Decimal | null; comment: string | null;
  responseMode?: unknown;
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const string = (v: unknown): v is string => typeof v === 'string';
const decimal = Prisma.Decimal.clone({ precision: 100 });
function wireNumber(v: Prisma.Decimal): number {
  const n = v.toNumber(); if (!v.isFinite() || !Number.isFinite(n)) throw new Error('Invalid stored score'); return n;
}

/** Public-only SQL inputs. Never consumes a correct-key/full definition object. */
export function projectAttempt(row: StoredAttemptRead, snapshots: readonly StoredQuestionRead[]): AttemptView {
  if (!string(row.itemId) || !row.itemId || !Number.isSafeInteger(row.number) || row.number < 1 ||
      !['in_progress', 'pending_review', 'graded'].includes(row.status) || snapshots.length === 0) throw new Error('Invalid stored attempt');
  const questions: AttemptQuestionView[] = [], answers: Array<[string, AnswerView]> = [];
  const ids = new Set<string>();
  for (const q of snapshots) {
    if (!q.questionId || ids.has(q.questionId) || !['single_choice', 'multiple_choice', 'essay', 'image'].includes(q.type) ||
        !string(q.prompt) || !Array.isArray(q.options)) throw new Error('Invalid public question snapshot');
    ids.add(q.questionId); const optionIds = new Set<string>();
    const options = q.options.map(raw => {
      if (!object(raw) || !string(raw.id) || !raw.id || !string(raw.text) || optionIds.has(raw.id)) throw new Error('Invalid public option snapshot');
      optionIds.add(raw.id); return { id: raw.id, text: raw.text };
    });
    questions.push({ id: q.questionId, type: q.type as QuestionType, prompt: q.prompt, points: wireNumber(q.maxScore), options,
      ...(q.hasPromptDoc ? { prompt_doc: q.promptDoc } : {}) });
    if (q.response !== null) {
      if (!q.answerId || !object(q.response)) throw new Error('Invalid stored answer');
      const value: AnswerView = {};
      if (q.response.option_ids !== undefined) {
        if (!Array.isArray(q.response.option_ids) || q.response.option_ids.some(id => !string(id) || !optionIds.has(id)) ||
            new Set(q.response.option_ids).size !== q.response.option_ids.length) throw new Error('Invalid stored choice answer');
        value.option_ids = q.response.option_ids as string[];
      }
      for (const key of ['text', 'image_url'] as const) if (q.response[key] !== undefined) {
        if (!string(q.response[key])) throw new Error('Invalid stored answer field'); value[key] = q.response[key];
      }
      answers.push([q.questionId, value]);
    }
  }
  const total = summarizeSubmittedScores(snapshots.map(q => ({ maxScore: q.maxScore, score: q.score })));
  if (!total.maxScore.eq(row.maxScore)) throw new Error('Mismatched attempt maximum');
  const graded = row.status === 'graded';
  const complete = (q: StoredQuestionRead) => answerComplete(q.type,q.response,q.responseMode);
  if (graded && (!row.gradedAt || !row.submittedAt || row.earnedScore === null || total.status !== 'graded' ||
      !total.score.eq(row.earnedScore) || row.passed !== total.passed || snapshots.some(q => !q.answerId || !complete(q))))
    throw new Error('Missing complete graded proof');
  if (!graded && (row.passed !== null || row.gradedAt !== null)) throw new Error('Premature graded result');
  return { id: row.id, item_id: row.itemId, course_id: row.courseId, number: row.number, status: row.status as AttemptView['status'],
    started_at: row.startedAt.toISOString(), submitted_at: row.submittedAt?.toISOString() ?? null, graded_at: row.gradedAt?.toISOString() ?? null,
    questions, answers: Object.fromEntries(answers), max: wireNumber(row.maxScore),
    earned: graded ? wireNumber(row.earnedScore!) : null,
    percent: graded && row.maxScore.gt(0) ? wireNumber(new decimal(row.earnedScore!).div(row.maxScore).times(100)) : null,
    passed: graded ? row.passed : null,
    question_results: graded ? snapshots.map(q => ({ question_id: q.questionId, score: wireNumber(q.score!), max: wireNumber(q.maxScore), comment: q.comment })) : null };
}
