# Frontend / API Acceptance Matrix — Melearn Final 1.6

วันที่ 8 ตุลาคม 2026 · ใช้คู่กับ [R4a API Contract Draft](API_CONTRACT_R4A_DRAFT_TH.md) และ [MELEARN_V1_SCOPE.md](MELEARN_V1_SCOPE.md)

นี่คือรายการหลักฐานสำหรับปิด R5–R10 และ R13 ไม่ใช่ผลตรวจว่าระบบผ่านแล้ว สถานะก่อนมี Backend คือ source/mock/browser evidence เท่านั้น; ไม่มีแถว API/server ที่ปิดได้จาก Vite build หรือ localStorage

## หลักการเก็บหลักฐาน

| ชั้นหลักฐาน | ยืนยันอะไรได้ | ยืนยันอะไรไม่ได้ |
|---|---|---|
| Static/source review | ownership, route, validation/UI wiring และ absence ของ retired entrypoint ใน revision ที่ตรวจ | server permission, persistence, concurrency หรือผลจาก provider จริง |
| Unit/mock tests | UI state/error mapping, validation และ adapter behavior ภายใต้ fixture ที่กำหนด | Backend response/identity, database transaction, webhook และการแชร์ข้อมูลข้ามอุปกรณ์ |
| Browser preview | การ render, navigation, input, loading/error/pending UI ณ build/viewport ที่ระบุ | Production security, API fulfillment, mobile/accessibility ครบ หรือข้อมูลจริง |
| Backend/API integration | DTO/error/auth/state/persistence กับ Backend revision/config ที่ระบุ | การ deploy/promotion ของ artifact หากยังไม่ตรวจ runtime environment |
| Final acceptance | Browser + API/runtime evidence ที่อ้าง commit/artifact/config เดียวกัน ครอบคลุม case ใน scope | Live production readiness หากยังไม่ผ่าน operational/security/release gate ที่เกี่ยวข้อง |

## Matrix ตามกรณีตรวจรับ

