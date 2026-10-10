import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokenPath = path.join(root, 'packages/ui/src/design-tokens.json');
const tokenCssPath = path.join(root, 'packages/ui/src/tokens.css');
const tailwindCssPath = path.join(root, 'packages/ui/src/tailwind.css');
const check = process.argv.includes('--check');
const source = JSON.parse(await readFile(tokenPath, 'utf8'));
function valueAtPath(path) {
  return path.split('.').reduce((value, key) => {
    if (value === null || typeof value !== 'object' || !(key in value)) {
      throw new Error(`Unknown design token reference: ${path}`);
    }
    return value[key];
  }, source);
}
function resolveValue(value, path = []) {
  if (typeof value === 'string' && value.startsWith('$')) {
    const reference = value.slice(1);
    if (path.includes(reference)) throw new Error(`Circular design token reference: ${reference}`);
    return resolveValue(valueAtPath(reference), [...path, reference]);
  }
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, path));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, resolveValue(nested, path)]));
  }
  return value;
}
const tokens = resolveValue(source);

const declarationBlock = (values, selector) => [
  `${selector} {`,
  ...Object.entries(values).map(([name, value]) => `    --${name}: ${value};`),
  '}',
].join('\n');

const appTokens = {
  'font-family': tokens.fontFamily,
  'focus-ring': tokens.legacy.focusRing,
  ink: tokens.colorModes.light.colorText,
  'ink-secondary': tokens.colorModes.light.colorTextSecondary,
  'ink-tertiary': tokens.colorModes.light.colorTextTertiary,
  primary: tokens.colorModes.light.colorPrimary,
  'primary-hover': tokens.legacy.primaryHover,
  'primary-soft': tokens.legacy.primarySoft,
  accent: tokens.colorModes.light.colorInfo,
  'accent-soft': tokens.legacy.accentSoft,
  highlight: tokens.colorModes.light.colorPrimary,
  'highlight-soft': tokens.legacy.highlightSoft,
  canvas: tokens.colorModes.light.colorBgLayout,
  surface: tokens.colorModes.light.colorBgContainer,
  'surface-muted': tokens.colorModes.light.colorFillAlter,
  line: tokens.colorModes.light.colorBorder,
  'line-soft': tokens.legacy.lineSoft,
  success: tokens.colorModes.light.colorSuccess,
  warning: tokens.colorModes.light.colorWarning,
  danger: tokens.colorModes.light.colorError,
  radius: tokens.legacy.radius,
  'mantine-color-dimmed': tokens.colorModes.light.colorTextSecondary,
  'home-blue': 'var(--primary)',
  'home-blue-hover': 'var(--primary-hover)',
  'home-ink': 'var(--ink)',
  'home-muted': 'var(--ink-secondary)',
  'home-line': 'var(--line)',
  'home-sky': tokens.landing.legacy.sky,
  'home-focus-ring': tokens.landing.legacy.focusRing,
  'home-decoration-blue-24': tokens.landing.legacy.decorationBlue24,
  'home-decoration-blue-28': tokens.landing.legacy.decorationBlue28,
  'home-shadow-rest': tokens.landing.legacy.shadowRest,
  'home-shadow-raised': tokens.landing.legacy.shadowRaised,
  'brand-blue': tokens.landing.brand.blue,
  'brand-blue-hover': tokens.landing.brand.blueHover,
  'brand-cyan': tokens.landing.brand.cyan,
  'brand-red': tokens.landing.brand.red,
  'brand-ink': tokens.landing.brand.ink,
  'brand-muted': tokens.landing.brand.muted,
  'brand-sky': tokens.landing.brand.sky,
  'brand-line': tokens.landing.brand.line,
  'brand-soft-sky': tokens.landing.brand.softSky,
  'brand-bright-sky': tokens.landing.brand.brightSky,
};

const tokenCss = `/* Generated from design-tokens.json by scripts/generate-ui-tokens.mjs. */\n${declarationBlock(appTokens, ':root')}\n`;

