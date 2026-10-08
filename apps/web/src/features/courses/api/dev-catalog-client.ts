import { createHttpClient } from '@melearn/api-client';
import { createCatalogApi } from './catalog-api.ts';

// Dev-only public catalog client. The in-memory server is started outside app source and reached
// through the Vite proxy at this same-origin path. A failed request rejects; nothing here reads local courses.

export const devCatalogBasePath = '/mock-api/v1';

export const devCatalogApi = createCatalogApi(createHttpClient({
  baseUrl: devCatalogBasePath,
  fetcher: globalThis.fetch.bind(globalThis),
  headers: { accept: 'application/json' },
  credentials: 'omit',
  timeoutMs: 8_000,
}));
