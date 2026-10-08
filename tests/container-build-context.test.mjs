import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

test('both Docker build contexts include every workspace manifest and only existing COPY sources', () => {
  const packages = readdirSync(new URL('../packages/', import.meta.url), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  for (const app of ['web', 'admin']) {
    const source = readFileSync(new URL(`../apps/${app}/Dockerfile`, import.meta.url), 'utf8');
    for (const packageName of packages) assert.ok(source.includes(`COPY packages/${packageName}/package.json`), `${app} must include ${packageName} before npm ci`);
    for (const match of source.matchAll(/^COPY (?!\-\-)(\S+)/gm)) {
      assert.ok(existsSync(new URL('../' + match[1], import.meta.url)), `${app} COPY source missing: ${match[1]}`);
    }
    assert.ok(source.includes(`dist/${app}/`));
    assert.ok(!source.includes(`COPY apps/${app === 'web' ? 'admin' : 'web'} ./apps/`), 'Other app source must not be compiled');
  }
});
