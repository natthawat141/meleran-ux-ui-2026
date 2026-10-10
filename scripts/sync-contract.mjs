import { readFile, writeFile } from 'node:fs/promises';

const canonical = new URL('../../docs/api-contract/openapi.json', import.meta.url);
const snapshot = new URL('../packages/contracts/openapi/openapi.json', import.meta.url);
const expected = (await readFile(canonical, 'utf8')).replaceAll('\r\n', '\n');
JSON.parse(expected);
if (process.argv.includes('--check')) {
  const current = (await readFile(snapshot, 'utf8')).replaceAll('\r\n', '\n');
  if (current !== expected) throw new Error('Canonical contract differs from frontend snapshot. Run npm run contracts:sync.');
  console.log('Frontend contract snapshot matches workspace canonical.');
} else {
  await writeFile(snapshot, expected);
  console.log('Frontend contract snapshot updated. Run contracts:generate and contracts:check.');
}
