import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Environment, httpConfiguration, loadLocalEnvironment } from '../../src/shared/config/environment';
import { assertIsolatedTestDatabase } from '../support/test-database';

describe('FOUNDATION-01 configuration', () => {
  it('loads literal values without overwriting explicit process settings', () => {
    const directory = mkdtempSync(join(tmpdir(), 'melearn-env-test-'));
    try {
      const file = join(directory, '.env');
      writeFileSync(file, 'PORT=4000\nFIREBASE_PROJECT_ID=melearn-tutor\nOPENROUTER_API_KEY="test-only#literal"\nGOOGLE_APPLICATION_CREDENTIALS=credentials.json\n');
      const target: Environment = { PORT: '4100' };
      loadLocalEnvironment(file, target);
      expect(target.PORT).toBe('4100');
      expect(target.FIREBASE_PROJECT_ID).toBe('melearn-tutor');
      expect(target.OPENROUTER_API_KEY).toBe('test-only#literal');
      expect(target.GOOGLE_APPLICATION_CREDENTIALS).toBe(join(directory, 'credentials.json'));
    } finally { rmSync(directory, { recursive: true }); }
  });

  it.each(['not-a-port', '0', '65536', '3.5'])('rejects invalid port %s', port => {
    expect(() => httpConfiguration({ PORT: port })).toThrow('PORT');
  });
  it.each(['*', 'https://example.com/path', 'https://example.com/', 'https://user:pass@example.com', 'javascript:alert(1)'])
    ('rejects invalid CORS origin %s', origin => {
      expect(() => httpConfiguration({ CORS_ALLOWED_ORIGIN_WEB: origin })).toThrow('CORS');
    });
  it('does not silently allow development origins in production', () => {
    expect(httpConfiguration({ NODE_ENV: 'production' }).origins).toEqual([]);
  });
  it('keeps configured exact origins', () => {
    expect(httpConfiguration({ CORS_ALLOWED_ORIGIN_WEB: 'http://localhost:5173', CORS_ALLOWED_ORIGIN_ADMIN: 'http://localhost:5174' }).origins)
      .toEqual(['http://localhost:5173', 'http://localhost:5174']);
  });
});

describe('FOUNDATION-01 test database isolation', () => {
  const safe: Environment = {
    NODE_ENV: 'test', ALLOW_TEST_DATABASE_RESET: 'yes', TEST_DATABASE_NAME: 'melearn_test',
    TEST_DATABASE_URL: 'postgresql://test_user:test-only@127.0.0.1:5433/melearn_test',
  };
  it('accepts an explicitly selected isolated PostgreSQL target', () => {
    expect(assertIsolatedTestDatabase(safe)).toBe(safe.TEST_DATABASE_URL);
  });
  it.each([
    { NODE_ENV: 'development' },
    { ALLOW_TEST_DATABASE_RESET: undefined },
    { TEST_DATABASE_URL: '' },
    { TEST_DATABASE_NAME: 'another_test' },
    { TEST_DATABASE_URL: 'file:./dev.db' },
    { TEST_DATABASE_URL: 'postgresql://user:pass@localhost/postgres' },
    { TEST_DATABASE_URL: 'postgresql://user:pass@localhost/melearn_prod', TEST_DATABASE_NAME: 'melearn_prod' },
    { TEST_DATABASE_URL: 'postgresql://user:pass@localhost/melearn_test?schema=prod' },
    { DATABASE_URL: 'postgres://another_user:another@127.0.0.1:5433/melearn_test' },
    { DATABASE_URL: 'not-a-url' },
  ])('rejects unsafe test configuration without connecting (%j)', override => {
    expect(() => assertIsolatedTestDatabase({ ...safe, ...override })).toThrow();
  });
  it('accepts a different runtime database on the same instance', () => {
    expect(() => assertIsolatedTestDatabase({ ...safe, DATABASE_URL: 'postgres://app:pass@127.0.0.1:5433/melearn_dev' })).not.toThrow();
  });
  it('requires the guard before the legacy E2E host initializes', () => {
    const source = readFileSync(join(__dirname, '../app.e2e-spec.ts'), 'utf8');
    expect(source.indexOf('prepareTestDatabase();')).toBeLessThan(source.indexOf('Test.createTestingModule'));
    expect(source.indexOf('prepareTestDatabase();')).toBeLessThan(source.indexOf('.deleteMany()'));
  });
});
