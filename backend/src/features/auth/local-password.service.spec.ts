import { LocalPasswordService, normalizedLocalUsername } from './local-password.service';

describe('approved local credential policy', () => {
  const passwords = new LocalPasswordService();
  it('normalizes only canonical ASCII usernames without changing punctuation', () => {
    expect(normalizedLocalUsername('Bill_1.Name')).toBe('BILL_1.NAME');
    expect(normalizedLocalUsername('a'.repeat(30))).toBe('A'.repeat(30));
    for (const value of ['ab', 'a'.repeat(31), ' bill ', 'bill@example.com', 'ชื่อผู้ใช้', 'a-b', '', null, {}])
      expect(normalizedLocalUsername(value)).toBeNull();
  });
  it('creates salted, versioned bounded-work hashes and verifies exact untrimmed passwords', async () => {
    const a = await passwords.create(' Password '), b = await passwords.create(' Password ');
    expect(a).not.toBe(b); expect(a).toMatch(/^melearn:pbkdf2-sha256:v1:600000:[a-f0-9]{32}:[a-f0-9]{64}$/);
    expect(await passwords.verify(a, ' Password ')).toBe(true);
    expect(await passwords.verify(a, 'Password')).toBe(false);
    expect(await passwords.verify(a, ' password ')).toBe(false);
  });
  it('accepts 8 and 128 characters and rejects out-of-policy new passwords', async () => {
    for (const value of ['a'.repeat(8), 'a'.repeat(128)]) expect(await passwords.verify(await passwords.create(value), value)).toBe(true);
    for (const value of ['', 'a'.repeat(7), 'a'.repeat(129)]) await expect(passwords.create(value)).rejects.toThrow();
  });
  it('counts Unicode characters and preserves normalization and whitespace distinctions', async () => {
    const value = '😀'.repeat(128), encoded = await passwords.create(value);
    expect(await passwords.verify(encoded, value)).toBe(true);
    await expect(passwords.create(value + '😀')).rejects.toThrow();
    const combined = await passwords.create('éabcdefg');
    expect(await passwords.verify(combined, 'e\u0301abcdefg')).toBe(false);
  });
  it('does not treat prototype hashes or forged algorithm/work metadata as verified credentials', async () => {
    const valid = await passwords.create('password');
    for (const stored of [undefined, 'salt:key', valid.replace('600000', '1'), valid.replace('600000', '9999999999'), valid.replace('v1', 'v2'), valid + ':extra'])
      expect(await passwords.verify(stored, 'password')).toBe(false);
  });
  it('rejects tampering of salt/key and never truncates an oversized attempt', async () => {
    const valid = await passwords.create('password'), parts = valid.split(':');
    const modified = [...parts]; modified[5] = 'f'.repeat(64);
    expect(await passwords.verify(modified.join(':'), 'password')).toBe(false);
    expect(await passwords.verify(valid, 'password' + 'a'.repeat(129))).toBe(false);
    expect(await passwords.verify(valid, '')).toBe(false);
  });
});
