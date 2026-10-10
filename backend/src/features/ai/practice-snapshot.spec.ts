import { practiceAnswers, practiceSnapshot } from './practice-snapshot';

const payload = () => ({ version: 1, private: 'NOT_A_WIRE_FIELD', questions: [{ id: 'q', prompt: 'โจทย์',
  options: [{ id: 'yes', text: 'ใช่' }, { id: 'no', text: 'ไม่ใช่' }], correct_option_id: 'yes', explanation: 'เหตุผล' }] });

describe('trusted AI practice snapshot parsing', () => {
  it('keeps stable Unicode definitions and ignores unrelated private metadata', () => {
    expect(practiceSnapshot(payload())).toEqual(payload().questions);
  });
  it('rejects missing/unsupported versions, empty sets and missing usable text/key', () => {
    for (const value of [null, {}, { ...payload(), version: 2 }, { version: 1, questions: [] },
      ...['id', 'prompt', 'explanation', 'correct_option_id'].map(key => ({ version: 1, questions: [{ ...payload().questions[0], [key]: ' ' }] }))]) {
      expect(() => practiceSnapshot(value)).toThrow();
    }
  });
  it('rejects duplicate question/option IDs and keys not present in the same question', () => {
    const question = payload().questions[0];
    for (const questions of [[question, question], [{ ...question, options: [question.options[0], question.options[0]] }],
      [{ ...question, correct_option_id: 'foreign' }], [{ ...question, options: [] }]]) {
      expect(() => practiceSnapshot({ version: 1, questions })).toThrow();
    }
  });
  it('rejects malformed, unknown-question, foreign-option and invalid-date saved answers', () => {
    const questions = practiceSnapshot(payload()), at = '2026-10-11T00:00:00.000Z';
    for (const answers of [null, [], { foreign: { option_id: 'yes', answered_at: at } },
      { q: { option_id: 'foreign', answered_at: at } }, { q: { option_id: 'yes', answered_at: 'invalid' } }, { q: 'yes' }]) {
      expect(() => practiceAnswers(questions, answers)).toThrow();
    }
  });
  it('keeps selected option/time only, never trusting supplied correctness or score metadata', () => {
    const answers = practiceAnswers(practiceSnapshot(payload()), { q: { option_id: 'no', answered_at: '2026-10-11T00:00:00.000Z', correct: true, score: 999 } });
    expect(answers.get('q')).toEqual({ option_id: 'no', answered_at: '2026-10-11T00:00:00.000Z' });
    expect(practiceAnswers(practiceSnapshot(payload()), {}).size).toBe(0);
  });
  it('treats prototype-looking server question IDs as ordinary map keys without pollution', () => {
    const questions = practiceSnapshot({ version: 1, questions: [{ ...payload().questions[0], id: '__proto__' }] });
    const answers = practiceAnswers(questions, JSON.parse('{"__proto__":{"option_id":"yes","answered_at":"2026-10-11T00:00:00.000Z"}}'));
    const persisted = Object.fromEntries(answers);
    expect(Object.prototype.hasOwnProperty.call(persisted, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(persisted)).toBe(Object.prototype);
    expect(JSON.parse(JSON.stringify(persisted)).__proto__.option_id).toBe('yes');
  });
});
