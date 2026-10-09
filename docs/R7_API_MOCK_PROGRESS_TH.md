# R7–R10 — Frontend/API mock progress

อัปเดต 9 ตุลาคม 2026 · `refactor/v1-api-ready` · Final 1.6

## ปิด Self-audit findings — 9 ต.ค. 2026

แก้ทั้ง 4 findings ของ checkpoint `dd9aaf7` แล้วใน mock/frontend Draft: submit-review บังคับ owner Instructor (Admin 403, Instructor คนอื่น 404; denied calls ไม่เปลี่ยน draft/reviews), ถอน submit-review action ใน Admin editor/preview/API hook; ราคาใช้ canonical `Money` จำนวนเต็มไม่ติดลบ/THB ในทุก projection และ runtime Catalog/Admin Payment; checkout ใช้ generated union รักษา/ตรวจ Enrollment และ course ID ให้ตรงกันทั้งสองสาขา; Blog PATCH/publish/unpublish/delete บังคับ positive integer expected_revision, missing/invalid 422 และ stale 409 โดยข้อมูลเดิมไม่เปลี่ยน. Timestamp compatibility bypass ถอนแล้ว.

เพิ่ม successful **request-body** schema check ใน test helper คู่กับ response check; invalid requests ใน negative tests ยังส่งได้ตามปกติ. เพิ่ม regression tests ของ permission, money, actual checkout decoder, malformed payload และ Blog concurrency. พบ request_id checkout เดิม schema/mock ความยาวต่างกันระหว่างตรวจ requests จึงปรับเป็น 1–64 ตัวอักษรให้ตรงกันทั้งสองฝั่ง. เติม empty-body request examples 5 actions แล้ว; generate types จาก schema ชุดนี้.

Tests **172/172**, typecheck Web/Admin/packages, contracts:check, boundaries และ build Web/Admin ผ่าน (warnings use-client/chunk size เดิม). Browser/mobile/keyboard acceptance และ real Backend/provider integration ยังเปิด; course return-review ยังใช้ current pending state และยังไม่มี explicit client revision precondition; publish ตรวจ approved review ตรง current revision แต่ยังรับ `{}` ตาม Draft. ทั้งสองเรื่องยังต้อง review ก่อน freeze ไม่รวมเป็น Blog bypass ที่ปิดแล้ว.

