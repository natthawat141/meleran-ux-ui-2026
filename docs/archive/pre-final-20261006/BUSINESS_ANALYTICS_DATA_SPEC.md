**เอกสารประวัติ — เลิกใช้เป็นข้อกำหนดปัจจุบัน 6 ต.ค. 2026**

สัญญาข้อมูล analytics และ finance เดิม รวม refund/fee/order/ส่วนแบ่ง ไม่ใช่ schema หรือกติกาที่อนุมัติสำหรับรอบแรก

ข้อมูลหลักคือ [MELEARN_V1_SCOPE.md](../../MELEARN_V1_SCOPE.md) ห้ามใช้ข้อความด้านล่างกำหนด scope/permission/API ปัจจุบัน

---

# Business analytics / finance — data contract draft

วันที่ 1 ต.ค. 2026 ข้อเสนอสำหรับต่อ API และเตรียมข้อมูลวิเคราะห์ ไม่ใช่ backend ที่มีอยู่แล้ว และไม่กำหนด technology/payment vendor แทนเจ้าของระบบ

## ข้อเท็จจริงจาก source ปัจจุบัน

`src/types/index.ts` และ store มี User, Course, Enrollment, Order, Attempt, Progress, Certificate และ inbox/notification ในเบราว์เซอร์

Order ปัจจุบันมี amount, status, createdAt ไม่มี paidAt, currency, provider transaction, fee, refund, settlement ledger; User ไม่มีเวลาสมัครที่ใช้ cohort ครบถ้วน และไม่มี session/page-view history จึงคำนวณ traffic, retention, เวลาเข้าเรียน หรือ financial reconciliation จาก mock JSON เดิมอย่างน่าเชื่อถือไม่ได้

Read-model ใหม่ `src/api/businessAnalytics.ts` ใช้ structural types ของตนเอง ฟังก์ชันบริสุทธิ์ เงิน integer satang ไม่ผูกกับ component/store และไม่ทำ network request Fixtures ใหม่แยกจาก orders เดิม

## นิยาม metric

| Metric | Grain / สูตร | เวลาเลือก | ข้อจำกัด |
| --- | --- | --- | --- |
| ผู้เข้าชมคอร์ส | distinct actor จาก course_viewed | occurred_at | anonymous/pseudonymous ไม่เท่ากับคนจริงถ้ายังไม่ resolve identity |
| การเข้าชมคอร์ส | distinct session_id ที่มี course_viewed | occurred_at | ไม่ใช่ page views และไม่ใช่ traffic ของทุกหน้าเว็บ |
| Active learners / DAU | distinct learner actor จาก learning_engaged ในช่วง/วัน | occurred_at | ต้องตรวจ enrollment/access ฝั่ง server; ห้ามนับ login/page open เป็นเรียนทันที |
| ลงทะเบียนใหม่ | distinct enrollment event ID | enrollment committed time | แยก free/paid ใน API จริง; ไม่รวม reset/retry event |
| ซื้อสำเร็จ | confirmed payment transaction count | paid_at | pending/failed/cancelled ไม่ใช่เงินรับ |
| เงินรับจากชำระ | sum amount_minor | paid_at | สกุลเงินเดียว THB ในต้นแบบ; ไม่ใช่ recognized revenue |
| คืนเงินสำเร็จ | sum completed refund amount_minor | refunded_at | รวม payment เก่าที่คืนในช่วง; partial refund ได้ |
| ค่าธรรมเนียม | sum actual fee_minor | fee effective time | demo ผูก paid_at เท่านั้น; API จริงต้องใช้ fee adjustment ledger เมื่อ fee มาไม่พร้อม charge |
| ยอดหลังหัก | collected − refunds − fees | เวลาแต่ละ ledger entry | อาจติดลบ; ไม่ใช่กำไรหรือยอด payout |
| Heatmap | distinct learner ต่อ weekday/hour | timezone Asia/Bangkok | หนึ่งคนปรากฏหลายช่องได้ |
| Funnel | distinct session/course ที่มี view → checkout → purchase ตามลำดับ | ทุก event อยู่ในช่วง | ไม่ใช่ cohort attribution; ข้ามวัน/ช่วงอาจตกหล่นต้องบอกนิยาม |

