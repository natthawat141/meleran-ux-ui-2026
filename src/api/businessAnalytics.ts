/** Prototype reporting contract. Money is integer satang; timestamps are UTC. */
export interface ReportCourse { id: string; title: string; price: number; status?: string }
export type EventName = 'course_viewed' | 'checkout_started' | 'purchase_confirmed' | 'enrollment_created' | 'learning_engaged';
export interface BusinessEvent {
  id: string; name: EventName; occurredAt: string; actorId: string; sessionId: string; courseId: string;
}
export interface ReportPayment {
  id: string; orderId: string; courseId: string; paidAt: string; amountMinor: number; feeMinor: number;
}
export interface ReportRefund { id: string; paymentId: string; refundedAt: string; amountMinor: number }
export interface ReportSource {
  events: BusinessEvent[]; payments: ReportPayment[]; refunds: ReportRefund[];
  coverageStart: string; coverageEnd: string; classification: 'synthetic';
}
export interface ReportRange { start: string; end: string; courseId: string }
export interface DailyReport {
  date: string; covered: boolean; visitors: number; sessions: number; active: number; enrollments: number;
  purchases: number; collected: number; refunded: number; fees: number; net: number;
}
export interface LedgerRow {
  id: string; kind: 'payment' | 'refund' | 'fee'; occurredAt: string; orderId: string; courseId: string; amountMinor: number; paymentId: string;
}
const DAY = 86_400_000;
export const REPORT_TODAY = '2026-10-01';
export const REPORT_ZONE = 'Asia/Bangkok';
export const money = (minor: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(minor / 100);
export function localDate(utc: string) { return new Date(Date.parse(utc) + 7 * 3_600_000).toISOString().slice(0, 10); }
export function shiftDate(date: string, days: number) { return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10); }
export function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date;
}
export function rangeError(range: ReportRange) {
  if (!validDate(range.start) || !validDate(range.end)) return 'กรุณาระบุวันที่ให้ครบและถูกต้อง';
  const span = (Date.parse(range.end) - Date.parse(range.start)) / DAY;
  if (span < 0) return 'วันเริ่มต้นต้องไม่อยู่หลังวันสิ้นสุด';
  if (span >= 366) return 'เลือกช่วงเวลาไม่เกิน 366 วัน';
  return '';
}
export function rangeDays(range: ReportRange) {
  if (rangeError(range)) return [];
  const count = Math.round((Date.parse(range.end) - Date.parse(range.start)) / DAY) + 1;
  return Array.from({ length: count }, (_, i) => shiftDate(range.start, i));
}
const unique = <T extends { id: string }>(rows: T[]) => [...new Map(rows.map(row => [row.id, row])).values()];
const countActors = (events: BusinessEvent[]) => new Set(events.map(event => event.actorId)).size;
const sum = (rows: { amountMinor: number }[]) => rows.reduce((total, row) => total + row.amountMinor, 0);
export function getBusinessReport(source: ReportSource, courses: ReportCourse[], range: ReportRange) {
  const error = rangeError(range);
  if (error) throw new Error(error);
  const inRange = (utc: string) => { const date = localDate(utc); return date >= range.start && date <= range.end; };
  const inCourse = (id: string) => range.courseId === 'all' || range.courseId === id;
  const events = unique(source.events).filter(event => inRange(event.occurredAt) && inCourse(event.courseId));
  const paymentsById = new Map(unique(source.payments).map(payment => [payment.id, payment]));
  const payments = [...paymentsById.values()].filter(payment => inRange(payment.paidAt) && inCourse(payment.courseId));
  // Refunds are selected by refund date, even when the original charge was outside the period.
  const refunds = unique(source.refunds).filter(refund => {
    const payment = paymentsById.get(refund.paymentId);
    return payment && inRange(refund.refundedAt) && inCourse(payment.courseId);
  });
  const ledger: LedgerRow[] = payments.flatMap(payment => [
    { id: payment.id, kind: 'payment' as const, occurredAt: payment.paidAt, orderId: payment.orderId, courseId: payment.courseId, amountMinor: payment.amountMinor, paymentId: payment.id },
    { id: `fee:${payment.id}`, kind: 'fee' as const, occurredAt: payment.paidAt, orderId: payment.orderId, courseId: payment.courseId, amountMinor: -payment.feeMinor, paymentId: payment.id },
  ]);
  for (const refund of refunds) {
    const payment = paymentsById.get(refund.paymentId)!;
    ledger.push({ id: refund.id, kind: 'refund', occurredAt: refund.refundedAt, orderId: payment.orderId, courseId: payment.courseId, amountMinor: -refund.amountMinor, paymentId: payment.id });
  }
  ledger.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id));
  const daily: DailyReport[] = rangeDays(range).map(date => {
    const dayEvents = events.filter(event => localDate(event.occurredAt) === date);
    const dayPayments = payments.filter(payment => localDate(payment.paidAt) === date);
    const dayRefunds = refunds.filter(refund => localDate(refund.refundedAt) === date);
    const collected = sum(dayPayments), refunded = sum(dayRefunds), fees = dayPayments.reduce((total, payment) => total + payment.feeMinor, 0);
    return { date, covered: date >= source.coverageStart && date <= source.coverageEnd,
      visitors: countActors(dayEvents.filter(event => event.name === 'course_viewed')),
      sessions: new Set(dayEvents.filter(event => event.name === 'course_viewed').map(event => event.sessionId)).size,
      active: countActors(dayEvents.filter(event => event.name === 'learning_engaged')),
      enrollments: dayEvents.filter(event => event.name === 'enrollment_created').length,
      purchases: dayPayments.length, collected, refunded, fees, net: collected - refunded - fees };
  });
  const collected = sum(payments), refunded = sum(refunds), fees = payments.reduce((total, payment) => total + payment.feeMinor, 0);
  const sessionEvents = new Map<string, BusinessEvent[]>();
  for (const event of events) { const key = `${event.sessionId}:${event.courseId}`; sessionEvents.set(key, [...(sessionEvents.get(key) ?? []), event]); }
  const funnel = [0, 0, 0];
  for (const rows of sessionEvents.values()) {
    const ordered = rows.slice().sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const view = ordered.findIndex(event => event.name === 'course_viewed');
    if (view < 0) continue;
    funnel[0]++;
    const checkout = ordered.findIndex((event, index) => index > view && event.name === 'checkout_started');
    if (checkout < 0) continue;
    funnel[1]++;
    if (ordered.some((event, index) => index > checkout && event.name === 'purchase_confirmed')) funnel[2]++;
  }
  const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => new Set<string>()));
  for (const event of events.filter(event => event.name === 'learning_engaged')) {
    const local = new Date(Date.parse(event.occurredAt) + 7 * 3_600_000);
    heatmap[(local.getUTCDay() + 6) % 7][local.getUTCHours()].add(event.actorId);
  }
  const courseRows = courses.filter(course => inCourse(course.id)).map(course => {
    const courseEvents = events.filter(event => event.courseId === course.id);
    return { id: course.id, title: course.title,
      visitors: countActors(courseEvents.filter(event => event.name === 'course_viewed')),
      active: countActors(courseEvents.filter(event => event.name === 'learning_engaged')),
      enrollments: courseEvents.filter(event => event.name === 'enrollment_created').length,
      purchases: payments.filter(payment => payment.courseId === course.id).length,
      collected: sum(payments.filter(payment => payment.courseId === course.id)) };
  });
  return { daily, ledger, funnel, heatmap: heatmap.map(row => row.map(cell => cell.size)), courseRows,
    active: countActors(events.filter(event => event.name === 'learning_engaged')),
    visitors: countActors(events.filter(event => event.name === 'course_viewed')),
    enrollments: events.filter(event => event.name === 'enrollment_created').length,
    purchases: payments.length, collected, refunded, fees, net: collected - refunded - fees,
    crossPeriodRefunds: refunds.filter(refund => !inRange(paymentsById.get(refund.paymentId)!.paidAt)).length,
    complete: range.start >= source.coverageStart && range.end <= source.coverageEnd };
}
