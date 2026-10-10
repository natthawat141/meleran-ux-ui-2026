import { Prisma } from '@prisma/client';
import { summarizeSubmittedScores } from './submitted-score';

const d = (value: string | number) => new Prisma.Decimal(value);
describe('ASSESS-01 submitted snapshot score component — Scope §2.6 / §5.6', () => {
  it.each([['7', false], ['7.000000000000000000000000000001', true], ['6.999999999999999999999999999999', false]] as const)(
    'compares %s / 10 against strict >70 without rounding', (score, passed) => {
      const result = summarizeSubmittedScores([{ maxScore: d(10), score: d(score) }]);
      expect(result.passed).toBe(passed); expect(result.status).toBe('graded');
      expect(result.score.toString()).toBe(score);
    });
  it('sums snapshot maximums and earned points exactly rather than averaging question percentages', () => {
    const result = summarizeSubmittedScores([{ maxScore: d(90), score: d(90) }, { maxScore: d(10), score: d(0) }]);
    expect(result.score.toString()).toBe('90'); expect(result.maxScore.toString()).toBe('100'); expect(result.passed).toBe(true);
  });
  it('keeps an attempt pending with no pass result until every manual grade exists', () => {
    const result = summarizeSubmittedScores([{ maxScore: d(90), score: d(90) }, { maxScore: d(10), score: null }]);
    expect(result.status).toBe('pending_review'); expect(result.passed).toBeNull(); expect(result.score.toString()).toBe('90');
  });
  it('does not treat a zero maximum as a pass', () => {
    expect(summarizeSubmittedScores([{ maxScore: d(0), score: d(0) }]).passed).toBe(false);
  });
  it('rejects negative, non-finite and out-of-snapshot-bounds stored grades', () => {
    for (const score of ['-1','NaN','Infinity','11'])
      expect(() => summarizeSubmittedScores([{ maxScore: d(10), score: d(score) }])).toThrow('Invalid snapshot grade');
    for (const max of ['-1','NaN','Infinity'])
      expect(() => summarizeSubmittedScores([{ maxScore: d(max), score: null }])).toThrow('Invalid snapshot maximum');
    expect(() => summarizeSubmittedScores([])).toThrow('Missing attempt question snapshot');
  });
  it('does not mutate stored snapshots, grade rows or global Decimal precision', () => {
    const precision = Prisma.Decimal.precision;
    const grade = Object.freeze({ maxScore: d(10), score: d(8) });
    summarizeSubmittedScores(Object.freeze([grade]));
    expect(grade.score.toString()).toBe('8'); expect(grade.maxScore.toString()).toBe('10'); expect(Prisma.Decimal.precision).toBe(precision);
  });
});
