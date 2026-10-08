import { HttpClientError } from '@melearn/api-client';
import type { CSSProperties } from 'react';
import type { ProvisionalMoney } from './catalog-provisional-contract.ts';

/** Display helper for the draft Money shape. Null is free; minor units are satang for THB (100 = 1 baht). */
export function formatCatalogPrice(price: ProvisionalMoney | null): string {
  if (price === null) return 'เรียนฟรี';
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: price.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price.amount_minor / 100);
}

/** Keeps only https URLs that cannot break out of a CSS `url("...")` value or an img src. */
export function safeCatalogCoverUrl(url: string | null): string | null {
  if (!url || !/^https:\/\/[^\s"'()]+$/.test(url)) return null;
  return url;
}

export function catalogCoverStyle(url: string | null): CSSProperties | undefined {
  const safe = safeCatalogCoverUrl(url);
  return safe ? { backgroundImage: `url("${safe}")` } : undefined;
}

/** Null means the failure was a cancellation and the caller should keep the state of the newer request. */
export function catalogLoadErrorText(error: unknown): string | null {
  if (error instanceof HttpClientError && error.kind === 'aborted') return null;
  if (error instanceof HttpClientError && (error.kind === 'invalid_payload' || error.kind === 'non_json' || error.kind === 'malformed_json')) {
    return 'ข้อมูลคอร์สไม่ตรงรูปแบบที่หน้ารองรับ';
  }
  if (error instanceof HttpClientError && (error.kind === 'network' || error.kind === 'timeout')) {
    return 'เชื่อมต่อรายการคอร์สไม่สำเร็จ';
  }
  return 'โหลดรายการคอร์สไม่สำเร็จ';
}
