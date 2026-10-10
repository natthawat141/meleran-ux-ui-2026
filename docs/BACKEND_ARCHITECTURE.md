# Melearn Backend Architecture

วันที่ 10 ตุลาคม 2026 · Architecture baseline ที่ผู้ใช้อนุญาตให้เริ่ม dev · Backend foundation เท่านั้น

## การตัดสินใจที่ใช้แล้ว

ใช้ ASP.NET Core .NET 10, Controllers เป็น HTTP boundary, Clean Architecture และจัด Application ตาม feature/use case. ระบบเป็น Monolith ที่ build/deploy เป็น API เดียว. ยังไม่กล่าวอ้างว่าเป็น Modular Monolith ที่บังคับ boundaries รายโมดูลครบแล้ว.

แบ่ง 4 source projects:

```text
src/
  Melearn.Api/             HTTP / Controllers / DTOs / middleware / composition
  Melearn.Application/     use cases / ports / orchestration
  Melearn.Domain/          entities / business invariants / lifecycle
  Melearn.Infrastructure/ persistence / identity / external provider adapters
tests/
  Melearn.ArchitectureTests/
  Melearn.IntegrationTests/
```

ไม่บังคับ MediatR, AutoMapper, generic repository, distributed broker หรือ framework สำหรับ DDD ตั้งแต่ต้น. เพิ่ม abstraction เมื่อมีความรับผิดชอบและเหตุผลจริง. Framework/application DTO ไม่ใช่ EF/database entity.

## Dependency rules

| Project | Project references ที่อนุญาต |
| --- | --- |
| Domain | ไม่มี |
| Application | Domain |
| Infrastructure | Application, Domain |
| Api | Application, Infrastructure |

Api อ้าง Infrastructure เฉพาะ composition/configuration/DI. Controllers/features ห้ามใช้งาน implementation/database classes ของ Infrastructure โดยตรง. Domain/Application ไม่มี ASP.NET/EF Core dependencies; async use cases รับ CancellationToken และทำงานผ่าน ports ที่จำเป็น.

Architecture tests ปัจจุบันตรวจ project-reference graph, framework/package restrictions เบื้องต้น และการอ้างชื่อ Infrastructure ใน Api Features. ยังไม่ใช่การตรวจทุก type/dependency อย่างสมบูรณ์; เพิ่ม assembly/type checks เมื่อมี implementations.

## Feature/use-case ownership

14 กลุ่มสำหรับ backend handoff อิง API handbook ที่มีอยู่ ไม่ใช่ 14 deployable services:

| Feature | หน้าที่และข้อมูลที่เป็นเจ้าของ |
| --- | --- |
| Auth | register/login/logout/email verification/password reset/Google identities; Web/Admin session แยก |
| Accounts | profile ของบัญชีตนเอง; ไม่เปลี่ยน roles/verification ผ่าน profile |
| Catalog | published course/instructor projections; ไม่มี raw content/answer keys |
| Enrollments | สิทธิ์เรียนและกลไกให้สิทธิ์กลางจาก free/redeem/verified payment |
| Learning | authorized content/progress/resume |
| Assessment | attempt/answer/submit/score/owner Instructor grading |
| Certificates | completion snapshot / exactly-once issue / private download |
| CourseAuthoring | course/chapter/content/quiz editing และ owner submit-review |
| CourseApproval | Admin reviews / lifecycle / publish |
| Payments | checkout/payment status/provider events; ไม่ให้สิทธิ์จาก success page |
| Redeem | code ใช้ครั้งเดียว / atomic redeem / unused-only revoke |
| AI | own conversation/history/practice/quota; Admin transcript/course AI settings |
| Blog | Admin editor/revision/publish; public published projections |
| Management | Admin accounts/Instructor assignment; course-scoped roster/results/summary |

ตัวอย่าง use case ที่จะเพิ่มภายหลัง:

```text
Melearn.Api/Features/CourseAuthoring/
  CourseAuthoringController.cs
  Contracts/SubmitReviewRequest.cs

Melearn.Application/Features/Courses/SubmitReview/
  SubmitReviewCommand.cs
  SubmitReviewHandler.cs

Melearn.Domain/Courses/
  Course.cs
  CourseStatus.cs

Melearn.Infrastructure/Persistence/Courses/
  <implementation หลังเลือก ORM/DB>
```

Api รับ/validate/map HTTP DTO → Application ใช้ identity ที่ server ตรวจแล้ว ตรวจ ownership และ orchestrate → Domain ตรวจ lifecycle/invariants → Infrastructure ทำ transaction/persistence/provider I/O. ไม่ให้ feature เรียก Controller ของอีก feature; งานให้ Enrollment เป็นกลไกกลางเพื่อป้องกันซ้ำจากหลายช่องทาง.

## HTTP/JSON foundation ที่ implement แล้ว

- `Program.cs` ประกอบ services/middleware/controllers เท่านั้น.
- JSON property names ใช้ snake_case; nullable response fields ไม่ถูกตัดทิ้ง global เพราะ Contract อาจกำหนด required-but-nullable.
- Unknown request members ปฏิเสธด้วย serializer policy; ต้อง review per DTO ถ้าบาง resource ต้องรองรับ extension fields.
- Model validation ใช้ 422 และ error envelope `{ "error": { "code", "message", "request_id", "details?" } }`.
- Validation fields แปลงชื่อเป็น snake_case; `details` ของ error omit เฉพาะเมื่อไม่มี.
- Exception handler คืน generic 500 ไม่มี exception/stack ใน response. Logs ไม่เก็บ body/password/token; ต้องทบทวน redaction เมื่อเพิ่ม providers.
- Empty 404/405 response แปลงเป็น envelope และคง HTTP status / Allow header.
- Request ID ใช้ server TraceIdentifier; ยังไม่รับ caller-supplied correlation header เป็นค่าที่เชื่อถือได้.
- `/health/live` เป็น liveness; `/health/ready` ตอบ 503 จนกว่าจะมี capability checks จริง.

