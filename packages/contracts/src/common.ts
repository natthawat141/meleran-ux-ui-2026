export const DEFAULT_CURRENCY = 'THB';
export const mockCurrency = 'THB';

export interface Money {
  amount_minor: number;
  currency: string;
}

/** Success payloads are returned directly, without a data/ok wrapper. */
export type ApiSuccess<T> = T;

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    request_id: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorEnvelope;

export interface PaginationCursor {
  next_cursor: string | null;
}
