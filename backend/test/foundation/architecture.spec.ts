import { resolve } from 'node:path';
const { violations, inspect } = require('../../scripts/check-boundaries.cjs') as {
  violations(file: string, source: string): string[];
  inspect(root: string): string[];
};
describe('architecture regression gate', () => {
  it('checks the actual runtime tree against explicit prototype exceptions', () => {
    expect(inspect(resolve(__dirname, '../..'))).toEqual([]);
  });
  it('rejects private cross-feature imports but permits declared modules/interfaces', () => {
    expect(violations('src/features/blog/blog.service.ts', "import { X } from '../auth/auth.service';")).toEqual(['private cross-feature import']);
    expect(violations('src/features/blog/blog.module.ts', "import { X } from '../auth/auth.module';")).toEqual([]);
  });
  it('rejects cross-owner writes and accepts owner-local persistence', () => {
    expect(violations('src/features/blog/blog.service.ts', 'await tx.account.update({});')).toEqual(['write outside blog ownership: account']);
    expect(violations('src/features/blog/blog.service.ts', 'await tx.blogPost.update({});')).toEqual([]);
  });
  it('rejects controller persistence and runtime test-fixture imports', () => {
    expect(violations('src/features/blog/blog.controller.ts', "import { X } from '../../prisma/prisma.service';")).toEqual(['controller imports persistence']);
    expect(violations('src/main.ts', "import { X } from '../test/fixtures/demo';")).toEqual(['runtime imports test fixtures']);
  });
});
