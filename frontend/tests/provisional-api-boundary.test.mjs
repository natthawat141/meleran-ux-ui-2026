import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createProvisionalApi } from '../tools/provisional-api/index.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name === 'dist') return [];
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return /\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name) ? [absolute] : [];
  });
}

test('the provisional API cannot be created outside development and test', () => {
  for (const environment of ['production', 'preview', 'staging', 'Production', 'TEST', '', undefined, null, 0]) {
    assert.throws(() => createProvisionalApi({ environment, basePath: '/api' }), /development or test/, String(environment));
  }
  for (const environment of ['development', 'test']) {
    assert.equal(typeof createProvisionalApi({ environment, basePath: '/api' }).createFetcher(), 'function');
  }
});

test('app runtime code and shared packages never reference the mock', () => {
  for (const directory of ['apps/web/src', 'apps/admin/src', 'packages']) {
    for (const file of sourceFiles(path.join(root, directory))) {
      const source = readFileSync(file, 'utf8');
      assert.ok(!/provisional-api|provisional-mock|tools\/provisional/.test(source), `${path.relative(root, file)} references the provisional mock`);
    }
  }
});

test('the mock may share canonical DTOs but never imports apps or implementation packages', () => {
  for (const file of sourceFiles(path.join(root, 'tools/provisional-api'))) {
    const source = readFileSync(file, 'utf8');
    const label = path.relative(root, file);
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const dependency = match[1];
      if (/@melearn\/|@legacy\/|\/apps\/|\/packages\//.test(dependency)) {
        assert.match(dependency, /^\.\.\/\.\.\/packages\/contracts\/src\//, `${label} imports runtime implementation`);
        assert.ok(source.slice(0, match.index).split('\n').at(-1).includes('import type') || /import type[\s\S]*$/.test(source.slice(Math.max(0, match.index - 180), match.index)), 'Only DTO type imports are allowed');
      }
    }
    assert.ok(!/Math\.random\s*\(/.test(source), `${label} uses Math.random; IDs and codes must be deterministic`);
    assert.ok(!/Date\.now\s*\(|new Date\(\s*\)/.test(source), `${label} reads the system clock; use context.clock`);
    assert.ok(!/\bprocess\.env\b|\bimport\.meta\.env\b/.test(source), `${label} reads environment variables`);
    assert.ok(!/\bfetch\s*\(\s*['"`]https?:/.test(source), `${label} reaches the network`);
  }
});

test('the real HTTP client never receives mock data unless a caller injects the mock fetcher', () => {
  const clientSource = sourceFiles(path.join(root, 'packages/api-client/src')).map((file) => readFileSync(file, 'utf8')).join('\n');
  assert.ok(!/provisional|mock/i.test(clientSource.replace(/\/\/.*$/gm, '')), 'api-client must not know about any mock');
});
