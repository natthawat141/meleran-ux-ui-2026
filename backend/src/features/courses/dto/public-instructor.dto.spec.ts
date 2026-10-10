import { publicBio } from './public-instructor.dto';

describe('Public Instructor bio projection', () => {
  it('returns only the public scalar bio from a mixed private profile', () => {
    expect(publicBio('{"bio":"ผู้สอน","phone":"private","bank":"private"}')).toBe('ผู้สอน');
  });
  it('preserves absent, nullable and empty bio shapes', () => {
    expect(publicBio('{}')).toBeNull(); expect(publicBio('{"bio":null}')).toBeNull(); expect(publicBio('{"bio":""}')).toBe('');
  });
  it('fails closed for malformed JSON and incompatible profile or bio types', () => {
    for (const json of ['{','null','[]','1','{"bio":1}','{"bio":{}}']) expect(() => publicBio(json)).toThrow();
  });
});
