# Stripe webhook receiver — component checkpoint

11 ต.ค. 2026: ผู้ใช้สั่งให้ทำตัวรับ webhook. งานนี้เป็น implementation ของ receiver ภายใน PROVIDER-STRIPE-01; ยังไม่ปิด task ทั้งชุดหรือ freeze provider contract.

## Source และขอบเขต

- CONFIRMED: Final 1.6 §2.4 ซื้อคอร์สผ่าน Stripe ข้อ 7–12, §5.11 และ acceptance P03/P06: ตรวจ raw-body signature ก่อนประมวลผล, event ซ้ำไม่สร้างรายการซ้ำ, browser/session/metadata ไม่ใช่หลักฐานชำระเงิน.
- Canonical OpenAPI `1.0.0-draft.1`, SHA-256 `c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3` **ไม่เปลี่ยน**. `POST /webhooks/stripe` เป็นหนึ่งใน 5 deferred operations ไม่มี operationId หรือ request/response schema ที่ frozen. Local runtime path: `POST /api/v1/webhooks/stripe`.
- IMPLEMENTED: PaymentsModule, receiver controller/service, raw parser ก่อน Nest JSON parser, signature verifier และ durable verified-event receipt. ใช้ PaymentEvent ของ DB-04 เดิม; ไม่แก้ schema/migrations หรือ install dependency.
- ยังไม่มี Checkout creation, provider payment-state mapper, fulfillment processor/worker หรือ entitlement grant จาก route นี้. ไม่ประกาศ P01–P12 ผ่านจาก receiver tests.

## Technical choices ของ component

