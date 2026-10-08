import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('CI never calls a removed root npm script', () => {
  const workflow=readFileSync(new URL('../.github/workflows/frontend-ci.yml',import.meta.url),'utf8');
  const {scripts}=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  const commands=[...workflow.matchAll(/npm run ([\w:-]+)/g)].map(m=>m[1]);
  assert.ok(commands.length>0);
  for(const script of commands) assert.ok(Object.hasOwn(scripts,script),`CI calls missing npm script: ${script}`);
});
