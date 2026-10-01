import type { BusinessEvent, ReportCourse, ReportPayment, ReportRefund, ReportSource } from '../api/businessAnalytics';
import { REPORT_TODAY, shiftDate } from '../api/businessAnalytics';

/** Deterministic synthetic telemetry. Never inserted into LMS users/orders/localStorage. */
export function createBusinessDemo(courses: ReportCourse[]): ReportSource {
  const events: BusinessEvent[] = [], payments: ReportPayment[] = [], refunds: ReportRefund[] = [];
  const published = courses.filter(course => course.status === 'published');
  const pool = published.length ? published : courses;
  const coverageStart = '2026-07-01';
  for (let day = 0; day < 93; day++) {
    const date = shiftDate(coverageStart, day);
    for (let slot = 0; slot < 18 + day % 11; slot++) {
      const course = pool[(day + slot) % pool.length];
      if (!course) continue;
      const actorId = `demo-visitor-${day}-${slot}`;
      const sessionId = `demo-session-${day}-${slot}`;
      const hour = [8, 10, 12, 18, 19, 20, 21][slot % 7];
      const at = (minute: number) => new Date(Date.parse(`${date}T00:00:00Z`) + (hour - 7) * 3_600_000 + minute * 60_000).toISOString();
      const add = (name: BusinessEvent['name'], minute: number, actor = actorId) => events.push({ id: `${sessionId}:${name}`, name, occurredAt: at(minute), actorId: actor, sessionId, courseId: course.id });
      add('course_viewed', 0);
      // Returning enrolled demo learners form a separate, recurring population.
      if (slot % 2 === 0) add('learning_engaged', 20, `demo-enrolled-${(day + slot) % 35}`);
      if (slot % 4 !== 0) continue;
      if (course.price > 0) {
        add('checkout_started', 3);
        if (slot % 8 !== 0) continue;
        add('purchase_confirmed', 6);
        const amountMinor = Math.round(course.price * 100);
        const payment: ReportPayment = { id: `demo-payment-${day}-${slot}`, orderId: `DEMO-${day}-${slot}`, courseId: course.id, paidAt: at(6), amountMinor, feeMinor: Math.min(2500, amountMinor) };
        payments.push(payment);
        // Include partial refunds and charges refunded in later reporting periods.
        if ((day + slot) % 9 === 0 && day < 89) refunds.push({ id: `demo-refund-${day}-${slot}`, paymentId: payment.id, refundedAt: `${shiftDate(date, 3)}T05:00:00.000Z`, amountMinor: Math.floor(amountMinor / 2) });
      }
      add('enrollment_created', 7);
    }
  }
  return { events, payments, refunds, coverageStart, coverageEnd: REPORT_TODAY, classification: 'synthetic' };
}
