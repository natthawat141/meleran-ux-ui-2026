import type { AccessCode, AccessCodeKind, Enrollment, Order } from '../types';

const roundMoney = (value: number): number => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function normalizeAccessCode(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

export type AccessCodeQuote =
  | { ok: true; code: AccessCode | null; source: 'payment' | 'cash_code' | 'free_code'; listPrice: number; discountAmount: number; amount: number }
  | { ok: false; message: string };

export function markAccessCodeRedeemed(code: AccessCode, userId: string, redeemedAt: string): AccessCode | null {
  if (code.kind !== 'cash' || code.status !== 'active' || code.usedCount !== 0 || !userId) return null;
  if (code.userId && code.userId !== userId) return null;
  return { ...code, userId, usedCount: code.usedCount + 1, lastUsedAt: redeemedAt };
}

export function cashCodeShareAmounts(amount: number, sharePercent: number): { instructorShareAmount: number; platformShareAmount: number } {
  const instructorShareAmount = Math.round((amount * sharePercent / 100 + Number.EPSILON) * 100) / 100;
  return { instructorShareAmount, platformShareAmount: Math.round((amount - instructorShareAmount + Number.EPSILON) * 100) / 100 };
}

export function commitCashCodeRedemption(args: {
  accessCodes: AccessCode[];
  orders: Order[];
  enrollments: Enrollment[];
  accessCodeId: string;
  userId: string;
  order: Order;
  redeemedAt: string;
}): { accessCodes: AccessCode[]; orders: Order[]; enrollments: Enrollment[] } | null {
  const accessCode = args.accessCodes.find((item) => item.id === args.accessCodeId);
  if (accessCode && args.order.courseId !== accessCode.courseId) return null;
  if (!accessCode || args.order.status !== 'paid' || args.order.source !== 'cash_code' || args.order.userId !== args.userId || args.order.accessCodeId !== accessCode.id) return null;
  if (args.orders.some((item) => item.accessCodeId === accessCode.id && item.status === 'paid')) return null;
  if (args.enrollments.some((item) => item.courseId === args.order.courseId && item.userId === args.userId)) return null;
  const redeemedCode = markAccessCodeRedeemed(accessCode, args.userId, args.redeemedAt);
  if (!redeemedCode) return null;
  return {
    accessCodes: args.accessCodes.map((item) => item.id === accessCode.id ? redeemedCode : item),
    orders: [args.order, ...args.orders],
    enrollments: [{ id: `enroll-${args.order.id}`, courseId: args.order.courseId, userId: args.userId, createdAt: args.redeemedAt, ...(args.order.referralCode ? { referralCode: args.order.referralCode, ...(args.order.referralLinkId ? { referralLinkId: args.order.referralLinkId } : {}), ...(args.order.instructorId ? { referralInstructorId: args.order.instructorId } : {}) } : {}) }, ...args.enrollments],
  };
}

export function quoteAccessCode(args: {
  accessCodes: AccessCode[];
  courseId: string;
  coursePrice: number;
  userId: string;
  enrollments: Enrollment[];
  code?: string;
}): AccessCodeQuote {
  let listPrice = roundMoney(args.coursePrice);
  const code = normalizeAccessCode(args.code);
  if (!code) return { ok: true, code: null, source: 'payment', listPrice, discountAmount: 0, amount: listPrice };

  const accessCode = args.accessCodes.find((item) => normalizeAccessCode(item.code) === code);
  if (!accessCode) return { ok: false, message: 'ไม่พบโค้ดนี้ กรุณาตรวจสอบอีกครั้ง' };
  if (accessCode.status !== 'active') return { ok: false, message: 'โค้ดนี้ถูกปิดใช้งานแล้ว' };
  if (accessCode.courseId !== args.courseId) return { ok: false, message: 'โค้ดนี้ใช้กับคอร์สที่เลือกไม่ได้' };
  if (accessCode.expiresAt) {
    const expiry = new Date(accessCode.expiresAt).getTime();
    if (!Number.isFinite(expiry) || expiry < Date.now()) return { ok: false, message: 'โค้ดนี้หมดอายุแล้ว' };
  }
  if (accessCode.maxUses !== null && Number.isFinite(accessCode.maxUses) && accessCode.usedCount >= accessCode.maxUses) {
    return { ok: false, message: 'โค้ดนี้ถูกใช้ครบจำนวนแล้ว' };
  }
  if (accessCode.kind === 'cash' && accessCode.usedCount >= 1) return { ok: false, message: 'รหัสแลกคอร์สนี้ถูกใช้แล้ว' };
  if (accessCode.kind === 'cash' && !args.userId) return { ok: false, message: 'เข้าสู่ระบบก่อนแลกรหัสคอร์ส' };
  if (accessCode.kind === 'cash' && accessCode.userId && accessCode.userId !== args.userId) return { ok: false, message: 'โค้ดสิทธิ์นี้ผูกกับบัญชีผู้เรียนอื่นแล้ว' };
  if (args.enrollments.some((item) => item.courseId === args.courseId && item.userId === args.userId)) {
    return { ok: false, message: 'คุณมีคอร์สนี้ในรายการเรียนแล้ว' };
  }
  if (listPrice <= 0) return { ok: false, message: 'คอร์สนี้เปิดให้เรียนฟรีอยู่แล้ว' };

  let discountAmount = 0;
  let amount = listPrice;
  let source: 'payment' | 'cash_code' | 'free_code' = 'payment';
  if (accessCode.kind === 'percent') {
    discountAmount = roundMoney(listPrice * Math.min(100, Math.max(0, Number(accessCode.value))) / 100);
  } else if (accessCode.kind === 'fixed') {
    discountAmount = Math.min(listPrice, roundMoney(Number(accessCode.value)));
  } else if (accessCode.kind === 'free') {
    discountAmount = listPrice;
  } else if (accessCode.kind === 'cash') {
    amount = roundMoney(Number(accessCode.receivedAmount));
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: 'ราคาขายของรหัสนี้ไม่ถูกต้อง' };
    listPrice = Math.max(listPrice, amount);
    discountAmount = roundMoney(listPrice - amount);
    source = 'cash_code';
  } else {
    return { ok: false, message: 'ชนิดโค้ดนี้ไม่รองรับ' };
  }

  if (source !== 'cash_code') amount = roundMoney(listPrice - discountAmount);
  if (amount === 0) source = 'free_code';
  return { ok: true, code: accessCode, source, listPrice, discountAmount, amount };
}

export function accessCodeKindLabel(kind: AccessCodeKind): string {
  return ({ percent: 'ส่วนลด %', fixed: 'ลดเป็นจำนวนเงิน', free: 'เรียนฟรี', cash: 'รหัสแลกคอร์ส' })[kind];
}

export function orderChannelLabel(order: Pick<Order, 'source' | 'method'>): string {
  if (order.source === 'cash_code' || order.method === 'เงินสดผ่านโค้ด') return 'ขายผ่านรหัสแลกคอร์ส';
  if (order.source === 'free_code' || order.method === 'โค้ดเรียนฟรี') return 'โค้ดเรียนฟรี';
  return 'ชำระผ่านระบบ';
}