Source coverage รวมวันที่เริ่มและสิ้นสุด; window UTC ใช้ local start 00:00 inclusive และวันถัดจาก end 00:00 exclusive Bangkok = UTC+7 ไม่มีการตี no coverage เป็น 0

ตัวอย่าง learning_engaged ใช้ fixture โดยตรง ไม่มี tracking SDK จริง เกณฑ์เวลาเล่น/อ่านขั้นต่ำ การนับผู้เรียน active และ idle/session expiry **ต้องยืนยันก่อน production** เช่น 30 วินาทีเป็นเพียงทางเลือก ไม่ใช่กติกาที่อนุมัติแล้ว

Source dedupe event/payment/refund IDs; production ต้อง reject conflicting duplicate payload, ตรวจ integer amount/currency, refund sum ไม่เกิน payment, foreign keys, schema และ timestamps ก่อนเข้าระบบ ไม่ส่ง malformed records ให้ UI ทำหน้าที่เป็น data validator แทน backend

## Raw events สำหรับต่อ data/ML

เริ่มจาก event history ที่ตรวจสอบย้อนกลับได้ก่อนสร้าง model ไม่ใช่เก็บเพียง total แล้วหวังย้อนเวลาได้

```json
{
  "event_id": "evt-example-001",
  "schema_version": 1,
  "name": "learning_engaged",
  "occurred_at": "2026-10-01T12:00:00.000Z",
  "received_at": "2026-10-01T12:00:01.000Z",
  "organization_id": "org-example",
  "actor_id": "pseudonymous-learner-id",
  "anonymous_id": null,
  "session_id": "session-example",
  "course_id": "course-writing",
  "item_id": "lesson-example",
  "source": "client_validated",
  "properties": { "engaged_seconds": 45 }
}
```

เหตุการณ์ที่ควรออกแบบ: account_created, session_started, course_viewed, enrollment_created, learning_started/engaged/completed, checkout_started, payment_confirmed, refund_completed, certificate_issued พร้อม occurred/received time สำหรับ late arrival

Client แจ้ง engagement ได้แต่ server ต้องตรวจ entitlement/scope และจำกัด rate/dedupe; payment/refund/enrollment เป็น authoritative server events หลัง persistence สำเร็จ ไม่เชื่อ event purchase จาก browser เพียงอย่างเดียว

เก็บ version ของ course/price/transaction metadata ณ เวลาเกิดเหตุ แยก event log แบบ append-only, transactional tables และ aggregated read models; กำหนด retention/backfill/identity resolution และการจัดการ deletion ก่อนเก็บจริง

ไม่ใส่ข้อความ inbox คำตอบแบบฝึกหัด password หรือข้อมูลจ่ายเงินละเอียดใน analytics ไม่รับ organization/user scope ที่ browser ส่งมาเป็นข้อเท็จจริง ใช้ principal ที่ server ยืนยัน

ML ภายหลังต้องมี time-based splits, labels/horizons และตรวจ leakage; dashboard demo ไม่ใช่หลักฐานว่ามี training data พร้อม ใช้ event log วิเคราะห์ retention/dropout/cohort ได้เมื่อ coverage และ identity ครบก่อน

## Financial records ที่ต้องเพิ่มจริง

- Order immutable price/currency snapshot, order state history, enrollment reference
- Payment provider reference, idempotency key, confirmed_at, amount_minor, currency และ success/failure/pending states
- Refund reference/payment FK, requested/completed/failed timestamps, amount_minor และ reason ที่มี permission
- Fee/adjustment ledger, settlement/payout record และ provider reconciliation เมื่อเลือก provider
- Receipts/invoices/tax/expenses/commission เป็นโดเมนแยก ต้องตกลงรูปแบบกิจการและกติกาก่อน ไม่เติม tax rate หรือ revenue recognition จากการคาดเดา

เงินจริงคำนวณ server, minor units integer และ group by currency ห้ามรวมหลายสกุลเป็น THB โดยไม่มี FX policy

## Draft API (ยังไม่ได้ implement)

