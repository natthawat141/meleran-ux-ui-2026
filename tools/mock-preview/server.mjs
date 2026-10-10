// Explicit demo deployment only. No real provider credentials or persistent business data.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProvisionalApi } from '../provisional-api/index.ts';

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.pdf': 'application/pdf' };

export function createPreviewServer({ app, root, upstream }) {
  if (!['web', 'admin'].includes(app)) throw new Error('Invalid demo app');
  if (app === 'admin' && !upstream) throw new Error('Admin needs the shared Web mock URL');
  const api = app === 'web' ? createProvisionalApi({ environment: 'development', basePath: '/mock-api/v1' }) : null;
  const staticRoot = path.resolve(root);
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://preview.invalid');
      res.setHeader('X-Melearn-Deployment', 'mock-preview');
      if (url.pathname === '/health') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); res.end('ok\n'); return; }
      if (url.pathname.startsWith('/mock-api/v1/')) {
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 8 * 1024 * 1024) { res.writeHead(413); res.end(); return; } chunks.push(chunk); }
        const headers = new Headers();
        for (const [name, value] of Object.entries(req.headers)) if (value && !['host', 'connection', 'content-length', 'transfer-encoding'].includes(name)) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
        headers.set('x-melearn-app', app === 'admin' ? 'admin' : headers.get('x-melearn-app') === 'admin' ? 'admin' : 'web');
        const init = { method: req.method, headers, redirect: 'manual', ...(!['GET', 'HEAD'].includes(req.method) ? { body: Buffer.concat(chunks).toString('utf8') } : {}) };
        const response = api
          ? await api.createFetcher({ cookieHeader: req.headers.cookie })(url.pathname + url.search, init)
          : await fetch(new URL(url.pathname + url.search, upstream), init);
        res.statusCode = response.status;
        for (const [name, value] of response.headers) if (!['set-cookie', 'content-length', 'content-encoding', 'transfer-encoding', 'connection'].includes(name)) res.setHeader(name, value);
        const cookies = response.headers.getSetCookie();
        if (cookies.length) res.setHeader('set-cookie', cookies.map(cookie => cookie.includes('Secure') ? cookie : `${cookie}; Secure`));
        res.setHeader('cache-control', 'no-store');
        res.end(Buffer.from(await response.arrayBuffer())); return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.startsWith('/api/') || pathname.startsWith('/mock-api/') || pathname.split('/').some(part => part.startsWith('.'))) { res.writeHead(404); res.end(); return; }
      let file = path.resolve(staticRoot, `.${pathname}`);
      if (file !== staticRoot && !file.startsWith(staticRoot + path.sep)) { res.writeHead(404); res.end(); return; }
      let info = await stat(file).catch(() => null);
      if (!info?.isFile()) {
        if (pathname.startsWith('/assets/') || path.extname(pathname)) { res.writeHead(404); res.end(); return; }
        file = path.join(staticRoot, 'index.html'); info = await stat(file);
      }
      res.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream', 'content-length': info.size, 'cache-control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-store' });
      if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
    } catch { if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { code: 'mock_preview_unavailable', message: 'Mock preview unavailable' } })); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.MELEARN_MOCK_PREVIEW !== 'true') throw new Error('Explicit mock preview opt-in required');
  createPreviewServer({ app: process.env.APP_NAME, root: process.env.STATIC_ROOT ?? '/app/static', upstream: process.env.MOCK_UPSTREAM }).listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
}
