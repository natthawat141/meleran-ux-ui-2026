import { IssueCodesPipe, RedeemPipe } from './code-requests.pipe';
describe('canonical code command inputs', () => {
  const issue = new IssueCodesPipe(), redeem = new RedeemPipe();
  it('preserves opaque code input without undocumented normalization', () => {
    expect(redeem.transform({ code: 'MLN-abc' })).toEqual({ code: 'MLN-abc' });
  });
  it('rejects empty code, extra account/course claims and non-object shapes', () => {
    for (const value of [null, [], { code: '' }, { code: 123 }, { code: 'valid', account_id: 'foreign' }]) {
      expect(() => redeem.transform(value)).toThrow();
    }
  });
  it('accepts omitted count and the full declared 1–50 range', () => {
    for (const value of [{ course_id: 'course' }, { course_id: 'course', count: 1 }, { course_id: 'course', count: 50 }]) {
      expect(issue.transform(value)).toEqual(value);
    }
  });
  it('rejects out of range/fractional counts, missing course and privilege injection', () => {
    for (const value of [{}, { course_id: '' }, { course_id: 'course', count: 0 }, { course_id: 'course', count: 51 },
      { course_id: 'course', count: 1.5 }, { course_id: 'course', count: null }, { course_id: 'course', issued_by: 'foreign' }]) {
      expect(() => issue.transform(value)).toThrow();
    }
  });
});
