# R7–R10 — Frontend/API mock progress

อัปเดต 9 ตุลาคม 2026 · `refactor/v1-api-ready` · Final 1.6

## ผลชุดย้าย business state

Authoring, Instructor และ Admin management/Blog ที่เหลือย้ายผ่าน app-owned HTTP client และ TanStack Query แล้ว. ถอน `packages/store`, dependencies/aliases, prototype providers และ business localStorage ใน active source. ไม่มี LmsData snapshot endpoint หรือ fallback ไป store เมื่อ API ล้มเหลว. โครงสร้างนี้พร้อมทำ Backend ตาม Draft contract แต่ยังไม่ใช่ Production integration.

| หน้าจอ | แหล่งข้อมูลและการบันทึกปัจจุบัน |
| --- | --- |
| Course overview/settings/create | scoped course list + authoring detail, metadata POST/PATCH, optimistic revision |
| Curriculum/Chapter/Content/Quiz editor | course-resource PATCH; preserve rich documents/options/answer keys, generated IDs, order และ history guards |
| Instructor dashboard/learner list/course roster | summary/roster APIs; counts, progress และ certificate snapshots จาก server |
| Quiz attempts/essay grading | owned attempts/queue + score ต่อ question; server รวมคะแนนและยืนยันผ่าน `>70%`; Admin ตรวจคะแนนไม่ได้ |
| Public Instructor | public allowlist/profile + Published courses; ไม่ส่ง private account fields |
| Admin dashboard/users/instructors/detail/review | summaries, account detail/history, additive role grant, revision-aware approve/return |
| Admin Blog list/editor/preview/public | Blog resource CRUD/publish/unpublish; rich document/category/author/read-time ชุดเดียวกัน, revision-aware writes |

`packages/course-authoring` ใช้ร่วมจริงใน controlled editors และ pure HTTP/form conversion เท่านั้น. HTTP hooks, auth และ business policy อยู่กับแต่ละ app. UI types บางตัวที่ชื่อเดิมยังอยู่ใน contracts เพื่อ presentation; wire DTO ไม่อนุมานจาก types เหล่านั้น.

## Contract ส่งต่อ Backend

ดู [API Contract Draft](API_CONTRACT_R4A_DRAFT_TH.md) ภาคผนวก Screen HTTP Draft และ [Auth/Profile/Catalog Draft](API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md). Canonical wire types อยู่ `packages/contracts/src/management-http.ts`, `blog.ts`, `http-responses.ts`. ครอบคลุม request/response, nullable fields, generated IDs, validation, conflict/history errors และ ownership ของหน้าที่ย้าย.

DTO ยัง **Draft** ตามคำสั่งผู้ใช้. การตกลงกับ Backend ต้องตรวจ OpenAPI, authentication/cookie/CORS/CSRF, transactions, persistence, uploads, delete retention และ provider errors. Adapter resources ใหม่ตรวจ root object/list และ safe error fields แต่ยังไม่มี full runtime schema decoder ทุก field.

## Configuration และการตรวจ

- `npm.cmd run dev:web` / `npm.cmd run dev:admin`: สอง Vite apps ใช้ mock server ร่วมบน 127.0.0.1:8787, cookies/query cache แยก app/account
- `MELEARN_MOCK_PORT` เปลี่ยน port ของ Vite mock startup/proxy; standalone ใช้ `node tools/provisional-api/dev-server.ts <port>`
- `VITE_API_MODE=mock|remote`, `VITE_API_BASE_URL`, `VITE_API_CREDENTIALS` เป็น build-time configuration; default dev=mock, build=remote. ไม่มี API แสดง error ไม่ fallback
- Frontend containers มีเฉพาะ app dist; manifests ไม่อ้าง store. Nginx ยังไม่มี Backend proxy และ API paths คืน 404 ต้องต่อ URL/proxy หลังตกลง Backend

หลักฐานรอบนี้: tests ของ mock business flows, DTO compatibility และ actual feature client → HTTP mock; typecheck/boundaries/build ทั้ง Web/Admin. `npm.cmd test` 154/154 ผ่าน; `npm.cmd run typecheck`, `npm.cmd run check:boundaries`, `npm.cmd run build` และ `git diff --check` ผ่าน. Build ยังเตือน dependency use-client และ chunk size. ลบ 11 test modules ของ store ที่ถอนแล้ว และเพิ่ม tests ของ HTTP resource/client แทน; จำนวน tests เก่า 191 ไม่ใช่ผลรอบนี้.

Browser รอบ migration นี้ **ยังไม่ตรวจสำเร็จ**: in-app browser เปิด local dev แล้วถูก `net::ERR_BLOCKED_BY_CLIENT`. Tests ของ feature clients ใช้ query/hook harness จึงไม่ยืนยัน React lifecycle, layout หรือการคลิกจริง. หลักฐาน browser เก่าเป็นคนละ revision. ไม่ได้ build/run Docker ใหม่ในชุดนี้.

## Acceptance ที่ยังเปิด

- Backend/OpenAPI/database จริงยังไม่มี; mock in-memory restart แล้วข้อมูลหาย ไม่รับประกัน concurrency/transactions จริง
- Google OAuth, verification email delivery, media upload, Stripe/provider webhook และ AI provider จริงยังไม่พร้อม
- Full browser regression ของ rich editors/reorder/draft restore/error/retry และ responsive ยังต้องตรวจ
- Rich image data URLs เป็นความสามารถของ mock/editor; ต้องตกลง safe upload/storage/renderer policy กับ Backend
- Blog unpublish/delete เป็น Draft API สำหรับ affordance เดิม; ต้องตกลง audit/retention ก่อน Production
- ปรับ server filtering/search เมื่อ dataset ใหญ่; บางหน้าโหลด paginated summaries หลายหน้าเพื่อ filter ใน UI
- R10/R13 ยังเปิดสำหรับ real integration/final acceptance; release registry ไม่ถูกเปลี่ยนเป็น released ด้วยผล mock/build