| Scope cases | Frontend behavior ที่ต้องเห็น | หลักฐาน local/mock ที่เตรียมได้ | หลักฐาน Backend/Final ที่ยังต้องมี | สถานะหลักฐานที่ตรวจล่าสุด (8 ต.ค.) |
|---|---|---|---|---|
| A01–A20 — Auth, account, roles, verification/reset/Google | Login ด้วย Username หรืออีเมล, account Admin-created, role assignment, verification/reset states, Google link โดยไม่ auto-merge, role/capability navigation | Browser/forms; test validation/return path และ explicit demo-vs-server labels | Identity/session lifecycle, one-use/24h links, Google linking/duplicate denial, server role denial/rate limit, persistence; ไม่ใช้ demo role เป็นหลักฐาน | Prototype-only; Web/Admin field รับ Username/email แล้ว; role/helper ยังเป็น local demo; server gate เปิด |
| C01–C12 — Course authoring/review/ownership | Instructor และ Admin editor ตาม route owner, Admin review/approve/publish, save/error/conflict, public เห็น Published เท่านั้น; owner/Admin learner roster | Component tests สำหรับ editor draft/version/error; route/ownership tests; browser happy/error states | Durable save, server ownership, exact approved revision, stale-review conflict, cross-resource denial, course.learners_read scope และ public-field filtering | Owner boundary เริ่มแยก; legacy editor ยังอยู่; API gate เปิด |
| V01–V03 — Video/YouTube/Upload | รับ YouTube URL, embed success/error, video upload แจ้งยังไม่พร้อมและไม่เปลี่ยนข้อมูล/ภาพอื่น | URL parser/player tests; browser valid/private/deleted/restricted embed; upload-not-ready UX | Stored content format, access-controlled player response, upload endpoint unavailable response/no record; server progress not auto-completed by error | ไม่ผ่านจาก audit: MP4/WebM/base64 + HTML video; ยังไม่แก้ |
| E01–E13 — Free enroll/Redeem | Free enroll, already enrolled, one-use code states, role/owner denials, unverified self-signup denial (Admin-created exception), revoke message | Provisional Web redeem and Admin code management in dev; mock tests cover one-use race, used/revoked/wrong-course denials, existing enrollment and free-course guard | Atomic one-use under database concurrency, durable entitlement, verified account rules against real identity and revoke audit | Mock/API tests pass; no durable Backend or browser-authenticated acceptance |
| P01–P12 — Stripe | Checkout/status enum `pending/processing/succeeded/failed/cancelled/expired`; fulfillment enum `pending/granted/failed`; success page read-only; no access before granted; Admin can inspect one abnormal payment only | Provisional Web checkout/status and Admin single-ID lookup in dev; integration mock test proves checkout never grants and signed test webhook alone fulfills. UI does not redirect to mock `checkout_url` | Stripe signature/secret, price snapshot, webhook retry/dedupe, duplicate/recovery, durable entitlement and owner-scoped `GET /me/payments/{id}`; no payment listing | Mock status/UI wired; real Stripe and Backend evidence absent |
| Q01–Q12 — Progress/Quiz/attempt/grading | Resume; stable attempt; raw `>70%`; pending essay/image result; highest completed graded score; owner-only grading | R7 Query pages and mock integration tests cover resume, 70/71 boundary, highest graded result, immutable submit, pending essay, owner grading and no progress from viewing | Persisted progress across session/device, server score from answers, immutable attempt version, submit idempotency, ownership and concurrent answer/grade protection | Mock/code gate passes; authenticated browser and authoritative Backend score/persistence remain open |
| F01–F08 — Completion/certificate | Auto issue once, preserve result after later course edits, safe owner-only read/download, retry failed render | R7 certificates and mock integration tests cover completion snapshot, private read and exactly-once certificate issuance | Durable `completed_at`/`completion_snapshot`, certificate snapshot/access control, idempotent issue/retry across server/device | Mock/code gate passes; durable Backend and browser acceptance remain open |
| B01–B04 — Public Blog/Admin publishing | Admin draft/preview/publish/edit; public sees Published only | Editor/read renderer tests, draft route browser check | Server Admin-only mutations, durable publish visibility and public filtering | Browser spot-check only; no API persistence proof |
| AI01–AI29 — Transcript, chat/history, quota, AIPractice | Admin-only transcript/AI settings/read; own history CRUD/search; AI errors; 20 successful prompts per Thai day; pending reservation/failure release; practice answers do not count; hide answer key until submission | R9 Web chat/history/context/quota/practice and Admin setting/transcript pages use provisional API in dev; tests cover ownership, context gate, dedupe, quota boundary/failure, answer-key withholding and no Progress mutation | Real model/provider, authorized knowledge isolation, durable history/practice, atomic quota/idempotency, Bangkok day boundary and actual Backend permission evidence | Mock/code gate passes; response is deterministic mock; no real AI/server/persistence or authenticated browser acceptance |
| Responsive/accessibility/theme review | retained routes remain usable at viewport matrix, focus/keyboard visible, contrast and generated tokens resolve consistently | Browser viewport matrix, keyboard-only pass, computed-style/token assertions, accessibility scan where available | N/A for visual mechanics; content/session variations still need authenticated API-backed preview | Landing at 390×844 and 320×844: CTA/benefits fit and document has no horizontal overflow; Admin Login at 390×844 fits; Admin Blog article direct route at 390×844 rendered with mobile menu/drawer and visible menu links. Broader route/breakpoint matrix, computed styles, contrast and keyboard-only checks remain open |
| R11/R12 packaging/CI | independent Web/Admin build, deep-link fallback, correct public API configuration injection, dependency-aware CI | Dockerfiles/smoke runner are configuration-only; container build/runtime intentionally unrun per user instruction; GitHub CI completed after R5 theme/consumer/Profile-prep at checkpoint `e81acc2` ([run 37748971907](https://github.com/natthawat141/meleran-ux-ui-2026/actions/runs/37748971907)) | deploy environment, API origin/session CORS/CSRF, artifact promotion, rollback and service evidence after decisions | GitHub runner passed path selection, shared checks, Web/Admin typecheck/build/artifact upload and final validation. Docker runtime remains unverified; CD and hosting selection pending |

## Minimum evidence record per closed slice

Each row closed in a future report must link or record:

1. Scope case IDs and contract revision/backend owner (if API-backed).
2. Frontend commit SHA, Web/Admin build artifact identifier, and relevant environment/config revision.
3. Tests run and result; mock tests must be named as mock/local.
4. Browser route, account/capability, viewport, action, expected/actual result and screenshot or reproducible capture for visual behavior.
5. Server-side evidence for permission, persistence, concurrency, payment webhook, score, completion, quota or other authoritative state as applicable.
6. Known limitations and rollback checkpoint; do not mark a feature `released` solely because files moved or the route renders.

## Current gate summary

- R0–R3c structural checkpoints are recorded in [FRONTEND_REFACTOR_PLAN_TH.md](FRONTEND_REFACTOR_PLAN_TH.md); UI visual/accessibility acceptance is still open.
- R4a has a draft only. No Backend owner/OpenAPI is present in this workspace, so candidate paths and payloads remain unfrozen.
- R10 and R13 cannot pass until a Backend exists and the relevant server cases above have evidence tied to the matching frontend revision.
- A successful typecheck/build or mock fixture can close only its own code/build/mock gate; it cannot close API, security, payment, or production gates.
