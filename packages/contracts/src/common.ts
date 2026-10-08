export const DEFAULT_CURRENCY = 'THB';
export const mockCurrency = 'THB';

export interface Money {
  amount_minor: number;
  currency: string;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiErrorEnvelope {
  ok: false;
  error: {
    code: string;
    message: string;
    request_id?: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorEnvelope;

export interface PaginationCursor {
  next_cursor?: string | null;
  has_more: boolean;
  total?: number;
}
