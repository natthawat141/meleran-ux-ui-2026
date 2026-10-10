# แผน Backend Melearn Tutor V1 และเกณฑ์ตรวจรับ

อัปเดต 10 ตุลาคม 2026 · ตรวจ Backend commit `fdeb170` · ลำดับงานเป็นข้อเสนอ; กติกาธุรกิจอ้างสิ่งที่ผู้ใช้ยืนยันแล้ว

## 1. เป้าหมายและเอกสารหลัก

ทำ Backend ให้ Web/Admin ใช้งานจริงครบ Final 1.6: บัญชี → สร้าง/อนุมัติคอร์ส → Enroll/Stripe/Redeem → เรียน/ตรวจคะแนน → ใบรับรอง พร้อม Blog และ AI ในรอบแรก. ไม่ใช้ mock/localStorage เป็น source of truth ของระบบจริง.

- [Business logic Final 1.6](MELEARN_V1_SCOPE.md): บท 2–6 กติกา/permissions/data/flow; บท 7 scope หนึ่งเดือน; บท 9 เกณฑ์ตรวจรับ.
- [Canonical OpenAPI](api-contract/openapi.json) รุ่น `1.0.0-draft.1`: request/response/required/null/enum/errors/method/path; ยังไม่ freeze.
- [14 กลุ่มฟีเจอร์และ JSON handbook](api-contract/API_CONTRACT_FEATURES_TH.md): generated จาก canonical ไม่ใช่ contract อีกชุด.
- [Decision register](api-contract/API_CONTRACT_R4A_DRAFT_TH.md), [Auth/Catalog details](api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md): แยกยืนยัน/ข้อเสนอ/รอตัดสิน.
- [Backend architecture](../melearn-tutor-api/docs/BACKEND_ARCHITECTURE.md), [สถานะ implementation](../melearn-tutor-api/docs/FEATURE_DELIVERY_STATUS_TH.md), [ผล audit](../melearn-tutor-api/docs/DECISION_AUDIT_TH.md).

คำยืนยันล่าสุดมาก่อนเอกสารเก่า. ถ้า JSON Draft ขัด business logic ต้องระบุและแก้ร่วมกัน ไม่เพิ่มกฎเพื่อให้ตรงข้อจำกัดของโค้ด. ค่าทางเทคนิคใน mock/tests ไม่ถือว่าได้รับอนุมัติเอง.

ยืนยันแล้ว: ASP.NET Core .NET 10, React Web/Admin, PostgreSQL 16 Bangkok; Cloud SQL `melearn-infra-prod`/`melearn-tutor-db`, Cloud Run `melearn-tutor`; Firebase Email/Google + .NET Username; Web/Admin login/session แยก; R2 สำหรับภาพ; OpenRouter model/key ผ่าน ENV; Resend/Stripe ตาม scope. รายละเอียด infra และข้อจำกัดอยู่ใน [Cloud SQL setup](../melearn-tutor-api/docs/CLOUD_SQL_SETUP_TH.md); แผนนี้ไม่เลือก tier ใหญ่ขึ้น/ราคา/ค่า scaling ใหม่แทนผู้ใช้.

## 2. ตอนนี้ทำอะไรแล้ว

### 2.1 สิ่งที่มีหลักฐานจากโค้ดและ tests

- Api/Application/Domain/Infrastructure พร้อม dependency tests; EF Core/Npgsql adapter, migrations, SQL สำหรับ review และ local Admin bootstrap command.
- Local Username login/logout, Web/Admin isolation, GET/PATCH profile, server role/eligibility checks; auth_methods อ่าน credentials/identities ที่ผูกจริง.
- Admin สร้าง Learner ไม่มีอีเมล, ดู/ค้นหารายการและรายละเอียดผู้ใช้, รายชื่อ Instructor, เพิ่ม Instructor แบบรักษา Learner/ไม่เพิ่มซ้ำ/เก็บผู้ทำและเวลา.
- Catalog list/detail เฉพาะ Published, Free Enroll และ own enrollments. Progress ที่คืนเป็นข้อมูลเริ่มต้น ยังไม่มี use case บันทึกการเรียน/คะแนน.
- ผลล่าสุด: locked restore และ Release build/test ผ่าน **52 tests (architecture 6 + HTTP integration 46)**. ใช้ SQLite relational test host ไม่ใช่ live PostgreSQL/Firebase/browser acceptance. แผนนี้ไม่ได้ rerun tests เพราะไม่ได้แก้ implementation.
- Admin management มี response schema checks จาก canonical subset snapshot; script ตรวจว่า snapshot ตรงกับ canonical. ยังไม่ครอบคลุม runtime schemas ทั้ง 86 operations.
- Migration generation, idempotent SQL generation และ model/migration drift check ผ่าน; ยังไม่ apply Cloud SQL.
- OpenRouter model fallback ถอนแล้วและมี guard test; ENV placeholders ยังไม่ใช่ provider integration.

