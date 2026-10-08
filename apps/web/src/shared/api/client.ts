import { createHttpClient } from '@melearn/api-client';
import { resolveApiConfig } from './config';

export const apiConfig = resolveApiConfig({
  dev: import.meta.env.DEV,
  mode: import.meta.env.VITE_API_MODE,
  baseUrl: import.meta.env.VITE_API_BASE_URL,
  credentials: import.meta.env.VITE_API_CREDENTIALS,
});
export const apiClient = createHttpClient({
  baseUrl: apiConfig.baseUrl, credentials: apiConfig.credentials,
  fetcher: globalThis.fetch.bind(globalThis),
  headers: { accept: 'application/json', 'x-melearn-app': 'web' }, timeoutMs: 8_000,
});
