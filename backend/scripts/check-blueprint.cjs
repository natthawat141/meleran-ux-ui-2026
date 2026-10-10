const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const load = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const matrix = load('docs/implementation/OPERATION_MATRIX.json');
const board = load('docs/implementation/EXECUTION_STATUS.json');
const contractBytes = fs.readFileSync(path.join(root, 'docs/api-contract/openapi.json'));
const contract = JSON.parse(contractBytes);
const hash = crypto.createHash('sha256').update(contractBytes).digest('hex');
assert.equal(hash, matrix.meta.contract_sha256, 'Canonical contract drift needs reviewed revision/mapping');
assert.equal(hash, board.contract.sha256);
assert.equal(contract.info.version, board.contract.version);
assert.equal(matrix.defined_operations.length, 86);
assert.equal(matrix.deferred_operations.length, 5);
assert.equal(matrix.acceptance_cases.length, 113);
assert.equal(matrix.tasks.length, 50);
assert.equal(board.tasks.length, 50);
const defined = new Map();
for (const [route, item] of Object.entries(contract.paths)) for (const [method, operation] of Object.entries(item)) {
  if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method))
    defined.set(`${method.toUpperCase()} ${route}`, operation);
}
assert.equal(defined.size, 86);
const taskIds = new Set(board.tasks.map(task => task.id));
assert.equal(taskIds.size, 50);
const seen = new Set();
for (const operation of matrix.defined_operations) {
  const key = `${operation.method} ${operation.path}`;
  assert.ok(!seen.has(key), `Duplicate operation ${key}`); seen.add(key);
  const canonical = defined.get(key);
  assert.ok(canonical, `Unmapped canonical operation ${key}`);
  assert.equal(operation.operationId, canonical.operationId);
  assert.ok(taskIds.has(operation.task_id));
  assert.deepEqual(Object.keys(operation.responses).sort(), Object.keys(canonical.responses).sort());
  for (const [status, response] of Object.entries(operation.responses)) for (const [media, content] of Object.entries(response.content || {}))
    assert.deepEqual(content.schema, canonical.responses[status].content[media].schema);
  if (canonical.requestBody) for (const [media, content] of Object.entries(operation.request.content))
    assert.deepEqual(content.schema, canonical.requestBody.content[media].schema);
  // Scope does not provide a dedicated numbered case for every read operation.
  // Preserve all original cases; feature tests cover these operations separately.
  for (const id of operation.acceptance_ids) assert.ok(matrix.acceptance_cases.some(test => test.id === id));
}
assert.deepEqual(seen, new Set(defined.keys()));
const scope = fs.readFileSync(path.join(root, 'docs/MELEARN_V1_SCOPE.md'), 'utf8');
const scopeCases = new Map([...scope.matchAll(/^\|\s*([A-Z]+\d{2})\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/gm)]
  .map(match => [match[1], { action: match[2].trim(), expected: match[3].trim() }]));
assert.equal(scopeCases.size, 113);
assert.equal(new Set(matrix.acceptance_cases.map(test => test.id)).size, 113);
for (const test of matrix.acceptance_cases) {
  assert.deepEqual({ action: test.action, expected: test.expected }, scopeCases.get(test.id), `Scope acceptance changed: ${test.id}`);
  assert.ok(test.task_ids.length);
  for (const id of test.task_ids) assert.ok(taskIds.has(id));
}
const visiting = new Set(), visited = new Set();
function visit(id) {
  assert.ok(!visiting.has(id), `Dependency cycle at ${id}`);
  if (visited.has(id)) return;
  visiting.add(id);
  const task = board.tasks.find(row => row.id === id);
  assert.ok(fs.existsSync(path.join(root, 'docs/implementation/tasks', id + '.md')));
  for (const dependency of task.dependencies) { assert.ok(taskIds.has(dependency)); visit(dependency); }
  if (task.state === 'READY') {
    assert.equal(task.decision_ids.length, 0);
    for (const dependency of task.dependencies) assert.equal(board.tasks.find(row => row.id === dependency).state, 'DONE');
  }
  visiting.delete(id); visited.add(id);
}
for (const id of taskIds) visit(id);
const migrationRoot = path.join(root, 'backend/prisma/migrations');
const migrationNames = fs.readdirSync(migrationRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
assert.deepEqual(board.environment.migrations.map(migration => migration.name).sort(), migrationNames,
  'Every migration batch must have a traceable checksum in the execution board');
for (const migration of board.environment.migrations) {
  const bytes = fs.readFileSync(path.join(root, 'backend/prisma/migrations', migration.name, 'migration.sql'));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), migration.sha256);
}
console.log('Blueprint PASS: 86 canonical operations, 5 deferred, 113 exact scope cases, 50-task DAG and migration checksums.');
console.log(`${matrix.defined_operations.filter(operation => !operation.acceptance_ids.length).length} read operations have no dedicated original numbered case; targeted feature tests remain required.`);