หลักฐาน: [Account Controllers](../melearn-tutor-api/src/Melearn.Api/Features/Accounts/AccountManagementController.cs), [Catalog/Enrollment](../melearn-tutor-api/src/Melearn.Api/Features/Courses/CatalogController.cs), [HTTP tests](../melearn-tutor-api/tests/Melearn.IntegrationTests/AccountManagementTests.cs), [migration model](../melearn-tutor-api/src/Melearn.Infrastructure/Persistence/Migrations/MelearnDbContextModelSnapshot.cs).

### 2.2 ปริมาณงานและสถานะตามฟีเจอร์

นับคู่ method + path: **86 defined operations; มี handler 13; ยังไม่มี handler 73**. อีก **5 provider operations** deferred (Google protocol เดิม 4 + Stripe webhook 1). 13/86 ≈15% เป็น coverage ของรายการ endpoint เท่านั้น ไม่ใช่เปอร์เซ็นต์งานเสร็จ/ความพร้อม Production. Auth inventory อาจเปลี่ยนเมื่อ freeze Firebase protocol ไม่ต้องทำ OAuth routes เดิมทั้ง 4 ถ้าถูกแทนด้วย Firebase flow.

| กลุ่มฟีเจอร์ | Defined | มี handler | ส่วนที่มี / ส่วนที่ยังขาด |
| --- | ---: | ---: | --- |
| Auth | 7 | 2 | Login เฉพาะ Username + logout; Email/Google/register/verify/resend/reset ยังไม่ครบ |
| Profile | 2 | 2 | GET/PATCH; ยังต้อง sync validation, ตรวจจริง และทำภาพอัปโหลด |
| Catalog/หน้าผู้สอน | 4 | 2 | Course list/detail; public Instructor profile/courses ยังไม่มี |
| Enrollment | 2 | 2 | Free Enroll/own list; live persistence/concurrency/UI ยังไม่ผ่าน |
| Learning/Progress/Resume | 5 | 0 | ยังไม่มี flow เรียนจริง |
| Assessment/Grading | 7 | 0 | ยังไม่มี attempt/snapshot/submit/score/grading |
| Certificate | 3 | 0 | ยังไม่มี issue/read/download |
| Authoring | 9 | 0 | ยังไม่มี course/chapter/item/quiz editing/preview |
| Approval/Publish | 5 | 0 | ยังไม่มี review/revision/lifecycle |
| Stripe Payment | 3 | 0 | Checkout/status ยังไม่มี; webhook deferred อีก 1 |
| Redeem | 4 | 0 | Issue/list/revoke/redeem ยังไม่มี |
| AI | 11 | 0 | Transcript/support/chat/history/quota/practice ยังไม่มี |
| Blog | 9 | 0 | Public/editor/publish/revision ยังไม่มี |
| Management | 15 | 5 | User create/list/detail + Instructor list/assign; learner/results/summary ยังไม่มี |
| **รวม** | **86** | **13** | **73 defined operations ยังไม่มี handler** |

13 operations บางส่วนยังไม่ครบ contract: POST /auth/login ยังไม่รับ Email/Firebase flow; POST /admin/users ยังปฏิเสธ email; validation/session findings ใน audit ยังไม่ปิด. จำนวน handler ไม่ถือเป็นจำนวน flow ที่ตรวจรับครบ.

### 2.3 สิ่งที่ยังไม่ตรวจรับ