ยังไม่มี authentication/authorization middleware, DB, validators เฉพาะ business DTO หรือ provider SDK. Business endpoints ต้องเพิ่ม identity + resource permission tests ก่อนเปิดใช้งาน ห้ามอาศัย audience/header/client role เพื่อให้สิทธิ์.

## Contract workflow

Frontend Draft มี 86 operations และ 5 deferred provider operations; ยังไม่ Backend-frozen. Source คือ sibling `docs/api-contract/openapi.json`; handbook เป็น generated readable projection.

ก่อนทำแต่ละ flow:

1. Review required/optional/null, enum, validations, permissions, errors และ idempotency กับ Final 1.6.
2. แก้ source OpenAPI เมื่อมีการตกลงเปลี่ยน ไม่สร้าง backend-generated schema อีกฉบับโดยเงียบ ๆ.
3. สร้าง request/response DTO แยกจาก entity และ application models; เลือก generation หรือ explicit mapping ที่ตรวจ drift ได้ก่อนเริ่มชุด DTO ใหญ่.
4. Implement ทีละ use case พร้อม domain/permission/transaction tests และตรวจ HTTP JSON กับ schema.
5. เชื่อม Frontend เฉพาะ flow ที่ implementation และ contract tests ผ่านแล้ว; flow อื่นยังคง mock.

Foundation tests ยังไม่เป็น contract acceptance ของ 86 operations. Error envelope ใช้โครงเดียวกับ Draft แต่ operational readiness details/code เป็น host-specific; ไม่อ้างว่าเป็น business schema ใหม่ที่ freeze แล้ว.

## Decisions ที่ยังต้องตกลง

Auth provider ยืนยันแล้ว 10 ต.ค. 2026: Firebase สำหรับ Email/Google และ .NET สำหรับ Username ไม่มี email ตาม Final 1.6. อ่าน [Auth decision และ integration Draft](AUTH_DECISION_TH.md); ยังไม่ใช่ implementation หรือ canonical HTTP contract ที่แก้แล้ว.

| เรื่อง | สถานะ / สิ่งที่ต้องเลือก |
| --- | --- |
| Database / ORM | PostgreSQL 16 บน Cloud SQL Bangkok instance melearn-tutor-db RUNNABLE แล้ว; EF Core/Npgsql เป็นแนวทางที่เสนอ migration/transaction/runtime DB user และ SQL connection ยังไม่ได้ implement |
| Auth | Firebase Email/Google + .NET Username ยืนยันแล้ว; account mapping/local hash/durable session และ cookie names/domain/path/TTL/revocation/CORS/CSRF ยังต้องกำหนด |
| Google | ใช้ Firebase ยืนยันแล้ว; review 4 deferred operations เป็น Firebase exchange/link flow และ account linking conflicts |
| Stripe | 1 deferred webhook protocol; API version/signature/raw body/dedupe/idempotency |
| Cloudflare media | ผู้ใช้เลือกทิศทาง Cloudflare แต่ยังไม่เลือก Images/R2 และ upload protocol; avatar upload ยังไม่มี contract/mock |
| Canonical contract distribution | version/pinning/shared artifact ระหว่าง frontend/backend repos |
| Concurrency | unified username rules, course return/publish revisions, idempotency lifetime/payload conflicts |
| Rich document / AI / certificate | safe documents/URLs/size, async jobs/streaming, durable quota, PDF/download format |
| Hosting / delivery | Cloud Run project melearn-tutor และ Bangkok ยืนยันแล้ว; origin/config/secrets/health/rollbacks และ cross-project SQL access ยังต้องกำหนด ไม่ได้ deploy |

## ลำดับงานต่อ

1. Foundation (ชุดนี้): 4 projects, HTTP/error/readiness, architecture/integration tests และ CI definition.
2. ตกลง DB/ORM, Auth/session และ contract distribution ก่อนเพิ่ม persistence/identity.
3. Auth/Profile + Catalog/Enrollment flow แรก พร้อม contract tests แล้วค่อยเชื่อม Frontend.
4. Authoring/Review, Learning/Assessment/Certificates, Management/Blog ตาม transaction/ownership rules.
5. Real Stripe/Google/AI/Cloudflare integrations ตาม protocol ที่ตกลง; ผูกสิทธิ์และผลเรียนกับข้อมูลถาวร.

ไม่สร้าง placeholder responses หรือ seed login ที่ทำให้เข้าใจว่า API จริงพร้อม. ไม่ใช้ชื่อ folder `prod` หรือ build ผ่านแทนหลักฐาน security/persistence/provider acceptance.

## แหล่งอ้างอิง

- Microsoft [Clean Architecture](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures)
- Microsoft [ASP.NET best practices](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/best-practices?view=aspnetcore-10.0)
- Microsoft [resource-based authorization](https://learn.microsoft.com/en-us/aspnet/core/security/authorization/resource-based?view=aspnetcore-10.0)
- Microsoft [integration tests](https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-10.0)