ใช้ manual verification ตาม [Stripe official protocol](https://docs.stripe.com/webhooks?verify=verify-manually#verify-manually): `HMAC-SHA256(secret, timestamp + '.' + original bytes)` ผ่าน Node crypto, เปรียบเทียบแบบ constant-time, ตรวจทุก `v1`, ไม่ใช้ `v0`, ปฏิเสธ timestamp ซ้ำ/กำกวม และ timestamp ห่างจาก server clock เกิน 300 วินาทีทั้งอดีต/อนาคต. นี่เป็น technical implementation choice ไม่ใช่การตัดสินใจ lifetime ของ Checkout request_id ใน D10.

ใช้ public `NestExpressApplication.useBodyParser('raw', ...)` จาก Nest/Express ที่มีใน lockfile; ไม่มี direct runtime dependency ใหม่. Parser เลือกเฉพาะ POST Stripe path และ `application/json` รวม charset; limit 100 KiB, ไม่ inflate compressed payload. JSON และ UTF-8 decode เกิดหลังตรวจ signature เท่านั้น. Limit, clock skew และ mode เป็น local component defaults ที่ต้อง review อีกครั้งก่อน provider release; [Nest body-parser documentation](https://docs.nestjs.com/faq/raw-body).

`STRIPE_WEBHOOK_SECRET` ต้องเป็น signing secret `whsec_...` ของ endpoint/listener นี้; ห้ามใช้ `STRIPE_SECRET_KEY` แทน. `STRIPE_WEBHOOK_MODE=test` เป็น default และต้องตรงกับ `event.livemode`; invalid configuration ปฏิเสธทุก request. การมี mode `live` ใน code ไม่ได้อนุญาต deploy หรือเชื่อมข้อมูลจริง. ปัจจุบัน ENV secret ยังว่าง; ไม่สร้าง secret ปลอมใน ENV เพื่อให้ดูเหมือนเชื่อม provider แล้ว.

Receiver รองรับ envelope ของ **account-scoped v1 snapshot events**: event id/type/api_version/created/livemode/data.object.id/object. ไม่รองรับ Connect, organization context หรือ v2 thin events. เก็บ API version ที่มากับ event โดยยังไม่ตีความ business state หรือสมมติว่า fixture version เป็น provider version ที่อนุมัติแล้ว. Event-type subscription/version จริงยังอยู่ D08.

## Persistence และ retry

1. ถ้า config/signature/envelope ไม่ผ่าน: ไม่เขียน DB.
2. หลัง verify: allowlist receipt snapshot และ `INSERT ... ON CONFLICT(eventId) DO NOTHING`; unique constraint ของ PostgreSQL ทำให้ delivery พร้อมกัน converge.
3. อ่าน snapshot/status เดิม; event id ที่มี immutable event data ต่างกันคืน conflict ไม่เขียนทับ proof/time/status. Fingerprint เป็น SHA-256 ของ **canonicalized id/object/type/api_version/created/livemode/data** เพื่อให้ whitespace/key-order และ delivery counter `pending_webhooks` บน fresh signed retry ไม่เกิด false conflict; signature ยังคำนวณจาก original raw bytes ทั้ง payload เท่านั้น. ไม่ใช้ request/transport fields เป็น payment authority; [Stripe Event object](https://docs.stripe.com/api/events/object) ระบุว่า data คงเดิมและ pending_webhooks นับ delivery ที่ยังไม่สำเร็จ.
4. Snapshot เก็บ receipt version, fingerprint, event envelope, object id/type และ Checkout fields ที่จำเป็น: mode/status/payment_status/currency/amount_total/payment_intent. ไม่เก็บ raw body, signature, metadata, email/address/customer details, card fields หรือ client secret. ไม่มี user/course claim จาก metadata กลายเป็น authority. จะต้องใช้ provider reconciliation เมื่อ processor ต้องการข้อมูลนอก snapshot; ไม่ถือ snapshot นี้เป็น raw event archive.
5. Receiver ไม่เปลี่ยน Payment, Enrollment, session หรือผลการเรียน; ไม่ผูก Payment จาก claim ที่ผู้ส่งระบุเอง. Proof/time/processing metadata เดิมยังถูกคุ้มครองด้วย immutable DB triggers.

Local provider response contract ของ receiver (ไม่ใช่ canonical browser API):

| Condition | HTTP | Body / action |
| --- | --- | --- |
| Signature/JSON/envelope/mode mismatch | 400 | safe shared error envelope; no write |
| Same event id, different fingerprint | 409 | safe conflict envelope; original receipt retained |
| Missing signing configuration | 503 | `{ "received": false, "processing": "pending" }` |
| Durable received/failed event, processor ยังไม่เสร็จ | 503 | `{ "received": true, "processing": "pending" }`, `Retry-After: 60` |
| Matching receipt ที่ owner processor บันทึก processed แล้ว | 200 | `{ "received": true }` |
| DB write/read failure | 500 | safe generic error; provider retry, no false ACK |
| Too large / compressed body | 413 / 415 | safe generic error; no write |

**ยังไม่พร้อมเปิด public destination รับเงินจริง**: component นี้ไม่ return 2xx ให้ event ที่เพียงเก็บสำเร็จ เพราะยังไม่มี worker ทำต่อ. Stripe retry เป็นแบบจำกัดระยะเวลา ไม่ใช่ durable work queue แทน processor; receipt ที่ค้างต้องมี reconciliation/replay หลัง processor พร้อม. `Retry-After` เป็น advisory และไม่ได้ควบคุม schedule ของ Stripe. Protocol ACK หลังมี worker/retry design ต้อง review ใน D08/D10. อ้างอิง [Stripe delivery/retry behavior](https://docs.stripe.com/webhooks#automatic-retries).

## Verification และ next step

- 5 signature unit tests รวม UTF-8 golden HMAC vector ที่สร้างด้วย .NET HMACSHA256 แยกจาก verifier.
- 10 actual Nest HTTP + isolated Test PostgreSQL tests: raw whitespace/UTF-8, spoof/tamper/missing/old/future signature, missing config, invalid envelope/mode/Connect, 5 concurrent deliveries, reconnect, reordered JSON/changed delivery counter, id collision, failed/processed retry behavior, parser limits/encoding, DB failure/no diagnostics leak และไม่มี financial/grant writes.
- Shared error schema ตรวจ invalid-signature response ด้วย canonical validator. Provider success/pending response เป็น local receiver contract ตามตารางข้างบน; ไม่อ้าง canonical operation completion.
- Existing foundation/module/HTTP components ต้อง regression ผ่าน; no schema delta จึงไม่ generate/apply migration ซ้ำ.

ถัดไป: ปิดเฉพาะ D08 provider event selection/API version และ D10 processing/reconciliation ที่เกี่ยวข้อง แล้วทำ money transaction → fulfillment transaction ผ่าน EntitlementWriter, ให้ paid state คงอยู่เมื่อ grant ล้มเหลว และ retry โดยไม่ charge ใหม่. PAY-01 ยังต้องสร้าง/ผูก server-owned Checkout Session + price snapshot อย่างถูกต้องก่อน full payment acceptance.

การตรวจ provider จริงต้องใช้ signing secret จาก Stripe Dashboard หรือ local Stripe CLI listener ของ endpoint นี้ แล้ว forward ไป local route. เครื่องนี้ยังไม่มี Stripe CLI และไม่มี signing secret. ยังไม่เคยรับ delivery จาก Stripe จริง, ไม่ deploy/STG และไม่แก้ cloud resources ใน checkpoint นี้. ไม่ส่ง signing secret ใน chat/Git/log.

Verified code SHA: `26cb18665d1ba04cdb8a41f39babd50189845326`; [hosted Nest CI 38078316359](https://github.com/natthawat141/meleran-tutor/actions/runs/38078316359) ผ่าน 135 tests + 6 real-client checks, build และ smoke. Provider delivery verification ยังไม่มี; whole business acceptance ยังคง 0/113.

## Local handoff / receiver verification

Authoritative backend: `D:\code\elearn-prod\worktrees\melearn-fullstack\backend`. ตรวจซ้ำ 11 ต.ค. 2026: signature unit 5 เคส และ receiver HTTP/PostgreSQL 10 เคสผ่าน; signing secret ใน ignored `.env` ยังว่าง. Tests ใช้ fixture secret ชั่วคราวและล้างเฉพาะ event ของตัวเอง ไม่สร้าง Checkout หรือ charge จาก Stripe จริง.

รัน targeted verification จาก `backend/` โดยใช้ Test PostgreSQL ที่มีอยู่และ proxy ที่เปิดไว้:

```powershell
node node_modules/jest/bin/jest.js --config test/jest-components.json --runInBand --runTestsByPath src/features/payments/providers/stripe-signature.spec.ts
$env:ALLOW_TEST_DATABASE_RESET='yes'
try {
  node node_modules/jest/bin/jest.js --config test/jest-database.json --runInBand --runTestsByPath test/database/stripe-webhook.pg-spec.ts
  if ($LASTEXITCODE -ne 0) { throw 'Stripe receiver tests failed' }
} finally { Remove-Item Env:ALLOW_TEST_DATABASE_RESET -ErrorAction SilentlyContinue }
```

ขั้น provider delivery ที่ยังไม่รัน: เมื่อ local API เปิดด้วย runtime Test database บน port 4000 แล้ว ใช้ `stripe listen --forward-to http://127.0.0.1:4000/api/v1/webhooks/stripe` ในเครื่องที่มี CLI/auth พร้อม. นำ signing secret ของ listener นั้นใส่ `STRIPE_WEBHOOK_SECRET` ใน ignored local ENV และ restart API; ห้ามใช้ secret ของ Dashboard endpoint คนละตัวหรือ API key แทน. ตาม [Stripe local listener](https://docs.stripe.com/webhooks#test-locally-without-a-registered-url). คำสั่งนี้เป็น handoff ยังไม่ใช่หลักฐานว่าตรวจ provider ผ่าน และยังไม่เปิด public destination.

เกณฑ์ตรวจ delivery แยกจากเงิน: valid fresh signature → one durable received row / 503 pending; fresh retry ของ event เดิม → same row / 503; invalid signature → 400 / no row; missing secret → 503 / no row. จะได้ 200 เฉพาะ matching receipt ที่ processor บันทึก processed จริงแล้ว. ต้องทำ processor/reconciliation และ PAY-01 ก่อน paid → Enrollment acceptance.

Latest receiver regression: [hosted Nest CI 38083900295](https://github.com/natthawat141/meleran-tutor/actions/runs/38083900295) บน `7c0c4113dba86da354fd5813332850a968d6b343` ผ่าน signature 5 + receiver HTTP/PG 10 ภายใน aggregate 190 tests. Receiver code unchanged from the initial checkpoint; real Stripe delivery/processor remains pending.