ยังไม่มี flow ที่ผ่าน Frontend → real API → live PostgreSQL/provider ครบ. Frontend ยังใช้ HTTP mock. Cloud SQL instance เคยตรวจว่าสร้างแล้ว แต่ยังไม่ผ่าน application DB/user/grants/connection/schema; ไม่ได้ตรวจ cloud state สดซ้ำในการวางแผนนี้.

Firebase verifier/exchange/linking, Resend, Stripe, OpenRouter และ R2 upload ยังไม่ implement. /health/ready ยังเป็น gate 503 แบบคงที่ ไม่ใช่ dependency probe. มี GitHub workflow แต่ API/docs ยังไม่มี remote/hosted CI run; ยังไม่มี Cloud Run deploy.

## 3. นิยามว่า “เสร็จ”

ใช้สถานะแยกต่อ flow ไม่รวมเป็นคำว่าเสร็จช่องเดียว:

| สถานะ | หลักฐานขั้นต่ำ |
| --- | --- |
| โค้ดทำแล้ว | Handler/use case/persistence ตรง business/contract ไม่มี mock fallback |
| Tests ผ่าน | Schema/errors/permissions และกรณีธุรกิจผ่าน ไม่ใช่ assertions ตามกฎที่ agent เติมเอง |
| PostgreSQL/provider ผ่าน | Migration/constraints/transactions/persistence ผ่านฐานจริง; provider flow ผ่าน integration/sandbox ตามงาน |
| Frontend ผ่าน | หน้าที่เกี่ยวข้องใช้ real API; loading/empty/error/conflict/reload/เปลี่ยนอุปกรณ์ผ่าน |
| ตรวจรับ flow แล้ว | ผ่านรหัสตรวจรับใน Final 1.6 บท 9 พร้อม code revision/ข้อมูลที่บันทึก/ผล UI+server |
| พร้อม deploy/ส่งมอบ | CI/runtime/secrets/migration/health/rollback ผ่านตาม environment; deploy จริงอยู่ใน authorization ผู้ใช้ |

เกณฑ์ร่วมทุก flow: JSON/type/enum/null/required/validation/errors ตรง canonical; permission และ resource ownership ตรวจ server; คำขอซ้ำ/ข้อมูลชนกัน/rollback ไม่ทิ้งข้อมูลผิด; ข้อมูลอยู่หลัง restart/relogin; ไม่มี password/token/provider secrets/raw transcript/answer keys รั่วสู่ response ที่ไม่มีสิทธิ์. แยกผล provider test double จากบริการจริง.

Final 1.6 มี **113 กรณีตรวจรับ**: A20, C12, V3, E13, P12, Q12, F8, B4, AI29. **52 tests ไม่ได้หมายความว่าผ่าน 52/113 กรณีตรวจรับแล้ว**. ใช้รหัสใน scope เป็นรายการกลาง ไม่ทำสำเนากติกาอีกชุด.

## 4. ลำดับงานที่เสนอ

B คือ Backend แยกจาก R ของ Frontend เดิม. ลำดับนี้ไม่เพิ่ม scope. งานอ่าน/CRUD ที่กติกาชัดทำต่อได้ ไม่ต้องรอ policy ของ provider ที่ไม่เกี่ยวข้อง.