CI ของ code commit `968e49f2ece83d120e1bcff67aad6bae2e6f0632`: [GitHub run 37869243362](https://github.com/natthawat141/meleran-ux-ui-2026/actions/runs/37869243362) **success** — shared checks, Web/Admin build และ container smoke ทั้งสอง apps ผ่าน. ไม่รัน Docker ในเครื่อง.

## Self-audit — 9 ต.ค. 2026 หลัง checkpoint `2224714`

**ข้อสรุป: Contract Draft foundation ผ่าน แต่ยังปิด Frontend/API readiness ทั้งหมดไม่ได้.** รอบนี้ตรวจ source + adversarial mock/client payloads, rerun contracts:check, tests 166/166 และ typecheck ผ่าน. ยืนยัน hosted CI run 37866894259 ของ code `4f0416b` success; HEAD `2224714` เพิ่มเอกสารเท่านั้น. ไม่รัน build/Docker ซ้ำเมื่อ source ไม่เปลี่ยน; ไม่ได้ตรวจ browser/mobile/keyboard ใหม่. ผล tests ผ่านไม่ปิด findings ด้านล่าง.

| Priority | Finding / หลักฐานทำซ้ำ | งานที่ต้องปิด |
| --- | --- | --- |
| P1 | `POST /courses/{id}/submit-review` ใช้ `canManage`; Admin ส่งคอร์ส Instructor และได้ 201 (`submitted_by: usr_admin`). ขัด Final 1.6 `course.submit_review` ซึ่งเป็น owner Instructor; OpenAPI แสดง owner permission แต่ security ยังมี AdminSession | บังคับ permission ตาม scope ใน mock, ปรับ Admin affordance/contract security และเพิ่ม negative permission test; Backend ต้อง enforce อีกครั้ง |
| P2 | `CoursePatchRequest.price`/create/authoring price ฝัง `{amount_minor: number, currency: string}` แยกจาก `Money`. Payload `{expected_revision:1,price:{amount_minor:0.5,currency:"USD"}}` ผ่าน schema แต่ mock ตอบ 422; mock ต้องจำนวนเต็มไม่ติดลบและ THB | ใช้ canonical money schema และ constraint ของ request ที่ตรงกับ Draft behavior; ตรวจ fractional/negative/currency ทุก price projection |
| P2 | Actual `paymentApi.checkout` เมื่อมี Enrollment แล้ว คืนเพียง `already_enrolled, course_id` ทั้งที่ wire/`AlreadyEnrolledCheckout` ต้องมี `enrollment`. Decoder ยังรับ malformed response ที่ขาด enrollment ได้ | ใช้ generated union ครบ, decode entitlement ทั้งสองสาขา และเพิ่ม actual-client tests สำหรับ already-enrolled/malformed payload |
| P2 | `checkBlogRevision` ตรวจเฉพาะเมื่อมี field. PATCH Blog ที่ไม่มี expected_revision ได้ 200 แต่ OpenAPI BlogPatchRequest กำหนด required; return-review ยังไม่เทียบ revision และ publish รับ body ว่างตาม Draft ปัจจุบัน | เลิก Blog revision compatibility bypass พร้อมอัปเดต callers/tests; ตกลงและทดสอบ stale return/publish strategy ก่อน freeze |

Coverage gap ณ checkpoint ที่ audit: helper ตรวจ **response** ของ mock; ไม่ตรวจ request schema ของทุก successful call. ตัวอย่าง success ของทั้ง 86 operations มีแล้ว แต่ empty-body action 5 รายการยังไม่มี request example: enroll, complete item, create attempt, submit attempt, revoke redeem code. อย่านับจำนวน tests เป็นหลักฐานว่าตรวจทุก field/negative case ครบ.

รายการเหล่านี้เป็นประวัติ findings ก่อนแก้; ปัจจุบันปิดทั้ง 4 ตามหัวข้อด้านบนแล้ว. Known pending: Google/Stripe real-provider operations 5 รายการ, production session/CORS/CSRF/TTL และ durable integration; UI/mobile/keyboard/loading/error/draft acceptance ยังเปิด. เริ่ม Backend จาก Draft ทีละ flow ได้ แต่ยังไม่ใช้คำว่า frozen/Production-ready.

## ผลชุด Contract Draft ก่อนแก้ findings — 9 ต.ค. 2026

OpenAPI 86 app operations + 5 provider-deferred, generated HTTP types, schema/mock/examples checks และ CI drift gate เพิ่มแล้ว. Tests 166/166, typecheck ทั้งสอง apps/packages และ boundaries/build Web/Admin ผ่าน (มี warnings เดิม); Login/session/logout Web/Admin แยกตามที่ผู้ใช้ยืนยัน. รักษา full enrollment projection ใน Learning/Payment/Admin และแก้ nullable article resume. Backend review/freeze, provider protocols และ browser acceptance ยังเปิด; permission/revision gaps อยู่ใน [R4a Draft](API_CONTRACT_R4A_DRAFT_TH.md). ตัวเลข tests 159 ด้านล่างเป็นผลชุด migration ก่อนหน้านี้.

หลักฐาน CI ของ code commit `4f0416bc56460d07bdb7477d5763abbbec175ba5`: [GitHub run 37866894259](https://github.com/natthawat141/meleran-ux-ui-2026/actions/runs/37866894259) **success** — changes/shared-checks, Web/Admin typecheck/build, container smoke ของทั้งสอง apps และ final validate ผ่าน. รัน containers บน GitHub runner; ไม่รัน Docker ในเครื่อง. ไม่ยืนยัน Backend/provider integration หรือ browser acceptance.

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

ดู [API Contract Draft](API_CONTRACT_R4A_DRAFT_TH.md) ภาคผนวก Screen HTTP Draft และ [Auth/Profile/Catalog Draft](API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md). Canonical HTTP schema อยู่ [OpenAPI Draft](../packages/contracts/openapi/openapi.json); `@melearn/contracts/http` generate จาก schema, DTO exports เดิมเป็น aliases. ครอบคลุม request/response, nullable fields, generated IDs, validation, conflict/history errors และ ownership ของหน้าที่ย้าย.

DTO ยัง **Draft** ตามคำสั่งผู้ใช้. การตกลงกับ Backend ต้องตรวจ OpenAPI, authentication/cookie/CORS/CSRF, transactions, persistence, uploads, delete retention และ provider errors. Management/Authoring/Blog resources ใช้ canonical runtime decoders ตรวจ nested fields, enum/nullability, IDs, finite numbers, timestamps, rich JSON และ pagination ตาม operation; unknown operation ปฏิเสธ. ยังต้องเทียบ real Backend/OpenAPI ก่อน freeze.

## Configuration และการตรวจ

- `npm.cmd run dev:web` / `npm.cmd run dev:admin`: สอง Vite apps ใช้ mock server ร่วมบน 127.0.0.1:8787, cookies/query cache แยก app/account
- `MELEARN_MOCK_PORT` เปลี่ยน port ของ Vite mock startup/proxy; standalone ใช้ `node tools/provisional-api/dev-server.ts <port>`
- `VITE_API_MODE=mock|remote`, `VITE_API_BASE_URL`, `VITE_API_CREDENTIALS` เป็น build-time configuration; default dev=mock, build=remote. ไม่มี API แสดง error ไม่ fallback
- Frontend containers มีเฉพาะ app dist; manifests ไม่อ้าง store. Nginx ยังไม่มี Backend proxy และ API paths คืน 404 ต้องต่อ URL/proxy หลังตกลง Backend

หลักฐานรอบนี้: tests ของ mock business flows, DTO compatibility และ actual feature client → HTTP mock; typecheck/boundaries/build ทั้ง Web/Admin. `npm.cmd test` 159/159 ผ่าน; `npm.cmd run typecheck`, `npm.cmd run check:boundaries`, `npm.cmd run build` และ `git diff --check` ผ่าน. Build ยังเตือน dependency use-client และ chunk size. ลบ 11 test modules ของ store ที่ถอนแล้ว และเพิ่ม tests ของ HTTP resource/client แทน; จำนวน tests เก่า 191 ไม่ใช่ผลรอบนี้.

Browser รอบ migration นี้ **ยังไม่ตรวจสำเร็จ**: in-app browser เปิด local dev แล้วถูก `net::ERR_BLOCKED_BY_CLIENT`. Tests ของ feature clients ใช้ query/hook harness จึงไม่ยืนยัน React lifecycle, layout หรือการคลิกจริง. หลักฐาน browser เก่าเป็นคนละ revision. รอบ audit ส่ง Docker build/runtime smoke ไป GitHub CI เพื่อเลี่ยง RAM ในเครื่อง; ไม่เปิด local Docker.

## Acceptance ที่ยังเปิด

- Backend/OpenAPI/database จริงยังไม่มี; mock in-memory restart แล้วข้อมูลหาย ไม่รับประกัน concurrency/transactions จริง
- Google OAuth, verification email delivery, media upload, Stripe/provider webhook และ AI provider จริงยังไม่พร้อม
- Full browser regression ของ rich editors/reorder/error/retry/responsive ยังต้องตรวจ; draft restoration มี pure tests สำหรับ incomplete/stale/corrupt/malformed data แต่ไม่แทนการพิมพ์/refresh ใน UI
- Rich image data URLs เป็นความสามารถของ mock/editor; ต้องตกลง safe upload/storage/renderer policy กับ Backend
- Blog unpublish/delete เป็น Draft API สำหรับ affordance เดิม; ต้องตกลง audit/retention ก่อน Production
- ปรับ server filtering/search เมื่อ dataset ใหญ่; บางหน้าโหลด paginated summaries หลายหน้าเพื่อ filter ใน UI
- R10/R13 ยังเปิดสำหรับ real integration/final acceptance; release registry ไม่ถูกเปลี่ยนเป็น released ด้วยผล mock/build


## รอบ Frontend audit — 9 ต.ค. 2026

| รายการ | หลักฐาน / สถานะ |
| --- | --- |
| UI flows/mobile/keyboard จริง | **Blocked**: browser tool ปฏิเสธ local preview ด้วย URL security policy และห้ามใช้ workaround; ไม่เปิด alternate browser หรือ headless driverเพื่อเลี่ยง policy |
| Reorder/keyboard/responsive source | Curriculum/Chapter มีเมนูเลื่อนขึ้น–ลง, named action buttons และ responsive CSS; source proof ไม่ยืนยัน computed layout/keyboard focus จริง |
| Loading/error/empty source | ResourceBoundary ใช้ Suspense, status loading, retry และ reset ต่อ route/account; pagesมี Empty/form errors. Current browserยังไม่ผ่าน |
| Quiz draft | Pure parser validate draft shape/duplicate IDs/baseline; restore incomplete work ได้; reject corrupt/stale data; sessionStorage keys แยกบัญชี |
| DTO validation | typed HTTP mock responses รวม roster/owner grading/Admin account/authoring/transcript ผ่าน runtime checks; malformed fields/unknown operations คืน invalid_payload ก่อน UI |
| Local code gates | tests159, typecheck Web/Admin/packages, boundaries/diff checks และ build Web/Admin ผ่าน; dependency/chunk warnings ยังคงมี |
| CI finding/fix | Run37826483729 ที่9fe52cb ล้มเพราะ missing typecheck:legacy; เปลี่ยนเป็น packages, เพิ่ม tools path filter และ container job |
| Hosted Docker | **ผ่าน hosted run37858748885 ที่6d36294**: Web/Admin build + non-root/health/assets/deep links/cache/404 ที่8080/8181; validate jobสำเร็จ. ไม่ใช้ Docker/RAMในเครื่อง |

ไม่มี real Backend/OpenAPI/provider ใหม่, deployment หรือ merge main. ผล browserเก่าไม่ถือว่า current acceptance ผ่าน. ตาราง R และ container guide อัปเดตตรงกับ store sunset/current workflow แล้ว.


CI evidence: [run37858748885](https://github.com/natthawat141/meleran-ux-ui-2026/actions/runs/37858748885), source `6d36294c788ff4ef1e6a2b67e7bf3750be163df4`: changes/shared-checks/web/admin/containers(web)/containers(admin)/validate สำเร็จทั้งหมด. Dockerยืนยัน static runtime เท่านั้น; feature readiness ยังprototype, API pathsไม่มี Backend/proxy. Follow-up docs commit ไม่เปลี่ยน app/runtime code; ไม่ถือว่า current browser/real API acceptanceผ่าน.
