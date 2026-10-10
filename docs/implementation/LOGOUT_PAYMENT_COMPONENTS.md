# Current-session logout และ own Payment read — execution checkpoint

11 ต.ค. 2026. Component scope เท่านั้น; whole AUTH-01/PAY-01 ยังไม่ DONE.
Canonical `1.0.0-draft.1`, SHA-256 `c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3` unchanged.

| Task / operation | Confirmed behavior / contract | Evidence |
| --- | --- | --- |
| AUTH-01 `POST /auth/logout`, `post_auth_logout` | ไม่มี body, 204 ไม่มี JSON; session ปัจจุบันเท่านั้น, Web/Admin แยกกัน | 14 HTTP/PostgreSQL tests; 7 named unchanged `authSessionApi.logout` client checks |
| PAY-01 `GET /me/payments/{id}`, `get_me_payments_id` | `WirePaymentView` 5 required fields; nullable Enrollment; เจ้าของ Payment เท่านั้น; GET ไม่ charge/grant | 16 HTTP/PostgreSQL tests; 8 named unchanged `paymentApi.status`/decoder client checks |

## Source and authority

- [AUTH-01](tasks/AUTH-01.md), Scope §2.1/§5.1: Logout ยกเลิกเฉพาะ app session. ใช้ cookie name/path เดิม ไม่อนุมัติ TTL/CSRF/CORS/login policy จาก prototype.
- [PAY-01](tasks/PAY-01.md), Scope permission `payment.read_self` และ §2.4/§5.11, P03/P06/P07/P10/P12: อ่านเงิน/สิทธิ์แยกกัน, ไม่เชื่อ success URL, preserve source ของ Enrollment เดิม. ไม่อ้างว่า numbered acceptance ผ่านจาก fixtures.
- Guard และ service ตรวจ stored normalized roles/session ใหม่; ไม่รับ account/role/เงินจาก client เป็น authority. Historical read ไม่เพิ่มเงื่อนไข buying eligibility/current Course Published เพื่อปิดประวัติเดิม.
- Foreign/unknown Payment 404 แบบเดียวกัน; Admin self route อ่านของคนอื่นไม่ได้. Non-Admin Admin namespace 403; anonymous/expired/revoked/disabled 401.

## Transaction and ownership conventions

**Technical implementation:** Logout จับ Session `FOR UPDATE` ก่อน Auth account/roles locks เพื่อป้องกันสองคำขอยกระดับ shared lock พร้อมกัน; ตรวจ session อีกครั้งแล้วตั้ง `revokedAt` ด้วยเวลา DB. Commit ก่อนส่ง expired cookie. Parallel one-session logout ได้ 204 หนึ่งคำขอและ 401 อีกคำขอ; replay ไม่เปลี่ยน audit timestamp. ไม่มี logout-all/delete/history writes.

Payment read จับ Auth session/account/roles → owned Payment `FOR SHARE` → linked Enrollment `FOR SHARE`. ไม่มี Course lock หรือ provider call; จำกัด selected columns ก่อนสร้าง DTO. อ่าน enrollment เฉพาะที่ Payment เชื่อมไว้; ไม่อนุมานสิทธิ์จาก Enrollment อื่นเมื่อ fulfillment ยัง pending/failed. Source free/redeem/stripe ของรายการเดิมยังอยู่.

ไม่ใช้ `EntitlementWriter` จาก GET; ไม่มี PaymentEvent/raw provider proof/card/price/request/Checkout ID ใน own DTO. ข้อมูลผิดรูปหรือ SQL fault คืน masked canonical 500, ไม่ซ่อมข้อมูลจาก GET. No schema/migration/dependency/provider/cloud/STG/deployment changes.

## Verification and remaining gates

Tests ใช้ `melearn_test_app` บน isolated `melearn_test` และ scoped fixture cleanup; ไม่มี truncate หรือ destructive global reset. ครอบคลุม exact canonical DTO, cookie isolation, post-guard revocation/disable, real rollback/SQL failure, reconnect และ `pg_blocking_pids` ยืนยัน actual lock wait.

Client harness ใช้ source Frontend ที่ไม่แก้, real fetch, built Nest และ PostgreSQL; inject เฉพาะ fixture config/session. Mock/provisional server และ browser gate ไม่ใช่ evidence ของชุดนี้.

- AUTH-01 login/D01/D02/D03, Firebase/Resend/provider credentials และ browser cookie/Origin ยังค้าง.
- PAY-01 Checkout/D08/D10 และ verified-event financial processor/fulfillment/provider tests ยังค้าง. Receipt receiver เดิมเป็นคนละ component.
- PAY-02 **new explicit conflict**: required `WireAdminPayment.checkout_session_id` เป็น string แต่ DB intent ก่อน remote Checkout สำเร็จมี `checkoutSessionId=null` อย่างถูกต้อง. ห้ามคืน empty/fake ID หรือซ่อน payment ที่อ่านได้โดยไม่มี policy. Proposed: required-nullable field เพื่อคงข้อมูลทุกสถานะ; ต้องอนุมัติ canonical change และ sync decoder/snapshot ก่อน implementation.
- PAY-02 events `outcome` ยังต้อง mapping จาก stored `received/processed/failed` และ D08 fulfillment result ที่ชัดเจน; `processed` ไม่แปลว่า `fulfilled` ทุกเหตุการณ์.
- 113 original cases ยังติดตามครบ; full business acceptance remains 0. Full task/wave counts ไม่เพิ่มจาก subset นี้.

Local/hosted aggregate counts และ exact code SHA อยู่ [Execution Status](EXECUTION_STATUS.md); hosted result จะบันทึกหลังตรวจ run ของ SHA นี้จริง.

Verified code SHA: `df236a23fe9a54abf194df1224bb4ae8739c0d8b`; [hosted Nest CI 38092340554](https://github.com/natthawat141/meleran-tutor/actions/runs/38092340554) passed 332 tests + 89 client checks/build/smoke/gates. Provider/browser/full feature acceptance remain open.