| ชุด | งานและสิ่งส่งมอบ | เกณฑ์ตรวจรับหลัก | ขนาดโดยเปรียบเทียบ / สถานะ |
| --- | --- | --- | --- |
| B0 ปิดความต่าง contract | Diff request/response/validation ของ 13 handlers; แก้ admin email partial; sync schema/mock/UI เมื่อมีการตกลงเปลี่ยน; ปิด session/password/protocol ส่วนที่เกี่ยวข้อง | ไม่มี drift ที่ไม่ระบุ; ไม่มี policy ที่เดาเองถูกเรียกว่า confirmed; schema/error tests ครอบคลุม subset | M; findings ยังเปิด |
| B1 ฐานข้อมูลจริง | Application DB/runtime & migration users/grants, migrations, provision Admin, PostgreSQL integration tests และ runtime readiness | ข้อมูลอ่านกลับหลัง restart; unique/concurrency/transaction rollback ถูกต้อง; runtime ไม่ใช้ postgres admin; migration/recovery มีหลักฐาน | M; adapters มีแล้ว แต่ live gate ไม่ผ่าน |
| B2 บัญชีและสิทธิ์ครบ | Firebase verifier/exchange, Email/Google mapping/link, verified email/reset/Resend, Username/Profile/Admin accounts ครบ; real Auth ของ Web/Admin | A01–A04, A07–A20; link User เดิม; invalid/expired/wrong-project proof ไม่ให้สิทธิ์; logout แยก; link ใช้ครั้งเดียว/หมดอายุตาม scope | L; local subset มีแล้ว/provider ยังไม่มี |
| B3 คอร์ส/Approval/Catalog | 9 Authoring + 5 Approval + 4 Catalog operations; definitions/revisions/ownership/YouTube และ public Instructor | C01–C12, V01–V03, A05; Approved แก้ก่อน publish → Draft; stale approval ไม่สำเร็จ; Published แก้ทันที; public ไม่เปิดเฉลย/เนื้อหาจำกัดสิทธิ์; video upload ไม่เก็บไฟล์ | L; Catalog มีแล้ว 2 |
| B4 สิทธิ์เรียน/Stripe/Redeem | 2 Enrollment + 4 Redeem + 3 Payment และ verified webhook; grant กลไกเดียวพร้อม price/source/event snapshots | E01–E13, P01–P12; redeem/revoke race สำเร็จทางเดียว; failure rollback; success page/GET ไม่ให้สิทธิ์; signed/replayed/late event และ fulfillment recovery ถูกต้อง | L; Free Enroll subset มีแล้ว |
| B5 เรียน/Progress/Assessment | 5 Learning + 7 Assessment; access/resume/complete, immutable attempt snapshot, submit/server score และ owner Instructor grading | Q01–Q12, A06; 70% ไม่ผ่าน >70% ผ่านเมื่อส่งและตรวจครบ; highest completed score; ปฏิเสธคะแนนปลอม/ตรวจคอร์สอื่น; Admin ไม่เป็นผู้ให้คะแนนแทน Instructor | L; ยังไม่เริ่ม |
| B6 ใบรับรอง | 3 operations; completion snapshot + exactly-once issue/read/download/recovery | F01–F08; จบครบออกอัตโนมัติ; เพิ่มเนื้อหาหลังจบไม่ลบผล/ใบเดิม; download ข้ามบัญชีไม่ได้; file failure retry จากผลเดิม | M; ยังไม่เริ่ม |
| B7 Blog | 9 operations; Admin editor/preview/publish/revision, public published projections และ mutations ตาม contract | B01–B04; Guest ไม่เห็น Draft; Learner/Instructor เขียนไม่ได้; stale revision ไม่ทับข้อมูล; ไม่สร้าง Progress/คะแนน/ใบรับรอง | M; เริ่มด้วย local Admin ได้ |
| B8 AI/Transcript/Practice | 11 operations; Admin-only settings/transcript, scoped Knowledge, own history/search/rename/delete, DB messages/request tracking, Bangkok quota, OpenRouter และ practice snapshot | AI01–AI29; 20 สำเร็จ/บัญชี/วันไทยทุก role; replay/concurrency ไม่ซ้ำ/เกิน; failure ไม่คิด quota; ไม่มี raw transcript รั่ว; practice ไม่เปลี่ยนผลเรียน | L; ยังไม่เริ่ม; model มาจาก ENV |
| B9 Management ที่เหลือ | อีก 10 จาก 15 operations; learner/course roster/results/attempt views และ summaries จากฐานจริง | A05/A06 + §3; Instructor เฉพาะ owned course; Admin ตาม contract; list/detail/aggregate ใช้ scope เดียวกัน; counters ไม่ใช้ mock | M; อาศัย B3–B6 |
| B10 ตรวจรวม/ส่งมอบ | Real API ทุก flow, media contract/R2, hosted CI/build/container checks, integration/E2E และ runbook | §9.7; 113 cases มีหลักฐาน; V1 gaps เป็นศูนย์; provider/sandbox ผ่าน; ไม่มี mock fallback; migration/health/rollback/Cloud Run access ตรวจตาม authorization | L; ยังไม่ตรวจรับรวม |

