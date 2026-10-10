// PROVISIONAL MOCK — development HTTP adapter for the in-memory server.
// Listens on 127.0.0.1 only. App source must not import this file; Vite starts it from outside apps/web/src.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProvisionalApi } from './index.ts';

export const provisionalCatalogPort = 8787;
export const provisionalCatalogBasePath = '/mock-api/v1';

export function startProvisionalDevServer(port = 0): Promise<Server> {
  const api = createProvisionalApi({ environment: 'development', basePath: provisionalCatalogBasePath });
  const server = createServer((incoming: IncomingMessage, outgoing: ServerResponse) => {
    void forward(api, incoming, outgoing);
  });
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', onError);
      resolve(server);
    });
  });
}

async function forward(api: ReturnType<typeof createProvisionalApi>, incoming: IncomingMessage, outgoing: ServerResponse): Promise<void> {
  try {
    const url = new URL(incoming.url ?? '/', 'http://127.0.0.1');
    const method = (incoming.method ?? 'GET').toUpperCase();
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (typeof value === 'string') headers.set(name, value);
      else if (Array.isArray(value)) for (const item of value) headers.append(name, item);
    }
    const response = await api.createFetcher({ cookieHeader: incoming.headers.cookie })(`${url.pathname}${url.search}`, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks).toString('utf8'),
    });
    outgoing.statusCode = response.status;
    response.headers.forEach((value, name) => {
      if (name === 'set-cookie') outgoing.appendHeader(name, value);
      else outgoing.setHeader(name, value);
    });
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    if (outgoing.headersSent) {
      outgoing.destroy();
      return;
    }
    outgoing.statusCode = 500;
    outgoing.setHeader('content-type', 'application/json');
    outgoing.end(JSON.stringify({
      error: { code: 'mock_internal_error', message: 'ข้อผิดพลาดภายในของ mock', request_id: 'dev-server' },
    }));
  }
}

const entry = process.argv[1];
if (entry && path.resolve(entry) === fileURLToPath(import.meta.url)) {
  startProvisionalDevServer(Number(process.argv[2] ?? provisionalCatalogPort)).then((server) => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : provisionalCatalogPort;
    console.log(`provisional catalog API http://127.0.0.1:${port}${provisionalCatalogBasePath}`);
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'provisional catalog API failed to start');
    process.exitCode = 1;
  });
}
