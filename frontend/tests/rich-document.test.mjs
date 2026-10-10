import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';

// Node's native type stripping does not handle TSX. Compile this React-only
// module in memory; package/app typechecks independently validate its types.
const rendererUrl = new URL('../packages/ui/src/RichDocument.tsx', import.meta.url);
const source = await readFile(rendererUrl, 'utf8');
const compiled = await transformWithEsbuild(source, fileURLToPath(rendererUrl), {
  target: 'es2022',
  format: 'cjs',
  jsx: 'transform',
});
assert.deepEqual(compiled.warnings, [], 'Renderer TSX must transpile without warnings');
const module = { exports: {} };
runInNewContext(compiled.code, { module, exports: module.exports, require: createRequire(rendererUrl) }, { filename: fileURLToPath(rendererUrl) });
const { RichDocument, textDocument } = module.exports;
const render = (props) => renderToStaticMarkup(React.createElement(RichDocument, props));
const text = (value, marks) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
const paragraph = (...content) => ({ type: 'paragraph', content });
const document = (...content) => ({ type: 'doc', content });

test('rich document preserves plain-text fallback, empty lines and escaped text', () => {
  assert.equal(render({ text: 'บรรทัดแรก\n\n<img src=x onerror=alert(1)>' }),
    '<div class="chapter-rich-document"><div><p>บรรทัดแรก</p><p></p><p>&lt;img src=x onerror=alert(1)&gt;</p></div></div>');
  assert.equal(render({}), '<div class="chapter-rich-document"><div><p></p></div></div>');
  assert.equal(render({ document: document(paragraph(text('stored'))), text: 'fallback' }),
    '<div class="chapter-rich-document"><div><p>stored</p></div></div>');
  assert.equal(textDocument('a\n\nb').content.length, 3);
});

test('rich document preserves supported block nodes and unknown-node fallback', () => {
  const html = render({ document: document(
    { type: 'heading', attrs: { level: 2 }, content: [text('H2')] },
    { type: 'heading', attrs: { level: 3 }, content: [text('H3')] },
    { type: 'heading', attrs: { level: 6 }, content: [text('fallback H2')] },
    paragraph(text('before'), { type: 'hardBreak' }, text('after')),
    { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('bullet'))] }] },
    { type: 'orderedList', content: [{ type: 'listItem', content: [paragraph(text('number'))] }] },
    { type: 'blockquote', content: [paragraph(text('quote'))] },
    { type: 'codeBlock', content: [text('a < b')] },
    { type: 'unsupported', content: [text('kept child')] },
  ) });
  assert.equal(html, '<div class="chapter-rich-document"><div><h2>H2</h2><h3>H3</h3><h2>fallback H2</h2><p>before<br/>after</p><ul><li><p>bullet</p></li></ul><ol><li><p>number</p></li></ol><blockquote><p>quote</p></blockquote><pre>a &lt; b</pre><div>kept child</div></div></div>');
});

test('rich document preserves mark order and HTTP links with safe target attributes', () => {
  assert.equal(render({ document: document(paragraph(text('marked', [
    { type: 'bold' }, { type: 'italic' }, { type: 'highlight' }, { type: 'unknown' },
  ]))) }), '<div class="chapter-rich-document"><div><p><mark class="text-highlight"><em><strong>marked</strong></em></mark></p></div></div>');
  for (const href of ['http://example.test/a', 'https://example.test/a', 'HTTPS://example.test/a']) {
    const html = render({ document: document(paragraph(text('link', [{ type: 'link', attrs: { href } }]))) });
    assert.ok(html.includes(`href="${href}" target="_blank" rel="noopener noreferrer"`));
  }
});

test('rich document rejects unsafe and unsupported link schemes while keeping link text', () => {
  for (const href of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)', 'ftp://example.test/a', 'blob:https://example.test/a', '//example.test/a', '/relative', '']) {
    assert.equal(render({ document: document(paragraph(text('visible', [{ type: 'link', attrs: { href } }]))) }),
      '<div class="chapter-rich-document"><div><p>visible</p></div></div>', href);
  }
});

test('rich document preserves supported image URLs, alignment classes and default alt text', () => {
  for (const src of ['http://example.test/image.png', 'https://example.test/image.png', 'data:image/png;base64,YQ==', 'data:image/jpeg;base64,YQ==', 'data:image/webp;base64,YQ==']) {
    const html = render({ document: document({ type: 'image', attrs: { src } }) });
    assert.ok(html.includes(`class="rich-figure rich-figure-center" src="${src}" alt="ภาพประกอบ"`));
  }
  for (const align of ['left', 'center', 'right', 'wide']) {
    const html = render({ document: document({ type: 'image', attrs: { src: 'data:image/png;base64,YQ==', alt: 'ภาพเดิม', align } }) });
    assert.match(html, new RegExp(`class="rich-figure rich-figure-${align}"`));
    assert.match(html, /alt="ภาพเดิม"/);
  }
  assert.match(render({ document: document({ type: 'image', attrs: { src: 'data:image/png;base64,YQ==', align: 'unsupported' } }) }), /rich-figure-center/);
});

test('rich document rejects unsafe and unsupported image schemes without emitting an image', () => {
  for (const src of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'data:image/svg+xml;base64,YQ==', 'blob:https://example.test/a', 'ftp://example.test/image.png', '//example.test/image.png', '/relative.png', '']) {
    assert.equal(render({ document: document({ type: 'image', attrs: { src } }) }),
      '<div class="chapter-rich-document"><div></div></div>', src);
  }
});

test('the shared renderer loads without editor, uploader or app dependencies', () => {
  assert.deepEqual([...source.matchAll(/\bfrom ['"]([^'"]+)['"]/g)].map((match) => match[1]), ['react']);
  assert.doesNotMatch(source, /useLms|FileReader|@tiptap|dangerouslySetInnerHTML/);
});
