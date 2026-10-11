import { SelfProfilePatchPipe } from './self-profile-patch.pipe';

describe('canonical self profile PATCH validation', () => {
  const pipe = new SelfProfilePatchPipe();
  it('preserves omission, nullable clears and replacement arrays', () => {
    for (const body of [{}, { avatar_url: null }, { profile: { bio: null, interests: [] } }]) {
      expect(pipe.transform(body)).toBe(body);
    }
  });
  it('counts Unicode code points at declared boundaries', () => {
    expect(pipe.transform({ display_name: '😀'.repeat(80), profile: { bio: '😀'.repeat(2000) } })).toBeDefined();
    expect(() => pipe.transform({ display_name: '😀'.repeat(81) })).toThrow();
    expect(() => pipe.transform({ profile: { bio: '😀'.repeat(2001) } })).toThrow();
  });
  it('accepts only the canonical Username alphabet and bounds', () => {
    for (const username of ['abc', 'ABC._123', 'x'.repeat(30)]) expect(pipe.transform({ username })).toEqual({ username });
    for (const username of ['', 'ab', 'x'.repeat(31), 'ชื่อ', 'a b', null]) expect(() => pipe.transform({ username })).toThrow();
  });
  it('rejects server owned and unknown root/nested attributes', () => {
    for (const body of [{ roles: ['admin'] }, { email_verified: true }, { id: 'foreign' }, { profile: { privateAudit: true } },
      JSON.parse('{"profile":{"__proto__":{"admin":true}}}')]) expect(() => pipe.transform(body)).toThrow();
  });
  it('rejects non objects and incorrect nullable/string/array shapes', () => {
    for (const body of [null, [], 'profile', { display_name: null }, { profile: null }, { profile: [] },
      { profile: { interests: null } }, { profile: { learningGoals: [1] } }, { profile: { phone: 42 } }]) {
      expect(() => pipe.transform(body)).toThrow();
    }
  });
  it('enforces array and item bounds without discarding valid empty strings', () => {
    expect(pipe.transform({ profile: { interests: Array(30).fill(''), learningGoals: ['😀'.repeat(200)] } })).toBeDefined();
    expect(() => pipe.transform({ profile: { interests: Array(31).fill('') } })).toThrow();
    expect(() => pipe.transform({ profile: { learningGoals: ['😀'.repeat(201)] } })).toThrow();
  });
});
