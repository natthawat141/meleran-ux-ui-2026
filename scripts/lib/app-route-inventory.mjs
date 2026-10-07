import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Router modules use named imports, static JSX fragments and small composition functions.
// Follow only those composed bindings, so an unreferenced route file cannot satisfy a gate.
export function readAppRouteInventory(root, appName) {
  const files = new Map();
  const routes = [];
  const visiting = new Set();

  function load(file) {
    if (files.has(file)) return files.get(file);
    const source = readFileSync(file, 'utf8');
    const bindings = new Map();
    for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g)) {
      const base = path.resolve(path.dirname(file), match[2]);
      const target = [`${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx')].find(existsSync);
      assert.ok(target, `Missing local route import ${match[2]} in ${file}`);
      for (const imported of match[1].split(',')) {
        const [name, alias = name] = imported.trim().split(/\s+as\s+/);
        bindings.set(alias, { file: target, name });
      }
    }
    for (const match of source.matchAll(/^export const (\w+) = \(\r?\n([\s\S]*?)^\);/gm)) {
      bindings.set(match[1], { jsx: match[2] });
    }
    for (const match of source.matchAll(/^export function (\w+)\(\) \{\r?\n\s*return ([\s\S]*?);\r?\n\}/gm)) {
      bindings.set(match[1], { jsx: match[2] });
    }
    const result = { source, bindings };
    files.set(file, result);
    return result;
  }

  function visitBinding(file, name) {
    const key = `${file}:${name}`;
    assert.ok(!visiting.has(key), `Route composition cycle at ${key}`);
    visiting.add(key);
    const binding = load(file).bindings.get(name);
    assert.ok(binding, `Unsupported or missing route composition ${key}`);
    if (binding.file) visitBinding(binding.file, binding.name);
    else visitJsx(binding.jsx, file);
    visiting.delete(key);
  }

  function routeTagEnd(source, start) {
    let depth = 0;
    let quote = '';
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === quote) quote = '';
      } else if (char === '"' || char === "'" || char === '`') quote = char;
      else if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      else if (char === '>' && depth === 0) return index + 1;
    }
    assert.fail(`Incomplete Route declaration at ${start}`);
  }

  function visitJsx(source, file) {
    const tokens = /<Route\s|\{(\w+)\}|<(\w+)\s*\/>/g;
    let match;
    while ((match = tokens.exec(source))) {
      if (/^<Route\s/.test(match[0])) {
        const end = routeTagEnd(source, match.index);
        const tag = source.slice(match.index, end);
        const routePath = /\bpath=['"]([^'"]+)['"]/.exec(tag)?.[1];
        const element = /\belement=\{([\s\S]+)\}\s*\/>$/.exec(tag)?.[1];
        assert.ok(routePath && element, `Unsupported Route declaration in ${file}`);
        const featurePath = /^featureElement\(['"]([^'"]+)['"]/.exec(element)?.[1] ?? null;
        routes.push({ path: routePath, featurePath, element, file });
        tokens.lastIndex = end;
      } else visitBinding(file, match[1] ?? match[2]);
    }
  }

  const entry = path.join(root, 'apps', appName, 'src', 'App.tsx');
  visitBinding(entry, appName === 'web' ? 'WebRoutes' : 'AdminRoutes');
  assert.ok(routes.length > 0, `${appName} has no composed routes`);
  return routes;
}
