const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function normalizeAccessCode(value) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

export function quoteAccessCode({ accessCodes = [], courseId, coursePrice, userId, enrollments = [], code: rawCode = '' }) {
  const listPrice = roundMoney(coursePrice);
  const code = normalizeAccessCode(rawCode);
  if (!code) return { ok: true, code: null, source: 'payment', listPrice, discountAmount: 0, amount: listPrice };

  const accessCode = accessCodes.find((item) => normalizeAccessCode(item.code) === code);
  if (!accessCode) return { ok: false, message: 'ไม่พบโค้ดนี้ กรุณาตรวจสอบอีกครั้ง' };
  if (accessCode.status !== 'active') return { ok: false, message: 'โค้ดนี้ถูกปิดใช้งานแล้ว' };
  if (accessCode.courseId !== courseId) return { ok: false, message: 'โค้ดนี้ใช้กับคอร์สที่เลือกไม่ได้' };
  if (accessCode.expiresAt && new Date(accessCode.expiresAt).getTime() < Date.now()) return { ok: false, message: 'โค้ดนี้หมดอายุแล้ว' };
  if (Number.isFinite(Number(accessCode.maxUses)) && Number(accessCode.maxUses) > 0 && Number(accessCode.usedCount || 0) >= Number(accessCode.maxUses)) return { ok: false, message: 'โค้ดนี้ถูกใช้ครบจำนวนแล้ว' };
  if (accessCode.kind === 'cash' && accessCode.userId !== userId) return { ok: false, message: 'โค้ดเงินสดนี้ออกให้ผู้เรียนอีกบัญชีหนึ่ง' };
  if (enrollments.some((item) => item.courseId === courseId && item.userId === userId)) return { ok: false, message: 'คุณมีคอร์สนี้ในรายการเรียนแล้ว' };
  if (listPrice <= 0) return { ok: false, message: 'คอร์สนี้เปิดให้เรียนฟรีอยู่แล้ว' };

  let discountAmount = 0;
  let amount = listPrice;
  let source = 'payment';
  if (accessCode.kind === 'percent') discountAmount = roundMoney(listPrice * Math.min(100, Math.max(0, Number(accessCode.value))) / 100);
  else if (accessCode.kind === 'fixed') discountAmount = Math.min(listPrice, roundMoney(accessCode.value));
  else if (accessCode.kind === 'free') discountAmount = listPrice;
  else if (accessCode.kind === 'cash') {
    amount = roundMoney(accessCode.receivedAmount);
    if (amount <= 0 || amount > listPrice) return { ok: false, message: 'ยอดเงินสดที่บันทึกไว้ไม่ถูกต้อง' };
    discountAmount = roundMoney(listPrice - amount);
    source = 'cash_code';
  } else return { ok: false, message: 'ชนิดโค้ดนี้ไม่รองรับ' };

  if (source !== 'cash_code') amount = roundMoney(listPrice - discountAmount);
  if (amount === 0) source = 'free_code';
  return { ok: true, code: accessCode, source, listPrice, discountAmount, amount };
}

export function accessCodeKindLabel(kind) {
  return ({ percent: 'ส่วนลด %', fixed: 'ลดเป็นจำนวนเงิน', free: 'เรียนฟรี', cash: 'เงินสดผ่านโค้ด' })[kind] ?? 'โค้ด';
}

export function orderChannelLabel(order) {
  if (order.source === 'cash_code' || order.method === 'เงินสดผ่านโค้ด') return 'เงินสดผ่านโค้ด';
  if (order.source === 'free_code' || order.method === 'โค้ดเรียนฟรี') return 'โค้ดเรียนฟรี';
  return 'ชำระผ่านระบบ';
}