| Method / Path | หน้าที่ |
| --- | --- |
| GET `/api/v1/admin/business-analytics` | summary, daily, course breakdown, learning heatmap และ funnel |
| GET `/api/v1/admin/finance-report` | transaction-based money summary และ daily ตาม scope |
| GET `/api/v1/admin/finance-transactions` | filtered cursor pagination / transaction details |
| POST `/api/v1/admin/report-exports` | ตรวจ permission ใหม่และสร้าง export ตาม query ที่อนุญาต |

Query draft: `start=2026-09-02&end=2026-10-01&timezone=Asia%2FBangkok&course_id=course-writing&currency=THB`; finance table เพิ่ม `type`, `search`, `cursor`, `limit` (server bounded) ห้ามรับ raw SQL/filter expression

ตัวอย่าง response แสดงรูปร่างเท่านั้น ตัวเลขนี้ไม่อ้างว่าตรง fixture ของหน้า:

```json
{
  "schema_version": 1,
  "source": { "classification": "synthetic", "generated_at": "2026-10-01T13:00:00Z", "coverage_start": "2026-07-01", "coverage_end": "2026-10-01" },
  "scope": { "organization_id": "org-example", "course_id": null, "start": "2026-09-02", "end": "2026-10-01", "timezone": "Asia/Bangkok", "currency": "THB" },
  "coverage": { "complete": true, "missing_dates": [] },
  "summary": { "payment_count": 2, "collected_minor": 200000, "refunded_minor": 50000, "fees_minor": 5000, "net_minor": 145000 },
  "daily": [{ "date": "2026-09-02", "covered": true, "collected_minor": 200000, "refunded_minor": 50000, "fees_minor": 5000, "net_minor": 145000 }],
  "warnings": ["example_shape_only"],
  "pagination": { "next_cursor": null }
}
```

Daily จริงต้องคืนทุกวันในช่วง เริ่มต้นไม่มี coverage ค่า metric เป็น null ไม่ใช่ 0; count/non-money ใช้ชื่อระบุ grain เช่น `unique_active_learners` ไม่ใช้ `total_users` กำกวม Responses daily/summary/export ใช้ effective scope/filter และ schema เดียวกัน

Error contract: `{ "error": { "code": "REPORT_RANGE_INVALID", "message": "...", "request_id": "..." } }` เสนอ 400 invalid query, 401 unauthenticated, 403 permission, 404 inaccessible resource (ไม่เปิดเผย scope อื่น), 429 rate limit, 503 unavailable; UI มี retry และไม่แสดงเลขเก่าราวกับเป็น filter ใหม่

เสนอ permissions `analytics.read_business`, `finance.read`, `finance.export`; organization/course scope ตรวจ server ในทุก endpoint/download และ log ผู้ export การที่ prototype role=admin เปิดหน้าได้ไม่รับรองว่าทุก production admin ต้องเห็นเงินจริงได้

Export: ไม่รับ client totals, ใช้ server query, จำกัดขนาด/expiry, reauthorize download, audit, UTF-8 และ spreadsheet-safe text; เก็บ money เป็น integer minor และไม่ใส่ PII โดยปริยาย

## สิ่งที่ยังต้องตัดสินใจ

นิยาม active/session, anonymous-to-user mapping, bot/internal/demo exclusion, org scope, paid/free enrollment, payment provider/fee adjustments, refund policy, settlements, taxes/receipts, instructor share (ถ้ามี), reporting freshness, retention และ export rights ยังไม่ใช่ข้อตกลง production

## Primary references

- [GA4 ecommerce event guide](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce): ตัวอย่าง purchase/refund/checkout events ไม่ได้เลือก GA4 เป็นบริการของระบบนี้
- [GA4 export schema](https://support.google.com/analytics/answer/7029846): ตัวอย่าง timestamp, pseudonymous identity และ event parameters
- [Stripe Balance report](https://docs.stripe.com/reports/balance): ตัวอย่าง gross/fees/net และ transaction report ที่แยกจาก payout reconciliation ไม่ได้เลือก Stripe
- [Stripe refunds](https://docs.stripe.com/refunds): ตัวอย่าง refund states/partial refund ไม่ใช่นโยบายคืนเงินของ Melearn
