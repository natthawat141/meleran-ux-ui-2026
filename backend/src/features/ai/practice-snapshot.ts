export type PracticeQuestion = { id: string; prompt: string; options: Array<{ id: string; text: string }>;
  correct_option_id: string; explanation: string };
export type LatestPracticeAnswer = { option_id: string; answered_at: string };

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function invalid(): never { throw new Error('Invalid persisted practice snapshot'); }

/** Internal v1 format, independent of provider wire protocol; never a wire DTO. */
export function practiceSnapshot(value: unknown): PracticeQuestion[] {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.questions) || !value.questions.length) return invalid();
  const ids = new Set<string>();
  return value.questions.map(raw => {
    if (!record(raw) || !text(raw.id) || ids.has(raw.id) || !text(raw.prompt) || !text(raw.explanation) ||
      !text(raw.correct_option_id) || !Array.isArray(raw.options) || !raw.options.length) return invalid();
    ids.add(raw.id); const optionIds = new Set<string>();
    const options = raw.options.map(option => {
      if (!record(option) || !text(option.id) || optionIds.has(option.id) || !text(option.text)) return invalid();
      optionIds.add(option.id); return { id: option.id, text: option.text };
    });
    if (!optionIds.has(raw.correct_option_id)) return invalid();
    return { id: raw.id, prompt: raw.prompt, options, correct_option_id: raw.correct_option_id, explanation: raw.explanation };
  });
}

export function practiceAnswers(questions: PracticeQuestion[], value: unknown): Map<string, LatestPracticeAnswer> {
  if (!record(value)) return invalid();
  const answers = new Map<string, LatestPracticeAnswer>(), byId = new Map(questions.map(question => [question.id, question]));
  for (const [id, raw] of Object.entries(value)) {
    const question = byId.get(id);
    if (!question || !record(raw) || typeof raw.option_id !== 'string' || typeof raw.answered_at !== 'string' ||
      !question.options.some(option => option.id === raw.option_id)) return invalid();
    const time = Date.parse(raw.answered_at);
    if (!Number.isFinite(time) || new Date(time).toISOString() !== raw.answered_at) return invalid();
    answers.set(id, { option_id: raw.option_id, answered_at: raw.answered_at });
  }
  return answers;
}
