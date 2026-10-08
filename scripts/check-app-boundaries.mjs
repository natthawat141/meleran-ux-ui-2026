import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAppRouteInventory } from './lib/app-route-inventory.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appNames = ['web', 'admin'];
const packageNames = ['ui', 'api-client', 'contracts', 'course-authoring', 'store'];
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

function sourceFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolutePath);
    return sourceExtensions.has(path.extname(entry.name)) ? [absolutePath] : [];
  });
}

function importSpecifiers(source) {
  const patterns = [
    /\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']/g,
  ];
  return [...new Set(patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1])))];
}

for (const appName of appNames) {
  const appDir = path.join(root, 'apps', appName);
  assert.ok(existsSync(path.join(appDir, 'src', 'main.tsx')), `${appName} entrypoint is missing`);
  assert.ok(existsSync(path.join(appDir, 'vite.config.ts')), `${appName} Vite config is missing`);
  assert.ok(existsSync(path.join(appDir, 'package.json')), `${appName} workspace manifest is missing`);

  for (const file of sourceFiles(path.join(appDir, 'src'))) {
    const code = readFileSync(file, 'utf8');
    for (const specifier of importSpecifiers(code)) {
      assert.ok(!/^@melearn\/(?:web|admin)(?:\/|$)/.test(specifier), `${path.relative(root, file)} imports app package ${specifier}`);
      assert.ok(!specifier.startsWith('@legacy/'), `${path.relative(root, file)} may not depend on legacy code: ${specifier}`);
      if (specifier.startsWith('.')) {
        const resolvedPath = path.resolve(path.dirname(file), specifier);
        const otherAppName = appName === 'web' ? 'admin' : 'web';
        const otherAppPath = path.join(root, 'apps', otherAppName) + path.sep;
        assert.ok(!resolvedPath.startsWith(otherAppPath), `${path.relative(root, file)} imports another app directly: ${specifier}`);
      }
    }
  }
}

for (const packageName of packageNames) {
  const packageDir = path.join(root, 'packages', packageName);
  const manifest = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  const publicEntry = path.join(packageDir, manifest.exports['.']);
  assert.ok(existsSync(publicEntry), `@melearn/${packageName} public entrypoint is missing`);
  for (const file of sourceFiles(path.join(packageDir, 'src'))) {
    for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
      assert.ok(!specifier.startsWith('@legacy/'), `packages/${packageName} may not depend on prototype source (${specifier})`);
      assert.ok(!specifier.includes('/apps/'), `packages/${packageName} may not depend on an app (${specifier})`);
      assert.ok(!/^@melearn\/(?:web|admin)(?:\/|$)/.test(specifier), `packages/${packageName} may not depend on an app package (${specifier})`);
    }
  }
}

const webRoutes = readAppRouteInventory(root, 'web');
const adminRoutes = readAppRouteInventory(root, 'admin');
assert.ok(webRoutes.some((route) => route.path.startsWith('/teach/courses')));
assert.ok(!webRoutes.some((route) => route.path === '/admin' || route.path.startsWith('/admin/')));
assert.ok(adminRoutes.some((route) => route.path === '/admin'));
assert.ok(adminRoutes.some((route) => route.path === '/teach/*' && route.element === '<LegacyAdminRedirect />'));

console.log('App/package dependency direction and route ownership checks passed.');
