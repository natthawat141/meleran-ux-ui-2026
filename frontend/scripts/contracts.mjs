import { readFile, writeFile, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import SwaggerParser from '@apidevtools/swagger-parser';
import { inventoryMockOperations } from './contract-inventory.mjs';

export const contractPath = resolve('packages/contracts/openapi/openapi.json');
export async function readContract() { return JSON.parse(await readFile(contractPath, 'utf8')); }

export async function validateContract() {
  const canonical = new URL('../../docs/api-contract/openapi.json', import.meta.url);
  if (existsSync(canonical)) {
    const expected = (await readFile(canonical, 'utf8')).replaceAll('\r\n', '\n');
    const current = (await readFile(contractPath, 'utf8')).replaceAll('\r\n', '\n');
    if (expected !== current) throw new Error('Workspace canonical contract drift. Run npm run contracts:sync.');
  }
  const doc = await readContract();
  // Local input and local refs only; no resolver fetches remote schemas.
  await SwaggerParser.validate(structuredClone(doc), { resolve: { http: false } });
  const ids = new Set();
  const indexed = new Set();
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (!['get','post','put','patch','delete'].includes(method)) continue;
      if (ids.has(operation.operationId)) throw new Error(`Duplicate operationId ${operation.operationId}`);
      ids.add(operation.operationId); indexed.add(`${method.toUpperCase()} ${path}`);
      if (!operation['x-permission']) throw new Error(`Missing permission ${path}`);
    }
  }
  for (const entry of doc['x-deferred-operations']) indexed.add(`${entry.method} ${entry.path}`);
  const inventory = await inventoryMockOperations();
  const current = new Set(inventory.map(({method,path}) => `${method} ${path}`));
  for (const key of current) if (!indexed.has(key)) throw new Error(`Unmapped mock operation ${key}`);
  for (const key of indexed) if (!current.has(key)) throw new Error(`Missing mock operation ${key}`);
  console.log(`Contract valid: ${ids.size} defined, ${doc['x-deferred-operations'].length} deferred; ${current.size} operations inventoried.`);
  return doc;
}

export async function generateContractTypes(check = false) {
  const doc = await validateContract();
  // The generator needs the TS compiler API, which native TypeScript 7 does not expose.
  // Its isolated tooling installation keeps the apps' compiler and dependencies intact.
  const { createClient } = await import('../tools/contract-codegen/generate.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'melearn-contract-types-'));
  try {
    await createClient({ input: doc, output: { path: directory }, plugins: ['@hey-api/typescript'] });
    const files = await readdir(directory);
    const target = resolve('packages/contracts/src/generated');
    if (check) {
      const current = (await readdir(target)).filter(file=>file.endsWith('.ts')).sort();
      if (JSON.stringify(current)!==JSON.stringify(files.filter(file=>file.endsWith('.ts')).sort())) {
        throw new Error('Generated contract file set drift');
      }
    }
    if (!check) await mkdir(target, { recursive: true });
    for (const file of files.filter(file => file.endsWith('.ts'))) {
      const content = await readFile(join(directory,file), 'utf8');
      if (check) {
        const existing = await readFile(join(target,file), 'utf8');
        if (existing.replace(/\r\n/g, '\n') !== content.replace(/\r\n/g, '\n')) throw new Error(`Generated contract drift: ${file}. Run npm run contracts:generate.`);
      } else await writeFile(join(target,file), content);
    }
  } finally {
    // Only the exact mkdtemp-owned directory is removed, with Node native file APIs.
    await rm(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  if (process.argv.includes('--generate')) await generateContractTypes();
  else if (process.argv.includes('--check')) await generateContractTypes(true);
  else await validateContract();
}
