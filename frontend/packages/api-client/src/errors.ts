export type HttpClientErrorKind =
  | 'configuration'
  | 'network'
  | 'aborted'
  | 'timeout'
  | 'http'
  | 'non_json'
  | 'malformed_json'
  | 'invalid_payload';

const messages: Record<HttpClientErrorKind, string> = {
  configuration: 'HTTP client configuration is invalid.',
  network: 'The HTTP request could not be completed.',
  aborted: 'The HTTP request was cancelled.',
  timeout: 'The HTTP request timed out.',
  http: 'The server returned an unsuccessful HTTP status.',
  non_json: 'The server did not return JSON.',
  malformed_json: 'The server returned malformed JSON.',
  invalid_payload: 'The response did not pass the supplied decoder.',
};

/** Transport metadata only: never retain response bodies, request URLs or original errors. */
export class HttpClientError extends Error {
  readonly kind: HttpClientErrorKind;
  readonly status?: number;

  constructor(kind: HttpClientErrorKind, status?: number) {
    super(messages[kind]);
    this.name = 'HttpClientError';
    this.kind = kind;
    this.status = status;
  }
}