M/L คือขนาดและความซับซ้อนโดยเปรียบเทียบ ไม่ใช่เวลารับประกัน. งาน L มีหลายโมเดล/สถานะ/concurrency/provider. เป้าหมายหนึ่งเดือนมาจาก scope; ยังรับรองเวลาจบไม่ได้ก่อนผ่าน B0/B1 และ protocol/provider ที่ค้าง.

### งานที่เริ่มเร็วและ dependency

- เริ่ม B0/B1 กับ public Instructor projections ที่ JSON ชัด. Local Admin ใช้ทำ Blog/Authoring ต่อได้ ไม่จำเป็นต้องรอ Firebase ทุก endpoint.
- B3 มาก่อนตรวจ course lifecycle/learning เต็ม flow. Seed ใช้ระหว่างพัฒนาได้ แต่ไม่แทน acceptance ของการสร้าง/อนุมัติจริง.
- B4 ทำ Free Enroll/Redeem ระหว่างเตรียม Stripe ได้. **Redeem และ AI Course Support ต้องพร้อมส่งมอบร่วมกัน** ตาม §2.9; แยก implementation ได้ แต่ไม่ตัด AI ออกจาก V1.
- B5 → B6; B9 อ่านผลจากโมเดลจริง. B7 แยกจากการเรียน; B8 history/Transcript CRUD เริ่มก่อนเรียก model ได้ แต่ยังไม่ตรวจรับ AI จริง.
- ต่อ Frontend และตรวจแต่ละ flow เมื่อพร้อม ไม่รอครบ 86 operations. Switch เป็น real API ต่อ feature; ไม่ fallback mock หลัง API fail.
- ทำคนเดียว; แบ่งชุดเล็ก 2–5 operations ตาม use case. รัน targeted tests ระหว่างแก้ แล้ว full suite/contract check ก่อน commit ชุดนั้น ไม่ build/test ทุก app ซ้ำทุกไฟล์. ไม่รัน Docker local โดยอัตโนมัติ.

## 5. จุดที่ยังต้องปิด/ข้อมูลที่ขาด

| ประเด็น | สิ่งที่ทราบ / สิ่งที่ยังต้องปิด | เกี่ยวข้อง |
| --- | --- | --- |
| Firebase/contract Auth | Provider ยืนยันแล้ว แต่ exchange/link ใน AUTH_DECISION_TH.md ยังเป็นข้อเสนอ; canonical/mock ต้อง migrate พร้อม SDK/tests ไม่ implement Google mock protocol ตรง ๆ | B0/B2 |
| Resend/verification/reset | Scope ระบุ Resend/link 24h ใช้ครั้งเดียว; Firebase ยืนยันภายหลัง. ต้องกำหนด action-link ownership/verification/reset สำหรับ Firebase/local ให้รักษากติกา ไม่เปลี่ยน TTL/ช่องทางเงียบ ๆ | B2 |
| Session/password | Web/Admin แยกยืนยันแล้ว; transport/domains/TTL/CSRF/CORS/rate/recovery ยังไม่ freeze. Strict/12h/12-char ปัจจุบันไม่ใช่ข้อยุติ; Draft limits กับ canonical ยังไม่ตรง | B0/B2 |
| DB access | Application DB/user/grants/connection/schema และ PostgreSQL acceptance ยังไม่ผ่าน; ไม่แสดง credentials ไม่เพิ่ม instance ใหญ่แทนโดยเดา | B1 |
| IDs/revisions | UI มอง ID เป็น opaque string; backend subset ใช้ Guid. ต้องกำหนด mapping/URL migration ถ้ารักษาข้อมูลเดิม; return/publish concurrency ต้องตรง contract ที่ตกลง | B0/B3 |
| Media/R2 | Profile upload ยังไม่มี operation/schema ใน 86. ต้องกำหนด request/result/ownership/type/size/error/lifecycle สำหรับ profile/cover/Blog/answer images; ไม่เหมารวมกับ video upload ที่ปิด | B2/B3/B5/B7/B10 |
| Certificate file | Mock download ไม่ใช่ PDF จริง. ต้องกำหนด content type/filename/storage/retry โดยไม่ใช้ mock text แทนใบรับรอง | B6 |
| Provider config | ต้องมี config/credentials/test account/sender และ webhook/protocol จริง. ENV ไม่เท่ากับพร้อม. Stripe Test ก่อน Live; ไม่เลือก OpenRouter model ให้เอง | B2/B4/B8 |
| CI/deploy | API/docs ไม่มี remote/hosted run. IAM/secrets/domains/network/pool budget/recovery ยังไม่ตรวจ. แผนไม่อนุญาต deploy/Stripe Live/เปลี่ยน infra เพิ่มเอง | B10 |