const themeMappings = {
  '--font-heading': 'var(--font-family)',
  '--font-sans': 'var(--font-family)',
  '--color-canvas': 'var(--canvas)',
  '--color-surface': 'var(--surface)',
  '--color-surface-muted': 'var(--surface-muted)',
  '--color-ink': 'var(--ink)',
  '--color-ink-secondary': 'var(--ink-secondary)',
  '--color-line': 'var(--line)',
  '--color-line-soft': 'var(--line-soft)',
  '--color-accent-soft': 'var(--accent-soft)',
  '--color-highlight': 'var(--highlight)',
  '--color-highlight-soft': 'var(--highlight-soft)',
  '--color-primary-hover': 'var(--primary-hover)',
  '--color-primary-soft': 'var(--primary-soft)',
  '--color-success': 'var(--success)',
  '--color-warning': 'var(--warning)',
  '--color-danger': 'var(--danger)',
  '--color-sidebar-ring': 'var(--sidebar-ring)',
  '--color-sidebar-border': 'var(--sidebar-border)',
  '--color-sidebar-accent-foreground': 'var(--sidebar-accent-foreground)',
  '--color-sidebar-accent': 'var(--sidebar-accent)',
  '--color-sidebar-primary-foreground': 'var(--sidebar-primary-foreground)',
  '--color-sidebar-primary': 'var(--sidebar-primary)',
  '--color-sidebar-foreground': 'var(--sidebar-foreground)',
  '--color-sidebar': 'var(--sidebar)',
  '--color-chart-5': 'var(--chart-5)',
  '--color-chart-4': 'var(--chart-4)',
  '--color-chart-3': 'var(--chart-3)',
  '--color-chart-2': 'var(--chart-2)',
  '--color-chart-1': 'var(--chart-1)',
  '--color-ring': 'var(--ring)',
  '--color-input': 'var(--input)',
  '--color-border': 'var(--border)',
  '--color-destructive': 'var(--destructive)',
  '--color-accent-foreground': 'var(--accent-foreground)',
  '--color-accent': 'var(--accent)',
  '--color-muted-foreground': 'var(--muted-foreground)',
  '--color-muted': 'var(--muted)',
  '--color-secondary-foreground': 'var(--secondary-foreground)',
  '--color-secondary': 'var(--secondary)',
  '--color-primary-foreground': 'var(--primary-foreground)',
  '--color-primary': 'var(--primary)',
  '--color-popover-foreground': 'var(--popover-foreground)',
  '--color-popover': 'var(--popover)',
  '--color-card-foreground': 'var(--card-foreground)',
  '--color-card': 'var(--card)',
  '--color-foreground': 'var(--foreground)',
  '--color-background': 'var(--background)',
  '--radius-sm': tokens.tailwind.radii.sm,
  '--radius-md': tokens.tailwind.radii.md,
  '--radius-lg': tokens.tailwind.radii.lg,
  '--radius-xl': tokens.tailwind.radii.xl,
  '--radius-2xl': 'calc(var(--radius) * 1.8)',
  '--radius-3xl': 'calc(var(--radius) * 2.2)',
  '--radius-4xl': 'calc(var(--radius) * 2.6)',
};

const themeBlock = [
  '@theme inline {',
  ...Object.entries(themeMappings).map(([name, value]) => `    ${name}: ${value};`),
  '}',
].join('\n');

const tailwindCss = `/* Generated from design-tokens.json. Do not add Tailwind Preflight here. */
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

${themeBlock}

${declarationBlock(tokens.shadcn.light, ':root')}

${declarationBlock(tokens.shadcn.dark, '.dark')}
`;

const outputs = [[tokenCssPath, tokenCss], [tailwindCssPath, tailwindCss]];
let stale = false;
for (const [filePath, content] of outputs) {
  if (check) {
    const existing = (await readFile(filePath, 'utf8').catch(() => '')).replace(/\r\n?/g, '\n');
    if (existing !== content) {
      console.error(`${path.relative(root, filePath)} is stale. Run npm run tokens:generate.`);
      stale = true;
    }
  } else {
    await writeFile(filePath, content, 'utf8');
    console.log(`Generated ${path.relative(root, filePath)}`);
  }
}
if (check && stale) process.exitCode = 1;
