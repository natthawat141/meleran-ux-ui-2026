export const DEFAULT_CURRENCY = 'THB';
export const mockCurrency = 'THB';

export type Money = import('./generated/types.gen.ts').Money;

/** Success payloads are returned directly, without a data/ok wrapper. */
export type ApiSuccess<T> = T;

export type ApiErrorEnvelope = import('./generated/types.gen.ts').ErrorEnvelope;

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorEnvelope;

export interface PaginationCursor {
  next_cursor: string | null;
}
