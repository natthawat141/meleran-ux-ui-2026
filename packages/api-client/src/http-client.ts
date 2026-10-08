import { HttpClientError } from './errors.ts';

export type PayloadDecoder<T> = (payload: unknown) => T | Promise<T>;

export interface HttpClientOptions {
  baseUrl: string;
  fetcher: typeof fetch;
  headers: HeadersInit;
  credentials: RequestCredentials;
  /** Explicitly choose a positive timeout in milliseconds, or null to disable it. */
  timeoutMs: number | null;
}

export interface HttpRequestOptions<T> extends Omit<RequestInit, 'headers' | 'credentials' | 'signal'> {
  decoder: PayloadDecoder<T>;
  headers?: HeadersInit;
  signal?: AbortSignal;
}

export interface HttpClient {
  request<T>(path: string, options: HttpRequestOptions<T>): Promise<T>;
}

// Used only to parse root-relative URLs. This origin is never passed to fetch.
const relativeParsingOrigin = 'https://relative-http-client.invalid';

function parseBaseUrl(value: string): { url: URL; absolute: boolean; pathname: string } {
  if (typeof value !== 'string' || !value || value.includes('\\')) {
    throw new HttpClientError('configuration');
  }
  const absolute = /^https?:\/\//i.test(value);
  if (!absolute && !/^\/(?!\/)/.test(value)) throw new HttpClientError('configuration');
  let url: URL;
  try {
    url = new URL(value, relativeParsingOrigin);
  } catch {
    throw new HttpClientError('configuration');
  }
  if (url.username || url.password || url.search || url.hash) throw new HttpClientError('configuration');
  return { url, absolute, pathname: url.pathname.replace(/\/+$/, '') };
}

function joinUrl(base: ReturnType<typeof parseBaseUrl>, path: string): string {
  if (typeof path !== 'string' || path.includes('\\') || path.includes('#')
    || path.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(path)) {
    throw new HttpClientError('configuration');
  }
  let url: URL;
  try {
    url = new URL(`${base.url.origin}${base.pathname}/${path.replace(/^\//, '')}`);
  } catch {
    throw new HttpClientError('configuration');
  }
  if (url.origin !== base.url.origin
    || (base.pathname && url.pathname !== base.pathname && !url.pathname.startsWith(`${base.pathname}/`))) {
    throw new HttpClientError('configuration');
  }
  return base.absolute ? url.href : `${url.pathname}${url.search}`;
}

/** JSON transport preparation only; callers own endpoints, payloads, decoders and session policy. */
export function createHttpClient(options: HttpClientOptions): HttpClient {
  const base = parseBaseUrl(options.baseUrl);
  if (typeof options.fetcher !== 'function'
    || !['omit', 'same-origin', 'include'].includes(options.credentials)
    || (options.timeoutMs !== null && (!Number.isInteger(options.timeoutMs)
      || options.timeoutMs <= 0 || options.timeoutMs > 2_147_483_647))
    || options.headers === undefined) {
    throw new HttpClientError('configuration');
  }
  let defaultHeaders: Headers;
  try {
    defaultHeaders = new Headers(options.headers);
  } catch {
    throw new HttpClientError('configuration');
  }
  const { fetcher, credentials, timeoutMs } = options;

  return {
    async request<T>(path: string, requestOptions: HttpRequestOptions<T>): Promise<T> {
      const url = joinUrl(base, path);
      const { decoder, headers: requestHeaders, signal, ...init } = requestOptions;
      if (typeof decoder !== 'function') throw new HttpClientError('configuration');
      let headers: Headers;
      try {
        headers = new Headers(defaultHeaders);
        new Headers(requestHeaders).forEach((value, name) => headers.set(name, value));
      } catch {
        throw new HttpClientError('configuration');
      }
      if (signal?.aborted) throw new HttpClientError('aborted');

      const controller = new AbortController();
      let stopped: 'aborted' | 'timeout' | undefined;
      let rejectStopped: (error: HttpClientError) => void;
      const stoppedRequest = new Promise<never>((_resolve, reject) => { rejectStopped = reject; });
      const stop = (kind: 'aborted' | 'timeout') => {
        if (stopped) return;
        stopped = kind;
        rejectStopped(new HttpClientError(kind));
        controller.abort();
      };
      const forwardAbort = () => stop('aborted');
      const checkStopped = () => { if (stopped) throw new HttpClientError(stopped); };
      signal?.addEventListener('abort', forwardAbort, { once: true });
      const timer = timeoutMs === null ? undefined : setTimeout(() => stop('timeout'), timeoutMs);

      const performRequest = async (): Promise<T> => {
        checkStopped();
        let response: Response;
        try {
          response = await fetcher(url, { ...init, headers, credentials, signal: controller.signal });
        } catch {
          checkStopped();
          throw new HttpClientError('network');
        }
        checkStopped();
        if (!response.ok) throw new HttpClientError('http', response.status);

        let payload: unknown;
        if (response.status !== 204 && response.status !== 205 && init.method?.toUpperCase() !== 'HEAD') {
          const mediaType = (response.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase();
          if (mediaType !== 'application/json' && !/^application\/[^\s/;]+\+json$/.test(mediaType)) {
            throw new HttpClientError('non_json', response.status);
          }
          try {
            payload = await response.json();
          } catch (cause) {
            checkStopped();
            throw new HttpClientError(cause instanceof SyntaxError ? 'malformed_json' : 'network', response.status);
          }
        }
        checkStopped();
        try {
          const decoded = await decoder(payload);
          checkStopped();
          return decoded;
        } catch {
          checkStopped();
          throw new HttpClientError('invalid_payload', response.status);
        }
      };

      try {
        // Enforce cancellation even when an injected fetcher/decoder ignores the signal.
        return await Promise.race([stoppedRequest, performRequest()]);
      } catch (error) {
        checkStopped();
        if (error instanceof HttpClientError) throw error;
        throw new HttpClientError('network');
      } finally {
        if (timer !== undefined) clearTimeout(timer);
        signal?.removeEventListener('abort', forwardAbort);
      }
    },
  };
}
