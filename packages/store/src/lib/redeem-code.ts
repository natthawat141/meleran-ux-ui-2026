import type { Course, Enrollment, LmsData, RedeemCode, RedeemCourseCodeResult, User } from '../types';

export function normalizeRedeemCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase().replace(/\s+/g, '') : '';
}

export type RedeemCodeQuote =
  | { ok: true; code: RedeemCode }
  | { ok: false; message: string };

export function quoteRedeemCode(codes: RedeemCode[], rawCode: string, courseId: string): RedeemCodeQuote {
  const normalized = normalizeRedeemCode(rawCode);
  if (!normalized) return { ok: false, message: 'กรอกรหัสแลกคอร์สเพื่อดำเนินการ' };
  const code = codes.find((item) => normalizeRedeemCode(item.code) === normalized);
  if (!code) return { ok: false, message: 'ไม่พบรหัสสิทธิ์คอร์สนี้' };
  if (code.courseId !== courseId) return { ok: false, message: 'รหัสนี้ใช้กับคอร์สที่เลือกไม่ได้' };
  if (code.status === 'used') return { ok: false, message: 'รหัสแลกคอร์สนี้ถูกใช้แล้ว' };
  if (code.status === 'revoked') return { ok: false, message: 'รหัสแลกคอร์สนี้ถูกยกเลิกแล้ว' };
  return { ok: true, code };
}

export interface PrototypeRedeemTransition {
  result: RedeemCourseCodeResult;
  redeemCode?: RedeemCode;
  enrollment?: Enrollment;
}

export function preparePrototypeRedeem(args: {
  codes: RedeemCode[];
  enrollments: Enrollment[];
  courses: Course[];
  user: User | null;
  rawCode: string;
  now: string;
  enrollmentId: string;
}): PrototypeRedeemTransition {
  const normalized = normalizeRedeemCode(args.rawCode);
  if (!normalized) return { result: { ok: false, message: 'กรอกรหัสแลกคอร์สก่อนยืนยัน' } };
  const code = args.codes.find((item) => normalizeRedeemCode(item.code) === normalized);
  if (!code) return { result: { ok: false, message: 'ไม่พบรหัสสิทธิ์คอร์สนี้' } };

  const user = args.user;
  if (!user) return { result: { ok: false, message: 'เข้าสู่ระบบก่อนแลกรหัสคอร์ส' } };
  if (user.status === 'suspended') return { result: { ok: false, message: 'บัญชีนี้ยังทำรายการไม่ได้' } };
  if (user.role !== 'learner' && user.role !== 'instructor') {
    return { result: { ok: false, message: 'บัญชีนี้แลกรหัสคอร์สไม่ได้' } };
  }
  if (user.emailVerified === false) return { result: { ok: false, message: 'กรุณายืนยันอีเมลก่อนแลกรหัสคอร์ส' } };

  const course = args.courses.find((item) => item.id === code.courseId);
  if (!course || course.status !== 'published' || !Number.isFinite(course.price) || course.price <= 0) {
    return { result: { ok: false, message: 'คอร์สของรหัสนี้ไม่พร้อมให้แลก' } };
  }
  if (course.instructorId === user.id) {
    return { result: { ok: false, message: 'ผู้สอนไม่สามารถแลกรหัสคอร์สของตนเอง' } };
  }

  const existingEnrollment = args.enrollments.find(
    (item) => item.courseId === course.id && item.userId === user.id
  );
  if (existingEnrollment) {
    return {
      result: {
        ok: true,
        enrollmentId: existingEnrollment.id,
        redeemCodeId: code.id,
        alreadyEnrolled: true,
      },
      redeemCode: code,
      enrollment: existingEnrollment,
    };
  }
  if (code.status === 'used') return { result: { ok: false, message: 'รหัสแลกคอร์สนี้ถูกใช้แล้ว' } };
  if (code.status === 'revoked') return { result: { ok: false, message: 'รหัสแลกคอร์สนี้ถูกยกเลิกแล้ว' } };

  const enrollment: Enrollment = {
    id: args.enrollmentId,
    courseId: course.id,
    userId: user.id,
    createdAt: args.now,
  };
  const redeemedCode: RedeemCode = {
    ...code,
    status: 'used',
    usedByUserId: user.id,
    usedAt: args.now,
    enrollmentId: enrollment.id,
  };
  return {
    result: {
      ok: true,
      enrollmentId: enrollment.id,
      redeemCodeId: redeemedCode.id,
      alreadyEnrolled: false,
    },
    redeemCode: redeemedCode,
    enrollment,
  };
}

