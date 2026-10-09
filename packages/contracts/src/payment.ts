import type { Money } from './common.ts';

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
export type FulfillmentStatus = 'pending' | 'granted' | 'failed';
export type RedeemCodeStatus = 'unused' | 'used' | 'revoked';

export interface PaymentIntent {
  id: string;
  user_id: string;
  course_id: string;
  price: Money;
  status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  checkout_url?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export type CreatePaymentRequest = import('./generated/types.gen.ts').CheckoutRequest;
export type CheckoutStatusResponse = import('./generated/types.gen.ts').WirePaymentView;

export interface RedeemCode {
  id: string;
  code: string;
  courseId: string;
  course_id?: string;
  status: RedeemCodeStatus;
  createdAt: string;
  created_at?: string;
  createdBy: string;
  created_by?: string;
  usedByUserId?: string;
  used_by_user_id?: string;
  usedAt?: string;
  used_at?: string;
  enrollmentId?: string;
  enrollment_id?: string;
  revokedBy?: string;
  revoked_by?: string;
  revokedAt?: string;
  revoked_at?: string;
}

export type RedeemRequest = import('./generated/types.gen.ts').RedeemRequest;
export type RedeemResponse = import('./generated/types.gen.ts').WireRedeemResult;

export type RedeemCourseCodeResult =
  | { ok: true; enrollmentId: string; redeemCodeId: string; alreadyEnrolled: boolean }
  | { ok: false; message: string };

export interface CreateRedeemCodeResult {
  ok: boolean;
  message?: string;
  redeemCode?: RedeemCode;
}
