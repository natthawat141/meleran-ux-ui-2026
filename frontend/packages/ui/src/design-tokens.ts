import source from './design-tokens.json';

function valueAtPath(path: string) {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value === null || typeof value !== 'object' || !(key in value)) {
      throw new Error(`Unknown design token reference: ${path}`);
    }
    return (value as Record<string, unknown>)[key];
  }, source);
}

function resolveValue(value: unknown, path: string[] = []): unknown {
  if (typeof value === 'string' && value.startsWith('$')) {
    const reference = value.slice(1);
    if (path.includes(reference)) throw new Error(`Circular design token reference: ${reference}`);
    return resolveValue(valueAtPath(reference), [...path, reference]);
  }
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, path));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, resolveValue(nested, path)]),
    );
  }
  return value;
}

/** Resolved design tokens shared by application theme adapters and UI components. */
export const designTokens = resolveValue(source) as typeof source;