interface LegacyCashCode {
  id: string;
  code: string;
  courseId: string;
  createdAt?: string;
  createdBy?: string;
  status?: unknown;
  usedCount?: unknown;
  userId?: unknown;
  lastUsedAt?: unknown;
  expiresAt?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function legacyCashCode(value: unknown): LegacyCashCode | null {
  if (!isRecord(value) || value.kind !== 'cash') return null;
  if (typeof value.id !== 'string' || typeof value.code !== 'string' || typeof value.courseId !== 'string') return null;
  return {
    id: value.id,
    code: value.code,
    courseId: value.courseId,
    ...(typeof value.createdAt === 'string' && { createdAt: value.createdAt }),
    ...(typeof value.createdBy === 'string' && { createdBy: value.createdBy }),
    status: value.status,
    usedCount: value.usedCount,
    userId: value.userId,
    lastUsedAt: value.lastUsedAt,
    expiresAt: value.expiresAt,
  };
}

function legacyOrderUsesCode(order: unknown, code: LegacyCashCode): order is Record<string, unknown> {
  if (!isRecord(order) || order.status !== 'paid') return false;
  const hasCashSource = order.source === 'cash_code' || order.accessCodeKind === 'cash' || order.method === 'เงินสดผ่านโค้ด';
  const matchesId = order.accessCodeId === code.id;
  const matchesText = typeof order.accessCode === 'string' && normalizeRedeemCode(order.accessCode) === normalizeRedeemCode(code.code);
  return hasCashSource && (matchesId || matchesText);
}

export function migrateLegacyRedeemCodes(args: {
  rawCodes: unknown;
  rawOrders: unknown;
  enrollments: Enrollment[];
  now: string;
}): RedeemCode[] {
  if (!Array.isArray(args.rawCodes)) return [];
  const orders = Array.isArray(args.rawOrders) ? args.rawOrders : [];
  const output: RedeemCode[] = [];
  const ids = new Set<string>();
  const codes = new Set<string>();

  for (const rawCode of args.rawCodes) {
    const code = legacyCashCode(rawCode);
    if (!code) continue;
    const normalizedCode = normalizeRedeemCode(code.code);
    if (!normalizedCode || ids.has(code.id) || codes.has(normalizedCode)) continue;
    ids.add(code.id);
    codes.add(normalizedCode);

    const order = orders.find((item) => legacyOrderUsesCode(item, code));
    const codeUserId = typeof code.userId === 'string' ? code.userId : undefined;
    const orderUserId = order && typeof order.userId === 'string' ? order.userId : undefined;
    const usedCount = Number(code.usedCount);
    const hasUseEvidence = (Number.isFinite(usedCount) && usedCount > 0) || Boolean(codeUserId || code.lastUsedAt || order);
    const expiryTime = typeof code.expiresAt === 'string' ? new Date(code.expiresAt).getTime() : undefined;
    const expired = expiryTime !== undefined && (!Number.isFinite(expiryTime) || expiryTime < new Date(args.now).getTime());
    const status: RedeemCode['status'] = hasUseEvidence || code.status === 'used'
      ? 'used'
      : code.status === 'active' && !expired
        ? 'unused'
        : 'revoked';
    const usedByUserId = codeUserId ?? orderUserId;
    const usedAt = typeof code.lastUsedAt === 'string'
      ? code.lastUsedAt
      : order && typeof order.createdAt === 'string'
        ? order.createdAt
        : undefined;
    const enrollment = usedByUserId
      ? args.enrollments.find((item) => item.courseId === code.courseId && item.userId === usedByUserId)
      : undefined;

    output.push({
      id: code.id,
      code: code.code,
      courseId: code.courseId,
      status,
      createdAt: code.createdAt ?? args.now,
      createdBy: code.createdBy ?? 'legacy',
      ...(status === 'used' && usedByUserId && { usedByUserId }),
      ...(status === 'used' && usedAt && { usedAt }),
      ...(status === 'used' && enrollment && { enrollmentId: enrollment.id }),
    });
  }

  return output;
}

export type RedeemResultLookup =
  | { state: 'granted'; courseId: string; enrollmentId: string; redeemCodeId?: string; isLegacy: boolean }
  | { state: 'not_granted'; courseId?: string; legacyStatus: 'failed' | 'cancelled' | 'pending' | 'missing_enrollment' };

export function resolveRedeemResult(data: LmsData, resultId: string, userId: string): RedeemResultLookup | null {
  const enrollment = data.enrollments.find((item) => item.id === resultId && item.userId === userId);
  if (enrollment) {
    const code = data.redeemCodes.find((item) => item.enrollmentId === enrollment.id);
    return {
      state: 'granted',
      courseId: enrollment.courseId,
      enrollmentId: enrollment.id,
      ...(code && { redeemCodeId: code.id }),
      isLegacy: false,
    };
  }

  const legacyCollections = data.legacyPrototype?.collections;
  const legacyOrders = legacyCollections && Array.isArray(legacyCollections.orders) ? legacyCollections.orders : [];
  const legacyCodes = legacyCollections && Array.isArray(legacyCollections.accessCodes) ? legacyCollections.accessCodes : [];
  const legacyOrder = legacyOrders.find((item) => isRecord(item) && item.id === resultId);
  if (!isRecord(legacyOrder) || legacyOrder.userId !== userId || typeof legacyOrder.courseId !== 'string') return null;
  const relatedLegacyCode = legacyCodes.find((item) => {
    const code = legacyCashCode(item);
    return Boolean(code && (legacyOrder.accessCodeId === code.id || (typeof legacyOrder.accessCode === 'string' && normalizeRedeemCode(legacyOrder.accessCode) === normalizeRedeemCode(code.code))));
  });
  const isCashRedeem = legacyOrder.source === 'cash_code' || legacyOrder.accessCodeKind === 'cash' || legacyOrder.method === 'เงินสดผ่านโค้ด' || Boolean(relatedLegacyCode);
  if (!isCashRedeem) return null;

  if (legacyOrder.status !== 'paid') {
    return {
      state: 'not_granted',
      courseId: legacyOrder.courseId,
      legacyStatus: legacyOrder.status === 'failed' || legacyOrder.status === 'cancelled' ? legacyOrder.status : 'pending',
    };
  }
  const existingEnrollment = data.enrollments.find(
    (item) => item.courseId === legacyOrder.courseId && item.userId === userId
  );
  if (!existingEnrollment) return { state: 'not_granted', courseId: legacyOrder.courseId, legacyStatus: 'missing_enrollment' };
  const codeId = typeof legacyOrder.accessCodeId === 'string'
    ? legacyOrder.accessCodeId
    : relatedLegacyCode && isRecord(relatedLegacyCode) && typeof relatedLegacyCode.id === 'string'
      ? relatedLegacyCode.id
      : undefined;
  return {
    state: 'granted',
    courseId: existingEnrollment.courseId,
    enrollmentId: existingEnrollment.id,
    ...(codeId && { redeemCodeId: codeId }),
    isLegacy: true,
  };
}
