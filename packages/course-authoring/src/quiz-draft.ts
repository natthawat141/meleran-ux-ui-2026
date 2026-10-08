/** UI draft only: incomplete answers may be restored, malformed storage must not enter the editor. */
export interface QuestionDraft {
  id: string;
  type: 'choice' | 'essay';
  prompt: string;
  promptDoc?: unknown;
  rubric?: string;
  points: number;
  options: string[];
  correctIndex?: number;
  responseMode: 'either' | 'text' | 'image';
}
export interface QuizDraft {
  title: string;
  courseId: string;
  chapterId?: string;
  passPercent: number;
  questions: QuestionDraft[];
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export function restoreQuizDraft(raw: string | null, baseline: string): QuizDraft | null {
  try {
    if (!raw || raw.length > 2000000) return null;
    const entry: unknown = JSON.parse(raw);
    if (!object(entry) || entry.baseline !== baseline || !object(entry.values)) return null;
    const v = entry.values;
    if (
      typeof v.title !== 'string' ||
      typeof v.courseId !== 'string' ||
      (v.chapterId !== undefined && typeof v.chapterId !== 'string') ||
      v.passPercent !== 70 ||
      !Array.isArray(v.questions)
    )
      return null;
    const questions: QuestionDraft[] = [];
    for (const q of v.questions) {
      if (
        !object(q) ||
        typeof q.id !== 'string' ||
        !q.id ||
        !['choice', 'essay'].includes(String(q.type)) ||
        typeof q.prompt !== 'string' ||
        !Array.isArray(q.options) ||
        !q.options.every((x) => typeof x === 'string') ||
        !['either', 'text', 'image'].includes(String(q.responseMode)) ||
        (q.rubric !== undefined && typeof q.rubric !== 'string') ||
        (q.points !== null && (typeof q.points !== 'number' || !Number.isFinite(q.points))) ||
        (q.correctIndex !== undefined &&
          q.correctIndex !== null &&
          (!Number.isSafeInteger(q.correctIndex) ||
            (q.correctIndex as number) < 0 ||
            (q.correctIndex as number) >= q.options.length)) ||
        (q.promptDoc !== undefined &&
          q.promptDoc !== null &&
          (!object(q.promptDoc) || q.promptDoc.type !== 'doc'))
      )
        return null;
      questions.push({
        id: q.id,
        type: q.type as QuestionDraft['type'],
        prompt: q.prompt,
        points: q.points === null ? 0 : (q.points as number),
        options: q.options as string[],
        responseMode: q.responseMode as QuestionDraft['responseMode'],
        ...(q.rubric === undefined ? {} : { rubric: q.rubric as string }),
        ...(q.promptDoc === undefined ? {} : { promptDoc: q.promptDoc }),
        ...(q.correctIndex === undefined || q.correctIndex === null
          ? {}
          : { correctIndex: q.correctIndex as number }),
      });
    }
    if (new Set(questions.map((q) => q.id)).size !== questions.length) return null;
    return {
      title: v.title,
      courseId: v.courseId,
      passPercent: 70,
      questions,
      ...(v.chapterId === undefined ? {} : { chapterId: v.chapterId as string }),
    };
  } catch {
    return null;
  }
}
