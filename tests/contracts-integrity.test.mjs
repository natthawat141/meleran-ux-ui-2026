import test from 'node:test';
import assert from 'node:assert/strict';

test('packages/contracts exports canonical domain and API contracts', async () => {
  const contracts = await import('../packages/contracts/src/index.ts');

  // Verify that the module is loaded and provides the exported contract utilities/constants
  assert.ok(contracts, 'contracts module must load');
  assert.equal(typeof contracts, 'object', 'contracts export must be an object');

  // Value exports
  assert.equal(contracts.DEFAULT_CURRENCY, 'THB');
  assert.equal(contracts.mockCurrency, 'THB');
});

test('packages/contracts has valid typescript definitions for all flows', async () => {
  // Read index.ts and verify all domain files are re-exported
  const fs = await import('node:fs/promises');
  const indexContent = await fs.readFile('packages/contracts/src/index.ts', 'utf8');

  const requiredModules = [
    './common.ts',
    './auth.ts',
    './courses.ts',
    './learning.ts',
    './assessment.ts',
    './certificate.ts',
    './payment.ts',
    './ai.ts',
    './blog.ts',
    './authoring.ts',
  ];

  for (const mod of requiredModules) {
    assert.ok(indexContent.includes(`export * from '${mod}';`), `Must export ${mod}`);
  }
});
