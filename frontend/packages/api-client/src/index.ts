// Contract-neutral transport prep. Business contracts, Query and session integration remain separate gates.
export { createHttpClient } from './http-client.ts';
export type { HttpClient, HttpClientOptions, HttpRequestOptions, PayloadDecoder } from './http-client.ts';
export { HttpClientError } from './errors.ts';
export type { HttpClientErrorKind } from './errors.ts';
