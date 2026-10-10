// Generate reviewable SQL only: no connection, shadow database or DDL execution.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const batches = {
  db02: ['db01', '20261011010000_db02'],
  db05: ['db02', '20261011020000_db05'],
  db03: ['db05', '20261011030000_db03'],
  db04: ['db03', '20261011040000_db04'],
};
const batch = batches[process.argv[2]];
if (!batch) throw new Error('Expected reviewed schema batch identifier.');
const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js',
  'migrate', 'diff', '--from-schema-datamodel', `prisma/baselines/${batch[0]}.prisma`,
  '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], {
  cwd: root, encoding: 'utf8', env: { ...process.env,
    DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:5433/melearn_test' },
});
if (result.status !== 0) throw new Error('Schema delta generation failed; review schema validation.');
const destination = path.join(root, 'prisma/migrations', batch[1], 'migration.sql');
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, `BEGIN;\n${result.stdout}\nCOMMIT;\n`, { flag: 'wx' });
console.log(`Generated ${batch[1]} for Lead review; nothing applied.`);