ประเด็นเหล่านี้บล็อกเฉพาะส่วนที่ใช้ ไม่หยุด read/CRUD ที่ business/JSON ชัดทั้งหมด. ไม่ถามซ้ำเรื่อง provider/project/region/role ที่ยืนยันแล้ว.

## 6. หลักฐานตรวจรับที่ต้องเก็บ

บันทึกต่อ flow ในเอกสารสถานะเดิม: code SHA + contract version/hash; operations ผ่าน/partial; รหัส A/C/V/E/P/Q/F/B/AI; command/environment/results; data อ่านกลับ; UI/browser evidence และ gaps. ไม่สร้าง status document ใหม่ทุกชุด.

1. Contract: fields/type/null/enum/validation/status/errors ตรง source; schema/examples/frontend generated types ไม่ drift. ไม่แก้สเปกเพื่อปิด test failure.
2. Permission: anonymous/unverified/wrong role/app/owner/course ทั้ง direct API และ UI; Admin ไม่ได้ยกเว้นทุกคำสั่ง.
3. Persistence: PostgreSQL จริง; simultaneous requests/uniqueness/rollback ตาม code/payment/AI cases; ไม่ทิ้ง Used code ที่ไม่มี Enrollment หรือใบรับรองซ้ำ; restart แล้วข้อมูลอยู่.
4. Providers: valid/invalid/expired proof/failure/timeout/retry; Stripe raw-body signature; mail และใช้ link จริง; R2 images/private files; AI model ตาม ENV และบันทึกผลก่อนคิด quota.
5. Frontend: Guest/Learner/Instructor/Admin, mobile/keyboard/loading/empty/error/conflict/reload/เปลี่ยนอุปกรณ์; URL migration หากเปลี่ยน; ไม่ redesign UI.
6. Delivery: hosted CI/build ของ commit ที่ส่งมอบ; migration/recovery/health/secrets/service identity/smoke/rollback เมื่อ authorized. Build/HTTP200/ภาพหน้าจออย่างเดียวไม่ปิด acceptance.

**เกณฑ์จบ Backend V1:** ทุก feature ใน scope ผ่าน business+contract+persistence/provider+Frontend flow; 113 cases มีหลักฐาน; V1 blockers เป็นศูนย์. Deferred protocols ต้อง resolve ไม่ใช่ optional เพราะยังไม่อยู่ใน defined OpenAPI. ไม่มี default model หรือ business restrictions ที่ agent เดาเอง.

## 7. สิ่งที่ไม่เพิ่ม

ตาม scope บท 8: ไม่เพิ่ม cart/orders/Finance เต็ม, payout/revenue sharing, subscription/coupon, Instructor application approval, multi-instructor, course Archive/ปิดขาย, LINE/Phone/OTP login, video upload/Mux/Bunny, automatic transcript, AI Knowledge Dashboard, Admin อ่านแชตผู้อื่น/Big Data, standalone assignments หรือ automatic refund. ไม่มีระบบ refund ไม่ใช่นโยบายไม่คืนเงิน.

Enum archived/provider mock ใน Draft ไม่ทำให้เป็น scope. Video upload endpoint ต้องตอบยังไม่พร้อมโดยไม่เก็บไฟล์ตาม V02; ต่างจาก R2 image upload ที่ต้องทำ.

## 8. Inventory method/path ณ commit ที่ตรวจ

ตารางอ้าง canonical โดยตรง. “มี handler” ไม่ใช่ตรวจรับครบ; “partial” คือส่วนสำคัญยังไม่ครบ. ไม่รวม health และ image upload ที่ยังไม่มี schema ใน 86.

<!-- BACKEND_OPERATION_INVENTORY -->


