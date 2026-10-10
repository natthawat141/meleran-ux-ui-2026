/** Transport configuration only; feature endpoints and permissions belong to apps. */
export function resolveApiConfig(input: { dev: boolean; baseUrl?: string; mode?: string; credentials?: string }) {
  const mode = input.mode ?? (input.dev ? 'mock' : 'remote');
  if (mode !== 'mock' && mode !== 'remote') throw new Error('VITE_API_MODE must be mock or remote');
  const baseUrl = (input.baseUrl ?? (mode === 'mock' ? '/mock-api/v1' : '/api/v1')).trim().replace(/\/+$/, '');
  if (!baseUrl || baseUrl.startsWith('//') || baseUrl.includes('\\') || (!baseUrl.startsWith('/') && !/^https?:\/\//.test(baseUrl))) throw new Error('Invalid VITE_API_BASE_URL');
  const credentials = input.credentials ?? 'include';
  if (credentials !== 'include' && credentials !== 'same-origin' && credentials !== 'omit') throw new Error('Invalid VITE_API_CREDENTIALS');
  return { baseUrl, credentials, mock: mode === 'mock' } as const;
}
