const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const owners = {
  auth: ['account', 'userRole', 'localCredential', 'appSession', 'externalIdentity'],
  courses: ['course', 'courseChapter', 'courseItem', 'courseReview', 'quiz', 'question'],
  enrollments: ['enrollment', 'progress'],
  assessments: ['quizAttempt', 'attemptQuestion', 'answer'],
  certificates: ['certificate'],
  payments: ['payment', 'paymentEvent'],
  redeem: ['redeemCode'],
  ai: ['videoTranscript', 'aIConversation', 'aIMessage', 'aIRequest', 'aIUsageDaily', 'aIPractice'],
  blog: ['blogPost'], accounts: [], management: [],
};

// This static gate catches direct Prisma writes/private imports. It is not a proof
// about dynamic SQL/aliases; those require task review and authorization tests.
function violations(file, source) {
  const errors = [];
  const feature = file.match(/^src\/features\/([^/]+)\//)?.[1];
  for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const imported = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]));
    const other = imported.match(/^src\/features\/([^/]+)\/(.+)$/);
    if (feature && other && other[1] !== feature && !/(?:\.module|\/public|\/index)$/.test(other[2])) errors.push('private cross-feature import');
    if (file.endsWith('.controller.ts') && /\/prisma\//.test(imported)) errors.push('controller imports persistence');
    if (/\/test\//.test('/' + imported) || /fixtures/.test(imported)) errors.push('runtime imports test fixtures');
  }
  if (feature) for (const match of source.matchAll(/(?:this\.)?(?:prisma|tx)\.(\w+)\.(?:create|createMany|update|updateMany|delete|deleteMany|upsert)\s*\(/g)) {
    if (!(owners[feature] || []).includes(match[1])) errors.push(`write outside ${feature} ownership: ${match[1]}`);
  }
  return [...new Set(errors)];
}

function inspect(root) {
  const baseline = JSON.parse(fs.readFileSync(path.join(root, 'test/architecture-baseline.json'), 'utf8'));
  const errors = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.name.endsWith('.ts')) {
        const file = path.relative(root, absolute).replaceAll(path.sep, '/');
        const bytes = fs.readFileSync(absolute), findings = violations(file, bytes.toString());
        if (findings.length && baseline[file]?.sha256 !== crypto.createHash('sha256').update(bytes.toString().replaceAll('\r\n', '\n')).digest('hex'))
          errors.push(`${file}: ${findings.join('; ')}`);
      }
    }
  }
  walk(path.join(root, 'src'));
  return errors;
}
module.exports = { violations, inspect };
if (require.main === module) {
  const errors = inspect(path.resolve(__dirname, '..'));
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log('Boundary gate passed; unchanged quarantined prototype writers remain tracked.');
}
