# ตรวจความครบถ้วน Wave 1–13 — 11 ต.ค. 2026

**ยังไม่ครบ:** 44 tasks ใน Wave 1–13 ปิดครบ 7 tasks; 25 NEEDS_DECISION และ 12 BLOCKED. จบทั้ง Wave เฉพาะ 1 และ 2.
73 defined HTTP operations ในช่วงนี้: 16 ผ่านระดับ component, 9 มี controller เดิมแต่ยังไม่ผ่านการตรวจรับใหม่ และ 48 ยังไม่มี controller. Stripe receiver เป็น deferred operation แยกจาก 73 นี้ และยังไม่ใช่ payment processor.

คำว่า “Task 1–13” ไม่มีเลข task กลางในระบบ: ใบงานใช้ ID เช่น AUTH-01 ส่วนแผนแบ่ง Wave 1–17. รายงานหลักตรวจ Wave 1–13 ตามบริบทเดิม; 13 ใบงานแรกในตารางอยู่ท้ายรายงาน.

## หลักฐานและขอบเขตการตรวจ

- Checkout: `worktrees/melearn-fullstack`, branch `backend/v1-foundation`; ตรวจที่ `b7e60a33ca45987c578592061509da463cc31521` และ remote HEAD ตรงกัน.
- Hosted [CI 38093313600](https://github.com/natthawat141/meleran-tutor/actions/runs/38093313600) ตรวจซ้ำสถานะเป็น success บน code `5b2e7e6c857d0e2250a78b57a24b572895da8e50`. ส่วนต่างจาก code ถึง checkout นี้เป็น checkpoint documents เท่านั้น.
- CI checkpoint มี 353 backend tests + 98 Frontend client checks. รอบ audit นี้ไม่รันชุดเหล่านั้นใหม่; ไม่มี implementation change และไม่มีการเชื่อม provider/ฐานข้อมูลหรือ migration.
- รัน `node scripts/check-blueprint.cjs` และ `node scripts/check-boundaries.cjs` จาก backend/ ใหม่: ผ่าน. Blueprint ตรวจ 86 defined / 5 deferred / 113 exact scope cases / 50-task DAG / migration checksums.
- เทียบ execution board, canonical operation matrix, task DoD, source controller/module, immutable snapshot/transaction component notes และชุด tests. ใช้ TypeScript AST อ่าน route declarations และตรวจ local feature module อ้าง controller; เป็น static source evidence ไม่ใช่การพิสูจน์ HTTP/permission ใหม่.
- Contract `1.0.0-draft.1` / SHA256 `c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3` ยัง Draft. ไม่แก้ Scope/contract/status ให้ดูเสร็จ.
- [JSON ราย task/operation](WAVE_01_13_AUDIT.json) เก็บ 44 tasks / 73 operations พร้อม controller source/line, decisions และ remaining components; เป็น snapshot audit ไม่แทน [execution board](EXECUTION_STATUS.json).

## สถานะและสิ่งที่ขาดต่อ Wave

`ผ่าน API` ในตารางหมายถึง COMPONENT_VERIFIED ของ canonical operation เท่านั้น. ไม่รวม helper, schema, Stripe deferred หรือ frontend fixture checks; ยังมี scope subsets/prerequisites ตามใบงาน.

| Wave | Tasks ปิดครบ | API ผ่าน component | ที่ทำแล้ว | สิ่งที่ยังขาดก่อนปิด Wave |
| --- | --- | --- | --- | --- |
| 1 | 1/1 | 0/0 | FOUNDATION-01: bootstrap/errors/validation/isolation | ครบตาม technical DoD; feature behavior แยกตรวจใน task เจ้าของ |
| 2 | 1/1 | 0/0 | DB-01 บน isolated Test PostgreSQL | ครบ physical batch ที่ตรวจแล้ว; ไม่หมายถึงทุก domain พร้อม HTTP |
| 3 | 3/6 | 1/2 | DB-02, DB-05, CI-01; Catalog detail; stored session/normalized principal kernel | AUTH-BASE-01 ยังขาด issuance/security/writer cutover; CATALOG-01 list/search/sort/cursor D16; DB-06 provider identity schema D03 |
| 4 | 2/7 | 1/4 | DB-03, DB-04; Instructor profile; public Course-detail browser slice | CATALOG-02 instructor course list; BLOG-01 list/detail/storage gaps D05/D16; COMPLETION-01 orchestration D06; PROVIDER-AUTH-01; INTEGRATION-01 full Catalog gate |
| 5 | 0/1 | 1/2 | AUTH-01 current-session Logout | Login ยัง prototype; Username/Email/Google owner, normalized roles, cookie/TTL/CSRF/CORS/throttle/recovery D01–D03 และ browser Auth gate |
| 6 | 0/8 | 4/20 | ACCOUNT-01 self read; ENROLL-01 free enroll + internal grant; CERT-01 own detail; VIDEO-01 fixed V1 unavailable response | Profile PATCH; enrolled list; Register/verify/resend/reset; AI create/list/messages; Blog create/edit/list/preview; certificate list/download/auto issue; actual editor/browser verification |
| 7 | 0/5 | 2/10 | AI-05 rename; PAY-01 own payment status | AI delete D11; Stripe Checkout D08/D10; BLOG-03 publish/unpublish/delete; MGMT-01 create/list/detail cutover; INTEGRATION-02 authenticated end-to-end slice |
| 8 | 0/3 | 0/3 | Stripe signature + durable receipt receiver (deferred) | Checkout-bound event processor/fulfillment/reconciliation/real delivery; PAY-02 Admin detail contract conflict; MGMT-02 normalized Instructor grant/list |
| 9 | 0/1 | 0/4 | COURSE-01 ยังไม่มี verified feature component | Instructor/Admin create/list APIs; ownership, initial state, replay D10; prerequisites Auth/Management |
| 10 | 0/2 | 1/7 | REDEEM-01 revoke; code/grant internal transaction | COURSE-02 authoring read/PATCH/preview/submit-review; revision/rich text/image D04/D05/D09; Redeem issue/list/generation/query |
| 11 | 0/4 | 5/9 | AI-01 ครบ 3 HTTP components; LEARN-01 enrolled course/item reads; REDEEM-02 internal writer | AI settings/transcript full Admin UI/prerequisites; GET /me/progress และ learning management/preview mapping; public POST /me/redeem normalization/course lifecycle; REVIEW-01 list/detail |
| 12 | 0/3 | 0/8 | Internal submitted-score helper และ resume persistence | ASSESS-01 start/save/submit snapshot/state orchestration; LEARN-02 complete/resume HTTP; REVIEW-02 approve/return/publish; Completion wiring และ D04/D06/D09/D10 |
| 13 | 0/2 | 1/4 | ASSESS-02 owned historical Attempt read | GET item results/best result D06; GRADE-01 grading queue/manual grade, ownership/state/replay D10 และ completion/certificate orchestration |

รวม 7/44 tasks และ 16/73 HTTP components; **ไม่ใช่ 13 waves เสร็จแล้ว**. ในระบบทั้งหมดมี 18/86 components เพราะ AI usage (Wave 14) และ AI practice answers (Wave 15) ผ่านเพิ่มนอกช่วง audit นี้. ยัง 0/113 full feature acceptance ตาม evidence register.

## Source findings ที่มีผลต่อการนับว่าเสร็จ

1. **9 APIs ยังเป็น route เดิมที่ไม่มี verified component ตาม blueprint:** POST /auth/login; PATCH /me; GET /courses; GET /me/enrollments; POST/GET /admin/users; GET /admin/users/{id}; POST /admin/users/{id}/instructor; GET /admin/instructors. ห้ามนับรวมกับ 16 ที่ผ่านแล้วเพียงเพราะมี controller หรือ smoke response.
2. `auth.service.ts` Login ยังอ่าน compatibility `Account.roles`, ตรวจ local credential และออก 12h session; controller ใช้ cookie strict โดยไม่มี HTTPS Secure branch. ไม่ใช่ Firebase Email/Google protocol หรือ policy ที่อนุมัติแล้ว. D01/D02/D03 ยังเปิด.
3. `management.service.ts` grant Instructor ยังแก้ role string; new verified routes ใช้ normalized UserRole. ต้อง cut over writer ผ่าน Auth owner ไม่เช่นนั้น UI/legacy/new authorization ให้ภาพสิทธิ์ไม่สอดคล้องกัน. Guard legacy path ยังอ่าน role string; ไม่ได้เปลี่ยนทุก route ให้ authoritative แล้ว.
4. Boundary gate ผ่านโดยมี **2 tracked prototype writer exceptions**: Accounts และ Management services ใน `backend/test/architecture-baseline.json`. ผ่าน gate ไม่เท่ากับ ownership convention ครบทุก feature.
5. DB-05 DONE เป็น physical batch; Blog ยังไม่มี canonical `content`, `category`, `reading_minutes` ที่พร้อมตาม write/response policy. ดู [storage gaps](CONTRACT_STORAGE_GAPS.md). ไม่สร้าง public response ด้วยค่าปลอม.
6. Read checks ที่ใช้ stored financial/academic/session fixtures ไม่พิสูจน์ Checkout, login, start/submit/grade หรือ automatic completion writers. การอ่าน Attempt สำเร็จไม่ปิด ASSESS-01/GRADE-01.
7. VIDEO-01 intentionally returns unavailable ตาม V1. งานที่ขาดคือ prerequisite/editor/browser gate ตามใบงาน; ไม่เพิ่ม upload provider นอก Scope เพื่อปิด task.
8. [PAY-02 conflict](LOGOUT_PAYMENT_COMPONENTS.md): required checkout_session_id ของ Admin DTO เทียบกับ nullable pre-provider storage และ event outcomes ที่ยังไม่ตกลง. ห้ามคืน empty ID หรืออ้าง processed=fulfilled.
9. Canonical Attempt status ไม่มี committed `submitted` ที่ Scope/storage มี; proposal เรื่อง atomic transition อยู่ [Attempt component](ATTEMPT_READ_COMPONENT.md). ต้องปิด HTTP mapping ก่อน Submit ไม่ silently rename state.

## สิ่งที่ต้องตกลง กับ implementation ที่ยังต้องทำ

| กลุ่ม | Decision ที่ต้องปิด | งาน implementation/gates หลังปิด |
| --- | --- | --- |
| Public Catalog | D16 query/cursor ของ Catalog โดยเฉพาะ | List/search/cursor + instructor courses → full INTEGRATION-01 |
| Identity/Auth | D01 transport/TTL/CSRF/CORS/throttle; D02 credential/profile semantics; D03 Firebase/Resend proof/link/recovery | DB-06/Auth kernel writers → provider → Login/Register/Recovery + normalized Management → INTEGRATION-02 |
| Course/review | D04 revision/aggregate/state; D05 rich document; D09 image protocol; D10 create/replay | COURSE-01/02 → REVIEW-01/02 → editor/review/publish/Catalog learning gates |
| Learning/results | D06 comparison across changed maximums; D09 image answers; D10 Start/Submit/Grade replay/state | COMPLETION-01 → learning complete/resume + start/save/submit → best result/manual grading → certificate |
| Financial/Redeem | D08 Stripe money/event selection; D10 reconciliation/replay; redeem input/lifecycle mapping | Checkout/processor/entitlement/real sandbox delivery; code issue/list/public redeem + browser G-REDEEM |
| AI/Blog | D11 delete/retention/in-flight; D05/D16 storage/query; D12 provider request recovery (Wave 14) | AI history/delete/provider gates; Blog authoring/publication. Rename/settings ผ่าน component ไม่แทน generation/history |

รายละเอียดข้อเสนอที่มีอยู่แล้ว: [NEXT_DECISIONS_TH](NEXT_DECISIONS_TH.md), [Decision Register](DECISIONS.md). ไม่ถือว่าอนุมัติเพียงเพราะมี proposed design. ขณะเดียวกัน decision ที่ปิดแล้วก็ยังต้อง implement/test/integrate งานในคอลัมน์ขวา; backlog ไม่ได้เกิดจาก decision อย่างเดียว.

ลำดับแนะนำสำหรับปิดช่องว่าง: Catalog D16 → full public slice; Auth D01–D03 → identity writers/provider/login/account/free-enroll slice; Course authoring/review; Learning/assessment/completion/grading; Stripe/Redeem; ตรวจ feature gates แยกตลอดทาง. Schema owner ผู้เดียวและทำคนเดียวตามคำสั่งล่าสุด.

## ถ้าหมายถึง 13 ใบงานแรกในตาราง EXECUTION_PLAN

นับจากแถวแรกของ Task board (ไม่ใช่ลำดับ array ใน JSON): **7/13 DONE**, อีก 6 ยังไม่ครบ.

| ลำดับ | Task | ผลตรวจปัจจุบัน |
| --- | --- | --- |
| 1 | FOUNDATION-01 | DONE |
| 2 | DB-01 | DONE |
| 3 | AUTH-BASE-01 | Partial kernel; security/credential/identity writers ยังขาด |
| 4 | CATALOG-01 | Detail ผ่าน; list/query D16 ยังขาด |
| 5 | DB-02 | DONE |
| 6 | CI-01 | DONE |
| 7 | DB-05 | DONE physical batch; Blog storage/provider feature gaps ยังเปิดแยก |
| 8 | DB-06 | D03; provider-auth schema ยังขาด |
| 9 | INTEGRATION-01 | Course detail browser/client ผ่าน; full Catalog gate ยังขาด |
| 10 | CATALOG-02 | Profile ผ่าน; instructor course list ยังขาด |
| 11 | COMPLETION-01 | D06; actual completion/certificate orchestrator ยังขาด |
| 12 | DB-03 | DONE |
| 13 | DB-04 | DONE |

เอกสารแผน/OPERATION_MATRIX เก็บ planning baseline ไม่ใช่ current completion source; ใช้ execution board สำหรับ readiness แล้วเทียบ code/test evidence ตาม audit นี้. งาน audit แก้เฉพาะเอกสาร ไม่แก้ business API, ENV, database, contract หรือ deployment.
