# Frontend / API Acceptance Matrix — Melearn Final 1.6

วันที่ 9 ตุลาคม 2026 · ใช้คู่กับ [R4a API Contract Draft](API_CONTRACT_R4A_DRAFT_TH.md) และ [MELEARN_V1_SCOPE.md](MELEARN_V1_SCOPE.md)

นี่คือรายการหลักฐานสำหรับปิด R5–R10 และ R13 ไม่ใช่ผลตรวจว่าระบบผ่านแล้ว สถานะก่อนมี Backend คือ source/mock/browser evidence เท่านั้น; ไม่มีแถว API/server ที่ปิดได้จาก Vite build หรือ localStorage

ปิด Self-audit findings ทั้ง 4 ของ `dd9aaf7` แล้ว: owner-Instructor submit-review/ถอน Admin action, canonical THB Money, full already-enrolled checkout validation และ Blog revision ทุก mutation. Regression tests + successful request-body/response schema checks ผ่าน 172/172; typecheck และ boundaries ผ่าน. ดู [ผล/ขอบเขตที่ยังเปิด](R7_API_MOCK_PROGRESS_TH.md). การปิด findings นี้ไม่ปิด browser หรือ Backend/provider acceptance.

CI ของ code commit `968e49f2ece83d120e1bcff67aad6bae2e6f0632`: [GitHub run 37869243362](https://github.com/natthawat141/meleran-ux-ui-2026/actions/runs/37869243362) **success** — shared checks, Web/Admin build และ container smoke ทั้งสอง apps ผ่าน. ไม่รัน Docker ในเครื่อง.

## Contract evidence — 9 ต.ค. 2026

[OpenAPI Draft](../packages/contracts/openapi/openapi.json) กำหนด 86 operations และแยก 5 provider operations ไว้ pending; route inventory รวม 91 ตรงกับ mock. Generated HTTP types drift check, schema/examples และ malformed/public-field tests ผ่าน. Login/session Web/Admin แยกกันตามที่ผู้ใช้ยืนยัน; mock tests ตรวจ Login audience mismatch, session audience binding และ Logout เฉพาะแอป. Actual learning/payment adapters รักษา course/enrollment fields ครบ.

Tests 166/166, typecheck Web/Admin/packages และ dependency boundaries/build Web/Admin ผ่าน (มี chunk-size/use-client warnings เดิม). ยังไม่ปิด real cookie/CORS/CSRF, provider integration หรือ browser/mobile/keyboard acceptance. Admin submit-review และ Blog revision bypass ปิดแล้วในชุดแก้ถัดจากผล CI นี้; course publish/return explicit revision preconditions ยังต้องตกลง. รายละเอียดใน `x-pending-decisions` และ [R4a Draft](API_CONTRACT_R4A_DRAFT_TH.md). ไม่ใช้ผลตรวจเก่าปิดช่องว่างปัจจุบัน.

หลักฐาน CI ของ code commit `4f0416bc56460d07bdb7477d5763abbbec175ba5`: [GitHub run 37866894259](https://github.com/natthawat141/meleran-ux-ui-2026/actions/runs/37866894259) **success** — changes/shared-checks, Web/Admin typecheck/build, container smoke ของทั้งสอง apps และ final validate ผ่าน. รัน containers บน GitHub runner; ไม่รัน Docker ในเครื่อง. ไม่ยืนยัน Backend/provider integration หรือ browser acceptance.

## หลักการเก็บหลักฐาน

| ชั้นหลักฐาน | ยืนยันอะไรได้ | ยืนยันอะไรไม่ได้ |
|---|---|---|
| Static/source review | ownership, route, validation/UI wiring และ absence ของ retired entrypoint ใน revision ที่ตรวจ | server permission, persistence, concurrency หรือผลจาก provider จริง |
| Unit/mock tests | UI state/error mapping, validation และ adapter behavior ภายใต้ fixture ที่กำหนด | Backend response/identity, database transaction, webhook และการแชร์ข้อมูลข้ามอุปกรณ์ |
| Browser preview | การ render, navigation, input, loading/error/pending UI ณ build/viewport ที่ระบุ | Production security, API fulfillment, mobile/accessibility ครบ หรือข้อมูลจริง |
| Backend/API integration | DTO/error/auth/state/persistence กับ Backend revision/config ที่ระบุ | การ deploy/promotion ของ artifact หากยังไม่ตรวจ runtime environment |
| Final acceptance | Browser + API/runtime evidence ที่อ้าง commit/artifact/config เดียวกัน ครอบคลุม case ใน scope | Live production readiness หากยังไม่ผ่าน operational/security/release gate ที่เกี่ยวข้อง |

## Matrix ตามกรณีตรวจรับ

| Scope cases | Frontend behavior ที่ต้องเห็น | หลักฐาน local/mock ที่เตรียมได้ | หลักฐาน Backend/Final ที่ยังต้องมี | สถานะหลักฐาน (browser เก่า 8 ต.ค.; HTTP migration 9 ต.ค.) |
|---|---|---|---|---|
| A01–A20 — Auth, account, roles, verification/reset/Google | Login ด้วย Username หรืออีเมล, account Admin-created, role assignment, verification/reset states, Google link โดยไม่ auto-merge, role/capability navigation | Browser/forms; test validation/return path และ explicit demo-vs-server labels | Identity/session lifecycle, one-use/24h links, Google linking/duplicate denial, server role denial/rate limit, persistence; ไม่ใช้ demo role เป็นหลักฐาน | Mock Login/Profile/GET-PATCH me ผ่าน browser ทั้ง Web/Admin และ refresh; Auth ไม่มี store fallback. Admin management ใช้ HTTP แล้ว; Google/Media และ Backend gate ยังเปิด |
| C01–C12 — Course authoring/review/ownership | Instructor และ Admin editor ตาม route owner, Admin review/approve/publish, save/error/conflict, public เห็น Published เท่านั้น; owner/Admin learner roster | Component tests สำหรับ editor draft/version/error; route/ownership tests; browser happy/error states | Durable save, server ownership, exact approved revision, stale-review conflict, cross-resource denial, course.learners_read scope และ public-field filtering | Authoring HTTP/form roundtrip, revision conflict, atomic validation/history guards, owner/Admin boundaries ผ่าน mock tests; browser migration/real Backend ยังเปิด |
| V01–V03 — Video/YouTube/Upload | รับ YouTube URL, embed success/error, video upload แจ้งยังไม่พร้อมและไม่เปลี่ยนข้อมูล/ภาพอื่น | URL parser/player tests; browser valid/private/deleted/restricted embed; upload-not-ready UX | Stored content format, access-controlled player response, upload endpoint unavailable response/no record; server progress not auto-completed by error | ไม่ผ่านจาก audit: MP4/WebM/base64 + HTML video; ยังไม่แก้ |
| E01–E13 — Free enroll/Redeem | Free enroll, already enrolled, one-use code states, role/owner denials, unverified self-signup denial (Admin-created exception), revoke message | Provisional Web redeem and Admin code management in dev; mock tests cover one-use race, used/revoked/wrong-course denials, existing enrollment and free-course guard; authenticated Admin page render smoke passed | Atomic one-use under database concurrency, durable entitlement, verified account rules against real identity and revoke audit | Free enrollment completed in authenticated R7 browser journey; redeem journey still awaits UI interaction; durable Backend remains open |
| P01–P12 — Stripe | Checkout/status enum `pending/processing/succeeded/failed/cancelled/expired`; fulfillment enum `pending/granted/failed`; success page read-only; no access before granted; Admin can inspect one abnormal payment only | Provisional Web checkout/status and Admin single-ID lookup in dev; integration mock test proves checkout never grants and signed test webhook alone fulfills. UI does not redirect to mock `checkout_url`; dev-only simulator passes a signed event through the regular handler | Stripe signature/secret, price snapshot, webhook retry/dedupe, duplicate/recovery, durable entitlement and owner-scoped `GET /me/payments/{id}`; no payment listing | Authenticated Web checkout→signed mock event→enrollment and Admin lookup of the created Payment passed; real Stripe and Backend evidence remain open |
| Q01–Q12 — Progress/Quiz/attempt/grading | Resume; stable attempt; raw `>70%`; pending essay/image result; highest completed graded score; owner-only grading | R7 Query pages and mock integration tests cover resume, 70/71 boundary, highest graded result, immutable submit, pending essay, owner grading and no progress from viewing; browser completed quiz and essay owner-grading | Persisted progress across session/device, server score from answers, immutable attempt version, submit idempotency, ownership and concurrent answer/grade protection | Authenticated learner→attempt→pending essay→Instructor owner grade→4/4 passed; media URL in seed is unavailable and real Backend scoring/persistence remain open |
| F01–F08 — Completion/certificate | Auto issue once, preserve result after later course edits, safe owner-only read/download, retry failed render | R7 certificates and mock integration tests cover completion snapshot, private read and exactly-once certificate issuance | Durable `completed_at`/`completion_snapshot`, certificate snapshot/access control, idempotent issue/retry across server/device | Browser confirmed 3/3 items, 100%, and certificate link after mock quiz pass; durable Backend remains open |
| B01–B04 — Public Blog/Admin publishing | Admin draft/preview/publish/edit; public sees Published only | Editor/read renderer tests, draft route browser check | Server Admin-only mutations, durable publish visibility and public filtering | Public Blog list/detail อ่าน API และ draft filtering/pagination tests ผ่าน; Admin Blog editor ใช้ HTTP แล้ว; rich document/editor/public consistency + revision/publish/unpublish/delete ผ่าน mock/client tests; browser migration/durable publish ยังเปิด |
| AI01–AI29 — Transcript, chat/history, quota, AIPractice | Admin-only transcript/AI settings/read; own history CRUD/search; AI errors; 20 successful prompts per Thai day; pending reservation/failure release; practice answers do not count; hide answer key until submission | R9 Web chat/history/context/quota/practice and Admin setting/transcript pages use provisional API in dev; tests cover ownership, context gate, dedupe, quota boundary/failure, answer-key withholding and no Progress mutation; authenticated pages render | Real model/provider, authorized knowledge isolation, durable history/practice, atomic quota/idempotency, Bangkok day boundary and actual Backend permission evidence | Mock/code gate passes; authenticated AI chat/practice and Transcript edit interactions remain unverified in browser; no real AI/server/persistence |
| Responsive/accessibility/theme review | retained routes remain usable at viewport matrix, focus/keyboard visible, contrast and generated tokens resolve consistently | Browser viewport matrix, keyboard-only pass, computed-style/token assertions, accessibility scan where available | N/A for visual mechanics; content/session variations still need authenticated API-backed preview | Landing at 390×844 and 320×844: CTA/benefits fit and document has no horizontal overflow; Admin Login at 390×844 fits; Admin Blog article direct route at 390×844 rendered with mobile menu/drawer and visible menu links. Broader route/breakpoint matrix, computed styles, contrast and keyboard-only checks remain open |
| R11/R12 packaging/CI | independent Web/Admin build, deep-link fallback, correct public API configuration injection, dependency-aware CI | Local Docker build and `containers/verify-container.mjs` passed for Web/Admin: non-root, `/healthz`, assets/cache headers, app-owned SPA deep links, 404 boundaries; R11 details and image IDs in [container verification report](archive/reports/R11_CONTAINER_VERIFICATION_TH.md). GitHub CI completed after R5 theme/consumer/Profile-prep at checkpoint `e81acc2` ([run 37748971907](https://github.com/natthawat141/meleran-ux-ui-2026/actions/runs/37748971907)) | deploy environment, API origin/session CORS/CSRF, artifact registry/promotion, rollback and service evidence after decisions | R11 local runtime gate passes for two independent static images; no registry push/deployment. GitHub runner passed path selection, shared checks, Web/Admin typecheck/build/artifact upload and final validation. R12 CD/hosting selection pending |

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
- R4a has canonical Draft HTTP DTOs used by clients/mock. No Backend owner/OpenAPI is present, so they remain unfrozen. See current fixes and remaining business localStorage inventory in [progress](R7_API_MOCK_PROGRESS_TH.md).
- R10 and R13 cannot pass until a Backend exists and the relevant server cases above have evidence tied to the matching frontend revision. Local authenticated Web R7 learning/grading/certificate and R8 mock checkout/payment lookup journeys now pass; these remain mock-only browser evidence.
- A successful typecheck/build or mock fixture can close only its own code/build/mock gate; it cannot close API, security, payment, or production gates.

## หลักฐานรอบถอน store — 9 ต.ค. 2026

Authoring/Instructor/Admin management/Blog ย้าย API แล้วและ `packages/store` ถอนแล้ว. Tests ใหม่ตรวจ generated IDs, rich documents/answer keys, stale revision, history guards, atomic invalid writes, privacy และ actual feature clients ผ่าน HTTP mock. Browser รอบนี้ถูก ERR_BLOCKED_BY_CLIENT จึงยังยืนยัน UI interactions ไม่ได้; browser หลักฐานเก่าไม่ถือว่า acceptance ของ revision นี้. ดู [progress](R7_API_MOCK_PROGRESS_TH.md).


## Audit runtime/CI — 9 ต.ค. 2026

Management/Authoring/Blog/transcript resources ตรวจ payload ตาม operation และ nested DTO ก่อน UI; actual mock journey ของ pending→owner grade→graded/roster ผ่าน decoder. Quiz draft parser ตรวจ incomplete/stale/corrupt data. Current local tests159/typecheck/build/boundariesผ่าน. Sourceมี up/down actions และ responsive CSS แต่ **ยังไม่ยืนยัน keyboard/mobile/flow interaction จริง** เพราะ browser security policy ปฏิเสธ preview. Hosted CI/containerผล current SHA อ่านจาก progress; local Dockerไม่ถูกใช้. ไม่ปิด R10/R13 จากผล static runtime/DTO tests.


## Current UI checklist (ยังไม่ผ่าน browser acceptance)

ทุกข้อด้านล่างต้องตรวจจริงบน desktop และจอเล็ก เช่น390×844; source/mock tests ไม่แทนผล click/layout. บันทึก source SHA/app origin/mock config และห้ามใช้บัญชี/ข้อมูลจริง.

| Flow | กรณีที่ต้องตรวจใน UI | ผล audit รอบนี้ |
| --- | --- | --- |
| Create/edit course | owner Instructor กับ Admin สร้าง/บันทึก/reload; invalid title/priceไม่หาย; save disabled/pending | Browser blocked; HTTP/client testsผ่าน |
| Reorder | chapters/items ด้วยdrag และเมนูup/down; Tab/Enter/Arrow/Escape; save/reload order | มีfallbackactionsในsource; keyboard/layoutจริงยังไม่ยืนยัน |
| Quiz | new generated IDs, rich prompt/choices/essay, save/reload, pass fixed70; historylock | HTTP roundtrip/history testsผ่าน; editor interactionยังไม่ยืนยัน |
| Review/publish | owner submit→Admin approve→owner/Admin publish; stale review/version409; approved editต้องreviewใหม่ | HTTP permission/revision testsผ่าน; UI journeyยังไม่ยืนยัน |
| Grading | owner scoreรายข้อ, exactly70 fail, pending→graded; other Instructor/Admin denied; retryบางข้อ | HTTP/decoder testsผ่าน; actual typing/focusยังไม่ยืนยัน |
| Admin users | list/detail/add InstructorคงLearner; username/email nullable; private/public separation | HTTP/decoder testsผ่าน; dialog/table mobileยังไม่ยืนยัน |
| Blog | rich image/text→draft preview→publish→public→edit/unpublish/delete; stale409; missing fields422 | Actual feature-client testsผ่าน; editor/public visualยังไม่ยืนยัน |
| Draft restore | refresh incomplete draft, change account, stale baseline, corrupt storage; failed saveรักษาinput | Pure parser testsผ่าน; browser refresh/account switchingยังไม่ยืนยัน |
| Error/loading/empty | slow/offline/malformed200/401/403/404/422/409, retry, empty lists; stale draftห้ามsilent overwrite | DTO/error tests+sourceผ่าน; interactive UXยังไม่ยืนยัน |
| Responsive | title/actionsไม่ทับ, tableoverflowเฉพาะcontainer, editor/menus/keyboard focusใช้ได้ | CSS sourceตรวจแล้ว; screenshot/computed geometryยังไม่ยืนยัน |

Hosted CI/containerผ่าน [run37858748885](https://github.com/natthawat141/meleran-ux-ui-2026/actions/runs/37858748885) ที่6d36294; ไม่เปลี่ยนสถานะ UI checklist ด้านบนเป็นpassed. เมื่อ browser accessพร้อมต้องกลับมาตรวจรายการนี้ก่อนปิด R13.
