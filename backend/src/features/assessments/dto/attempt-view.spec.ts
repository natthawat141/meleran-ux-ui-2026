import { Prisma } from '@prisma/client';
import { projectAttempt, StoredAttemptRead, StoredQuestionRead } from './attempt-view';
const d = (n: string | number) => new Prisma.Decimal(n);
const time = new Date('2026-10-11T01:00:00Z');
function row(): StoredAttemptRead { return { id: 'attempt', itemId: 'item', courseId: 'course', number: 1, status: 'graded',
  startedAt: time, submittedAt: time, gradedAt: time, maxScore: d(10), earnedScore: d(7), passed: false }; }
function question(): StoredQuestionRead { return { questionId: 'question', type: 'essay', prompt: 'Prompt', options: [], hasPromptDoc: false,
  promptDoc: null, maxScore: d(10), answerId: 'answer', response: { text: 'ตอบแล้ว' }, score: d(7), comment: null }; }
describe('Attempt projection exact score proof and public snapshot safety', () => {
  it('retains strict greater-than70 even when wire percentage rounds to70', () => {
    const earned = d('7.000000000000000000000000000001');
    const projected = projectAttempt({ ...row(), earnedScore: earned, passed: true }, [{ ...question(), score: earned }]);
    expect(projected.percent).toBe(70); expect(projected.passed).toBe(true);
    expect(projectAttempt(row(), [question()]).passed).toBe(false);
  });
  it('rejects stored summary/normalized grade mismatch rather than recalculating or exposing inconsistent results', () => {
    expect(() => projectAttempt({ ...row(), earnedScore: d(8), passed: true }, [question()])).toThrow();
    expect(() => projectAttempt(row(), [{ ...question(), maxScore: d(20) }])).toThrow();
    expect(() => projectAttempt(row(), [{ ...question(), score: null }])).toThrow();
  });
  it('graded status requires actual answer content, not a default zero grade or fabricated empty response', () => {
    expect(() => projectAttempt(row(), [{ ...question(), response: {} }])).toThrow();
    expect(() => projectAttempt(row(), [{ ...question(), response: { text: ' ' } }])).toThrow();
    expect(() => projectAttempt(row(), [{ ...question(), answerId: null, response: null }])).toThrow();
  });
  it('zero maximum yields no invented percentage or passing outcome and does not change global Decimal precision', () => {
    const precision = Prisma.Decimal.precision;
    const projected = projectAttempt({ ...row(), maxScore: d(0), earnedScore: d(0) }, [{ ...question(), maxScore: d(0), score: d(0) }]);
    expect(projected.percent).toBeNull(); expect(projected.passed).toBe(false); expect(Prisma.Decimal.precision).toBe(precision);
  });
  it('omits sensitive answer/option metadata and safely preserves opaque prototype-like question IDs', () => {
    const q = { ...question(), questionId: '__proto__', response: { text: 'คำตอบ', score: 100, private: 'PRIVATE' },
      options: [{ id: 'option', text: 'Choice', correct: true, private: 'PRIVATE' }] };
    const projected = projectAttempt(row(), [q]);
    expect(Object.prototype.hasOwnProperty.call(projected.answers, '__proto__')).toBe(true); expect(projected.answers.__proto__).toEqual({ text: 'คำตอบ' });
    expect(projected.questions[0].options).toEqual([{ id: 'option', text: 'Choice' }]); expect(JSON.stringify(projected)).not.toContain('PRIVATE');
  });
  it('does not silently reinterpret internal Submitted state or noncanonical snapshot fields', () => {
    expect(() => projectAttempt({ ...row(), status: 'submitted' }, [question()])).toThrow();
    expect(() => projectAttempt(row(), [{ ...question(), prompt: { text: 'not canonical plain prompt' } }])).toThrow();
    expect(() => projectAttempt(row(), [{ ...question(), options: [{ id: 'a', text: 'x' }, { id: 'a', text: 'y' }] }])).toThrow();
  });
});