| Method | Path (ใต้ /api/v1) | กลุ่ม | ชุดงาน | สถานะ handler |
| --- | --- | --- | --- | --- |
| POST | /auth/register | auth | B2 | ยังไม่มี handler |
| POST | /auth/verify-email | auth | B2 | ยังไม่มี handler |
| POST | /auth/resend-verification-email | auth | B2 | ยังไม่มี handler |
| POST | /auth/login | auth | B2 | partial |
| POST | /auth/password-reset/request | auth | B2 | ยังไม่มี handler |
| POST | /auth/password-reset/confirm | auth | B2 | ยังไม่มี handler |
| POST | /auth/logout | auth | B2 | มี handler; ยังไม่ตรวจรับจริง |
| GET | /me | account | B2 | มี handler; ยังไม่ตรวจรับจริง |
| PATCH | /me | account | B2 | มี handler; ยังไม่ตรวจรับจริง |
| GET | /admin/users | management | B2 | มี handler; ยังไม่ตรวจรับจริง |
| POST | /admin/users | management | B2 | partial |
| POST | /admin/users/{id}/instructor | management | B2 | มี handler; ยังไม่ตรวจรับจริง |
| GET | /admin/instructors | management | B2 | มี handler; ยังไม่ตรวจรับจริง |
| GET | /courses | catalog | B3 | มี handler; ยังไม่ตรวจรับจริง |
| GET | /courses/{id} | catalog | B3 | มี handler; ยังไม่ตรวจรับจริง |
| PATCH | /courses/{id} | authoring | B3 | ยังไม่มี handler |
| POST | /courses/{id}/enroll | enrollment | B4 | มี handler; ยังไม่ตรวจรับจริง |
| GET | /me/enrollments | enrollment | B4 | มี handler; ยังไม่ตรวจรับจริง |
| GET | /learn/courses/{id} | learning | B5 | ยังไม่มี handler |
| GET | /learn/courses/{id}/items/{item_id} | learning | B5 | ยังไม่มี handler |
| GET | /me/progress | learning | B5 | ยังไม่มี handler |
| POST | /learn/items/{id}/complete | learning | B5 | ยังไม่มี handler |
| PUT | /learn/items/{id}/resume | learning | B5 | ยังไม่มี handler |
| POST | /learn/items/{id}/attempts | assessment | B5 | ยังไม่มี handler |
| PUT | /learn/attempts/{id}/answers | assessment | B5 | ยังไม่มี handler |
| POST | /learn/attempts/{id}/submit | assessment | B5 | ยังไม่มี handler |
| GET | /learn/attempts/{id} | assessment | B5 | ยังไม่มี handler |
| GET | /learn/items/{id}/results | assessment | B5 | ยังไม่มี handler |
| GET | /instructor/grading-queue | assessment | B5 | ยังไม่มี handler |
| PUT | /instructor/attempts/{id}/questions/{question_id}/grade | assessment | B5 | ยังไม่มี handler |
| GET | /me/certificates | certificate | B6 | ยังไม่มี handler |
| GET | /me/certificates/{id} | certificate | B6 | ยังไม่มี handler |
| GET | /me/certificates/{id}/download | certificate | B6 | ยังไม่มี handler |
| GET | /instructor/courses | authoring | B3 | ยังไม่มี handler |
| POST | /instructor/courses | authoring | B3 | ยังไม่มี handler |
| GET | /admin/courses | authoring | B3 | ยังไม่มี handler |
| POST | /admin/courses | authoring | B3 | ยังไม่มี handler |
| GET | /courses/{id}/authoring | authoring | B3 | ยังไม่มี handler |
| POST | /courses/{id}/videos/uploads | authoring | B3 | ยังไม่มี handler |
| GET | /courses/{id}/authoring-preview | authoring | B3 | ยังไม่มี handler |
| POST | /courses/{id}/submit-review | authoring | B3 | ยังไม่มี handler |
| GET | /admin/course-reviews | approval | B3 | ยังไม่มี handler |
| GET | /admin/course-reviews/{id} | approval | B3 | ยังไม่มี handler |
| POST | /admin/course-reviews/{id}/approve | approval | B3 | ยังไม่มี handler |
| POST | /admin/course-reviews/{id}/return | approval | B3 | ยังไม่มี handler |
| POST | /courses/{id}/publish | approval | B3 | ยังไม่มี handler |
| POST | /me/payments/checkout | payment | B4 | ยังไม่มี handler |
| GET | /me/payments/{id} | payment | B4 | ยังไม่มี handler |
| GET | /admin/payments/{id} | payment | B4 | ยังไม่มี handler |
| POST | /me/redeem | redeem | B4 | ยังไม่มี handler |
| GET | /admin/redeem-codes | redeem | B4 | ยังไม่มี handler |
| POST | /admin/redeem-codes | redeem | B4 | ยังไม่มี handler |
| POST | /admin/redeem-codes/{id}/revoke | redeem | B4 | ยังไม่มี handler |
| PATCH | /admin/courses/{id}/ai-support | ai | B8 | ยังไม่มี handler |
| GET | /admin/courses/{id}/videos/{itemId}/ai-transcript | ai | B8 | ยังไม่มี handler |
| PUT | /admin/courses/{id}/videos/{itemId}/ai-transcript | ai | B8 | ยังไม่มี handler |
| GET | /me/ai/conversations | ai | B8 | ยังไม่มี handler |
| POST | /me/ai/conversations | ai | B8 | ยังไม่มี handler |
| GET | /me/ai/conversations/{id}/messages | ai | B8 | ยังไม่มี handler |
| POST | /me/ai/conversations/{id}/messages | ai | B8 | ยังไม่มี handler |
| PATCH | /me/ai/conversations/{id} | ai | B8 | ยังไม่มี handler |
| DELETE | /me/ai/conversations/{id} | ai | B8 | ยังไม่มี handler |
| GET | /me/ai/usage | ai | B8 | ยังไม่มี handler |
| PUT | /me/ai/conversations/{id}/messages/{messageId}/practice/answers | ai | B8 | ยังไม่มี handler |
| PATCH | /admin/blog/{id} | blog | B7 | ยังไม่มี handler |
| DELETE | /admin/blog/{id} | blog | B7 | ยังไม่มี handler |
| POST | /admin/blog/{id}/unpublish | blog | B7 | ยังไม่มี handler |
| GET | /blog | blog | B7 | ยังไม่มี handler |
| GET | /blog/{slug} | blog | B7 | ยังไม่มี handler |
| GET | /admin/blog | blog | B7 | ยังไม่มี handler |
| POST | /admin/blog | blog | B7 | ยังไม่มี handler |
| GET | /admin/blog/{id}/preview | blog | B7 | ยังไม่มี handler |
| POST | /admin/blog/{id}/publish | blog | B7 | ยังไม่มี handler |
| GET | /admin/users/{id} | management | B2 | มี handler; ยังไม่ตรวจรับจริง |
| GET | /admin/users/{id}/enrollments | management | B9 | ยังไม่มี handler |
| GET | /admin/users/{id}/attempts | management | B9 | ยังไม่มี handler |
| GET | /courses/{id}/learners | management | B9 | ยังไม่มี handler |
| GET | /courses/{id}/attempts | management | B9 | ยังไม่มี handler |
| GET | /instructor/learners | management | B9 | ยังไม่มี handler |
| GET | /admin/learners | management | B9 | ยังไม่มี handler |
| GET | /managed-quizzes/{id} | management | B9 | ยังไม่มี handler |
| GET | /instructor/attempts/{id} | management | B9 | ยังไม่มี handler |
| GET | /admin/summary | management | B9 | ยังไม่มี handler |
| GET | /instructor/summary | management | B9 | ยังไม่มี handler |
| GET | /instructors/{id}/courses | catalog | B3 | ยังไม่มี handler |
| GET | /instructors/{id} | catalog | B3 | ยังไม่มี handler |

### Provider inventory เดิมที่ต้อง resolve

| Method | Path | ชุดงาน | สถานะ |
| --- | --- | --- | --- |
| GET | /auth/google/start | B2 | protocol deferred; review ตาม provider จริง |
| GET | /auth/google/callback | B2 | protocol deferred; review ตาม provider จริง |
| POST | /me/auth-identities/google | B2 | protocol deferred; review ตาม provider จริง |
| GET | /me/auth-identities/google/callback | B2 | protocol deferred; review ตาม provider จริง |
| POST | /webhooks/stripe | B4 | protocol deferred; review ตาม provider จริง |
