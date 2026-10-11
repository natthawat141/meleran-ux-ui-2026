# Melearn NestJS Implementation Blueprint

วันที่ 10 ตุลาคม 2026 · Planning only · Contract Draft ไม่ frozen ทั้งระบบ

## Current execution override — 2026-10-11

Latest user authorizes documented technical choices and continuing Wave1–17. Current verified feature-local boundaries: Enrollment owns CompletionCoordinator/ResumeWriter; Assessment exposes BestResultReader; Certificate exposes CompletionIssuer; Course owns metadata/directory/authoring. Atomic completion freezes first proof and certificate, not client scores. Auth Username HTTP now uses LocalAuthenticationService/SessionWriter, removing active prototype issuance/legacy password checking. Email remains explicit unavailable until Firebase branch. All protected runtime handlers require AuthoritativeAudience and fresh normalized roles; architecture-baseline has zero prototype exceptions. Older proposal/status paragraphs below are historical where superseded by current EXECUTION_STATUS and AUTONOMOUS_EXECUTION_DECISIONS. Canonical Draft.2 unchanged; original113 acceptance cases remain tracked.

## 1. Source precedence และ execution target

Execution overlay 11 ต.ค.: ผู้ใช้อนุญาต agent เลือก technical details ที่ค้างพร้อมบันทึก ไม่ idle-wait; ดู AUTONOMOUS_EXECUTION_DECISIONS.md. Shared pagination utility มี scalar query validation/HMAC keyset เท่านั้น ไม่ query entities/authorize. Auth PrincipalService.requireSelfWrite ถือ Account UPDATE ก่อน resolve เพื่อไม่เกิด lock upgrade ใน simultaneous commands. AI wire metadata `_wire` version1 เป็น bounded private storage format; Sender ต้องเขียนตาม format, readers fail closed สำหรับ legacy missing metadata. Tombstone delete ไม่ทำลาย quota/dedupe

- CONFIRMED: Final 1.6 กำหนด business behavior; canonical OpenAPI กำหนด HTTP shape ปัจจุบันในฐานะ Draft.
- คำสั่งล่าสุดให้ใช้ NestJS ที่มีต่อ จึงแทนคำตอบก่อนหน้าที่เลือกสร้างฐานใหม่แยก. Target: D:/code/elearn-prod/worktrees/melearn-fullstack/backend (D13 confirmed 2026-10-11).
- ASP.NET และ NestJS README ที่อ้างเทียบ 13 operations เป็น implementation/reference evidence ไม่ใช่ business specification.
- Planning baseline below is preserved; execution is authorized for Wave 1–17. See EXECUTION_STATUS.md for verified source/schema changes; no deployment/STG.
- ข้อมูลใหม่/fixtures แยกสำหรับทดสอบตามคำตอบผู้ใช้; ไม่ย้ายบัญชีหรือ password hashes ของต้นแบบ.
- Canonical sources อยู่ sibling docs/; mirrored fullstack docs มี OpenAPI hash เท่ากัน ณตรวจ แต่ไม่สร้าง planning สองชุด.

## 2. Facts ที่ตรวจจาก source

| เรื่อง | พบจริง | ข้อจำกัด |
| --- | --- | --- |
| App | NestJS/Express; src/features, shared/auth+errors, prisma | มี 5 feature modules; module boundaries ยังไม่ enforce |
| Versions | Lockfile Nest 10.4.22, Prisma 6.19.3; TS 5.9.3 resolved | package ranges กว้าง; ไม่ upgrade major โดยอัตโนมัติ |
| Database | Prisma 8 models; SQLite file dev.db | ไม่มี migrations/PostgreSQL test evidence |
| HTTP | global /api/v1; 13 handlers | CurrentUser projection missing fields; validation/serialization drift |
| Bootstrap | main calls seedInitialData | สร้าง demo accounts/course ระหว่าง startup; ต้องแยก test fixtures |
| Auth | local password/session guard; 12h Strict cookies | provider absent; values ไม่ได้ freeze; security needs D01/D02 |
| Tests | 13 E2E test definitions; destructive deleteMany in beforeAll | ไม่ rerun; ไม่ใช่ 13 acceptance cases หรือ Test PostgreSQL |
| Git/CI | Nest directory ไม่มี .git/CI | fullstack workflow ยังเป็น ASP.NET; D13 ต้องกำหนดก่อน hosted CI |
| TypeScript | strictNullChecks/noImplicitAny=false; service bodiesมี any | Foundation แก้เฉพาะส่วนจำเป็นตาม typed DTO boundary |
| Package build policy | pnpm-workspace has allowBuilds placeholder text | ทบทวน lock/build policyก่อนติดตั้งใด ๆ; ไม่ execute install scriptsในplanning |

Infrastructure ที่ใช้ต่อ: src/prisma/prisma.module.ts และ prisma.service.ts; schema อยู่ prisma/schema.prisma. Bootstrap seed อยู่ src/prisma/prisma-seed.ts. ไม่สร้าง Prisma client/database connection ชุดที่สองเพียงเพื่อเปลี่ยนชื่อ shared folder.

## 3. PROPOSED architecture conventions

- Modular Monolith เป็นแอปเดียว; controller/service/DTO/persistence helper/tests ใกล้กันใน src/features/<feature>.
- Controller map HTTP เท่านั้น; typed DTO validation; service ตรวจ use case, role, ownership, lifecycle และ transaction.
- ไม่บังคับ MediatR/CQRS/AutoMapper/generic repository หรือ distributed events; เพิ่ม abstraction เมื่อมีการใช้จริง.
- Prisma entity/client type ไม่เป็น HTTP DTO; explicit mapping ตาม required/nullable/enum/media types.
- Shared เฉพาะ Prisma transaction/connection, config, safe errors/request correlation และ guard metadata. Session resolverอยู่Auth; shared guardเรียก public interface ไม่ query entityทุกmoduleเอง.
- request_idของerrorสร้าง/validate server-side; logs ไม่เก็บpassword/token/secret/raw provider proof/transcript.
- Auth audience เลือก app ไม่ให้สิทธิ์; principalและresource scopeมาจากserver.
- No runtime seed/migration; demo credentialsย้ายเป็นtestfixtureเท่านั้น. ไม่ใช้SQLitefallbackเมื่อPostgreSQLไม่พร้อม.
- ใช้ package scripts/nodeที่มี; fix DTO/Jest/strict compilerเป็นFoundation ไม่สรุปว่า buildผ่านคือ APIครบ.

## 4. Module interfaces และ ownership

| Module | Writes ที่เป็นเจ้าของ | Public interfaces ที่เสนอ | Dependencies |
| --- | --- | --- | --- |
| Auth | User identity/roles/credentials/identities/sessions/verification/reset | resolvePrincipal, getAccount/PublicInstructor, createLocalAccount, grantInstructor, updateSelfProfile | Database |
| Accounts | own profile facade; write Userผ่านAuth owner | getMe/updateMe | Auth |
| Courses | Course/Review/Chapter/Item/Quiz/Question | getPublishedProjection, getLearningDefinition, assertOwnedCourse, setAiEnabledForAdmin | Auth |
| Certificates | Certificate/file metadata | issueForCompletion(tx, trusted snapshot), ownList/download | Database; read joins declared only |
| Enrollments | Enrollment/Progress/completion snapshot | grantEntitlement(tx), assertAccess, recordItemResult(tx), getOwnProgress | Auth, Courses, Certificates |
| Learning | authorized content/resume/complete orchestration | getContent, resume, markArticleVideoComplete | Courses, Enrollments |
| Assessments | Attempts/Answers/immutable question snapshots | start/submit/grade, ownResult, managedResult | Courses, Enrollments |
| Redeem | Code issue/use/revoke audit | redeem/revoke; internal grant participant | Courses, Enrollments, Auth |
| Payments | Payment/Event/fulfillment | checkout/status, handleVerifiedEvent | Courses, Enrollments, Auth |
| AI | settings orchestration/transcript/chat/request/quota/practice | ownedHistory, ask, updateTranscript, answerPractice | Courses, Enrollments, Assessments authorized read context, Auth |
| Blog | BlogPost/editor/revision | publicRead/adminEditor | Auth |
| Management | permission-scoped query composition | roster/attemptView/summary | Auth/Courses/Enrollments/Assessments/Certificates read interfaces |

Progress/completion ownershipในEnrollmentsเป็น technical proposal เพื่อหลีกเลี่ยง Learning↔Assessment↔Certificate cycle.
Assessmentส่งbackend-derived best-result proofผ่านEnrollment service; EnrollmentเรียกCertificate issuerในtransactionเดียว.

Free grant execution component (11 ต.ค. 2026): Enrollments owns the atomic
`POST /courses/{id}/enroll` command; `PrincipalService.requireLearning` checks
fresh stored Web authority inside the caller transaction. Session/Account/roles
locks precede Course shared lock and the existing EntitlementWriter. Exclusive
Account lock blocks new Admin role grants as well as identity changes; existing
role locks alone cannot protect against newly inserted roles. This route and
Admin AI opt into normalized authority; other legacy handlers remain pending
Auth cutover. See FREE_ENROLL_COMPONENT.md; no transport/provider policy frozen.
Certificate issuerไม่importLearning/Assessments และไม่มีpublicissueAPI. Identityอ่าน/แก้ผ่านAuthเพื่อไม่เกิด Accounts↔Auth cycle.
Read joinsข้ามtableอนุญาตเฉพาะprojectionที่ระบุscope/fields; ห้ามcross-module writeผ่านPrismaโดยพลการ.
MGMT-02 Instructor assignment execution: Management caller transaction invokes Auth public InstructorGrantWriter; Session shared → sorted actor/target Account exclusive locks → fresh normalized Admin authority. Atomic UserRole/original audit/compatibility role mirror replaces legacy assignment; Auth-local bounded CurrentUser projector is shared with self reads. Account-create writer remains a tracked exception; directory/browser/provider prerequisites remain open. See INSTRUCTOR_GRANT_COMPONENT.md.
Public interfacesรับvalidated inputs/principal/transaction context ไม่รับwire claimsเป็นสิทธิ์.

AI-04 execution component: AI owns feature-local answer Controller/Service/DTO
and private snapshot decoder; reuse Auth public `requireSelfRead` for fresh bound
identity and normalized Admin namespace, then lock Conversation→Message→Practice.
Only latest answer/time and conversation activity change in the caller transaction;
no provider/quota/academic cross-module writes. Schema owner appends DB-05 linkage
and message-role locking migrations; see AI_PRACTICE_ANSWER_COMPONENT.md.

AI-03 usage read: feature-local AiUsageController/Service/DTO reuse Auth fresh
self authority; one DB instant drives explicit Bangkok day/reset SQL. Central
AI config owns AI_DAILY_PROMPT_LIMIT=20 and timezone; future limit changes also
require review of DB quota constraint. GET reads success only, never inserts or
reserves; no provider/academic dependencies. See AI_USAGE_READ_COMPONENT.md.

AI-05 rename: feature-local Controller/Service/Pipe/DTO; fresh Auth identity
then exclusive owned Conversation lock. Title/activity only; no cross-module
writes or provider call. Same Conversation lock order as practice answers;
Unicode canonical length, no prototype-derived normalization. See AI_RENAME_COMPONENT.md.

Critical interface contracts เป็น PROPOSED: Auth.resolvePrincipal(session,audience) คืน internal principal/roles/eligibility; Courses.getLearningDefinition(principal,courseId) คืน authorized content/revision โดยไม่เปิด answer keys ให้ learner; Courses.getAssessmentDefinitionForAttempt(principal,enrollment,quizId) คืน immutable-definition input พร้อม private keys เฉพาะ Assessments service ไม่ serialize ออก HTTP; Enrollments.grantEntitlement(tx,userId,courseId,sourceRef) คืน created-or-existing Enrollment โดยไม่ทับ source เดิม; Enrollments.recordItemResult(tx,trustedProof) ตรวจ same-course/current content/best graded result ก่อน completion; Certificates.issueForCompletion(tx,completionSnapshot) คืน Certificate เดิมหรือสร้างหนึ่งรายการ. Proof เหล่านี้สร้างภายใน service เท่านั้น ไม่มี controller รับ proof/score/eligibility จาก client.

ACCOUNT-01 GET execution: Accounts owns Controller/SelfProfileService and opens
the read transaction; Auth exports SelfProfileReader via public/index and owns
bounded identity/credential projection. Fresh normalized self authority holds
Session/Account/existing roles; no passwordHash/provider subject select, CSV role
fallback, stored metadata serialization or repair writes. Method-level guard
cutover keeps pending PATCH separate. See SELF_PROFILE_COMPONENT.md.

## 5. Database and transaction contract

Learning read component: bounded Course/Item/own Enrollment/Progress/Certificate
read joins are declared in LEARNING_READ_COMPONENT.md. No private Quiz key or
Transcript select; no cross-owner write. Fresh Auth locks precede Course and
Enrollment shared locks. Authoring takes Course exclusive; academic/resume
writers take Enrollment exclusive before Progress, preserving coherent current
reads at ReadCommitted. Current progress comes from rows, historical completion
remains intact. Management preview and full Auth/authoring gates remain pending.

Execution component interfaces reviewed 11 ต.ค. 2026:
`EntitlementWriter` in enrollments/public is a persistence participant exported
by EnrollmentsModule; it accepts the caller's transaction and verified command
intent, returns created-or-existing canonical lifetime grant, and never checks
provider credentials or commits independently. Owning Free/Redeem/Stripe commands
must establish eligibility/source proof and documented locks before calling it;
it is not exposed as an HTTP permission shortcut. Submitted-score arithmetic is
feature-local to assessments, uses a local Prisma Decimal constructor, and does
not decide D06 best-attempt selection. Public Instructor detail reads normalized
DB-02 role grants; Auth/Management compatibility role writers remain pending.

- Logical model ทั้ง V1 อยู่ DOMAIN_MODEL.md; physical Prisma/PostgreSQL migrations ทยอยตาม DB-01–06. DB-06 แยก provider identity/verification/reset หลัง D03 จึงไม่ขวาง public slice.
- Schema Owner = Lead/DB maintainer คนเดียว. Workersส่งdelta/constraints/tests; ownerสร้างmigrationและclient generationตามbatch.
- Shared Prisma.TransactionClientส่งต่อระหว่างowner services; participantห้ามเปิดautocommit/nested independent transaction.
- Race-sensitive commandsใช้ unique/FK + row lockหรือSerializableตามreviewedSQL; retry serialization เฉพาะbounded local DB workด้วยsame intent. จำนวน/timeoutเป็นconfig proposal ไม่เพิ่มbusinesspolicy.
- Commands ที่อาจจบคอร์สใช้ lock order เดียว: Course (shared against authoring write) → optional Payment/RedeemCode source row → Enrollment → Attempt → Answer/Progress → Certificate. Acquire ก่อน mutation และ recheck หลัง lock; participant ไม่กลับลำดับ. Course authoring ใช้ exclusive revision lock เพื่อไม่ race กับ denominator/completion; row-lock SQL/isolation ต้องผ่าน PostgreSQL tests.
- Provider/SMTP/AI/PDF/storage network I/Oอยู่นอก DB transaction; durable stateรองรับfinalize/retry.
- ไม่แก้/delete applied migrations; test migration เฉพาะ isolated Test PostgreSQL connection ที่ตรวจเป้าหมายแล้ว.

## 6. Dependencies: reuse baseline / proposals

Resume persistence execution: EnrollmentsModule exports ResumeWriter and the
feature-local storedResume format. Caller owns fresh access/Course shared and
Enrollment exclusive locks. Separate saved UTC time/private bigint order in
Progress.resumeData prevents completion timestamps/millisecond ties from changing
latest resume. Canonical projections strip internal metadata. No public mutation
or input-omission policy frozen here; see RESUME_PERSISTENCE_COMPONENT.md.

สแตก NestJS, TypeScript, Prisma, PostgreSQL ได้รับการเลือกแล้ว. Packagesที่พบและให้ใช้ baselineเดิมตามคำสั่ง reuse:
Nest common/core/platform-express, Prisma client/CLI, class-validator/transformer, cookie-parser, reflect-metadata, rxjs;
dev: Jest/ts-jest, SuperTest/Nest testing, TypeScript/compiler tools ตาม lockfile.
ไม่ถือข้อมูลนี้เป็นอนุญาตเพิ่มpackageหรือเปลี่ยนversion. แก้ build allowlist/type compatibilityโดยreviewก่อนinstall.

Runtime JSON schema validationของresponsesเป็นtest requirement:
reuse Frontend existing ajv/ajv-formats + canonical validation toolingในdevelopment test jobที่ประกาศcwd/dependencyชัด;
ถ้าต้องเพิ่มเป็นNest dev dependencyให้บันทึกเหตุผล/approvalก่อน ไม่มีbackend runtime dependencyใหม่.
Firebase/Stripe/Resend/OpenRouter/R2/PDF adaptersหรือSDKยังไม่implemented; package choice/statusเป็นdecisionของprovider tasks.
ไม่ใช้ generatorที่สร้างendpointcrudนอก86 operations และไม่ใช้ Swagger-generated schemaเป็นcanonicalอีกฉบับ.

## 7. Test / change gates

Certificate detail execution: Certificates owns the owner-filtered historical
metadata read; Auth public requireSelfRead holds fresh bound authority without
granting learning eligibility. Certificate/Enrollment shared locks protect the
issued record; the projection uses original snapshot names/date/code and no
current Course or Account profile. No read-triggered issuer/file renderer or
completion repair. See CERTIFICATE_DETAIL_COMPONENT.md; full task gates remain.

VIDEO-01 execution: Courses owns the unavailable route; Auth requireAuthoring
holds fresh normalized authority separately from learning eligibility. Explicit
either-audience metadata selects a bound session namespace, never role claims.
Course shared ownership read then fixed canonical 503; no storage/write.
Only the dedicated fixed capability exception is a public 5xx; generic failures
retain diagnostic masking. See VIDEO_UNAVAILABLE_COMPONENT.md; full Auth/editor
gates remain open and existing single-audience behavior is retained.

Redeem execution component: Redeem owns Code audit through feature-local
RedeemWriter; caller transactions use Auth → Course shared → Code exclusive →
EntitlementWriter, with original grant preserved. Admin revoke uses fresh held
Admin authority then Code exclusive, acquiring no later Course/Enrollment lock.
Shared canonical EmptyRequest validation serves Free Enroll/Revoke. Public
redeem input/lifecycle and full feature gates remain pending; see
REDEEM_TRANSACTION_COMPONENT.md. No cross-owner write or schema delta.

- ระหว่างแก้: targeted unit/authorization/contract testsตามtask.
- จบtask: pnpm.cmd exec tsc --noEmit + relevant Jest/SuperTest suite; commandใหม่ต้องdeclaredในFoundation.
- Current test:e2eล้างDBก่อนtest: ห้ามรันจนแยกTEST_DATABASE_URL/allowlistและisolatedfixturesแล้ว.
- Contract: validate actual serialized JSON against pinned subset; reuse existing Frontend schema toolingไม่แต่งsubsetด้วยมือ.
- Schema changeเท่านั้น: owner generate→SQLreview→Test PostgreSQL migration+constraints+rollback.
- Merge: full build/CI/full relevant suite. ไม่buildทุกappหรือdeployทุกendpoint.
- Feature integration: remote Frontend→Nest→Test PostgreSQL, read-back/restart/browserpermission/error evidence; mockfailureห้ามfallback.
- Release/staging/provider tests/migrationapproval/smoke/rollbackเป็นfuturegate ไม่authorizationให้ทำในplanning.

## 8. Agent read set and restrictions

ASSESS-02 owned Attempt read: Assessments module/controller/service/DTO stay feature-local. Auth public self authority → own Enrollment shared → Attempt shared locks; declared historical read joins select only public snapshot fields in SQL. No current Quiz/Question dependency or cross-owner write. Future academic writers must hold Enrollment→Attempt exclusive before Answer/summary changes. Stored snapshot convention and unresolved Submitted wire state are in ATTEMPT_READ_COMPONENT.md; full ASSESS-01/Grade/Completion remains pending.

MGMT-04 locator: Management-local read uses Auth public fresh authoring authority → Course shared → Item/Quiz shared; Course owner Instructor or normalized Admin only. Select two IDs after scoped same-course/type predicate, no question/key/PII read. Public authoring quiz ID is CourseItem.id; internal Quiz.id is not an alternate HTTP namespace. Future aggregate authoring writers hold Course exclusive first. See MANAGED_QUIZ_LOCATOR_COMPONENT.md; roster query/PII, grading and browser feature gates remain open.

MGMT-01 Admin detail: Management supplies transaction to Auth public AdminUserDetailReader; Session → sorted actor/target Accounts shared → fresh normalized Admin/target roles → bounded metadata/profile projection. No hash/provider subject, entity spread, role-string fallback or identity write. Sorted Account order matches Instructor grant; profile array limits follow each operation's canonical schema (Admin inline no cap, CurrentUser default30). Pending/active is Draft projection, not authorization/disable-policy approval. See ADMIN_USER_DETAIL_COMPONENT.md; whole creation/query/Auth/browser gates remain open.

อ่าน Architecture + task + generated contract subset + referenced transaction. Taskที่READYต้องไม่มีbusiness/protocol decisionค้าง.
Scope/business case excerptsอยู่ในtaskเป็นprojectionพร้อมsource; ไม่ต้องอ่านhandbookทั้งระบบทุกครั้ง.
Decisionใหม่→DECISIONS.md + impactedtask; เปลี่ยนcanonicalได้หลังapprovalและsyncตามdocs/AGENTS.md.
อ่าน EXECUTION_PLAN.md สำหรับคิวงาน; OPERATION_MATRIX.json สำหรับ91 records/113 acceptance traceability.

## Reviewed physical batches — 2026-10-11

Course aggregate/review writers stay Courses-local. Shared fresh principal → Course UPDATE serializes metadata/curriculum/state against content/completion/assessment Course SHARE. Questions/options retain scoped server IDs; submission stores versioned full-authoring and real management snapshots, preserving historical definitions/counts. Review queue/detail use snapshots and current stale status; canonical publish returns full AuthoringCourseDto. No cross-module private imports or schema delta. [Execution conventions](AUTHORING_REVIEW_COMPONENT.md).

Lead is sole schema owner. DB-01/02/05/03/04 are applied only to isolated melearn_test. Applied SQL bytes are immutable and Git -text preserves checksums. New snapshot/history/date columns use PostgreSQL JSONB/timestamptz/date; assessment scores use numeric(65,30). Existing compatibility timestamps/roles/profile strings remain until their dependent cutover.

DB-01 creator extension: ninth add-only batch stores immutable Course.createdBy FK separately from current Instructor. Unknown legacy creator remains NULL without guessed backfill; future audited creation uses fresh actor and existing createdAt in one Course INSERT. No HTTP create/replay policy is implied. See COURSE_CREATOR_AUDIT_SCHEMA.md. Blueprint requires exact migration directory/manifest parity and immutable checksums, not only checks for listed batches.

The root CI pins existing pnpm dependencies and uses disposable PostgreSQL; no cloud secrets. Static boundaries reject private cross-module imports, controller persistence and direct cross-owner Prisma writes. Two unchanged prototype Account writers are hash-quarantined for ACCOUNT-01/MGMT-01/02; this does not approve their business/security behavior. Dynamic SQL/aliases require review and feature authorization tests.

Reviewed Admin AI component: Auth public PrincipalService resolves only stored session proof and normalized roles; AuthoritativeAudience is an opt-in boundary for verified new handlers. Resource transactions revalidate/hold session+account+role authority before Course/Item locks. AiSupportWriter is Course-owned; Transcript is AI-owned. Public imports use explicit public/index barrels. See ADMIN_AI_COMPONENT.md; D01–D03 and full Auth/role-writer cutover remain unresolved. No session lifetime or provider credential policy was inferred.

## Auth kernel execution — 11 ต.ค. 2026

Management history continuation: Management consumes Assessments public ManagedAttemptReader only after fresh Course-owner/Admin authority and scoped IDs; public reader rechecks historical links and projects snapshots without keys. Roster stays Management-local, canonical one Enrollment/course per row. Payment reads share feature-private stored-payment projection; Admin lookup selects canonical receipt metadata only and performs no provider or entitlement write. [Component conventions](MANAGEMENT_HISTORY_COMPONENT.md). No schema/dependency delta.

Approved lifetime/constraints recorded in DECISIONS.md and Draft.2. Auth-private LocalPasswordService/LocalAuthenticationService/SessionWriter use approved Node crypto; no new dependency/schema/migration. PBKDF2-SHA256 600,000 is a technical choice with versioned metadata; no legacy fallback. All new issuance/reset/revoke-all writers acquire per-account transaction advisory lock; revokers then lock sorted Sessions → Account → Credential, compatible with fresh principal readers. Issuance verifies credential still current and normalized roles under locks. Legacy login is quarantined and does not yet participate; coordinated revocation guarantee applies to the new kernel writers until full cutover. Trusted reset participant does not verify provider/action-link proof. See AUTH_LOCAL_KERNEL_COMPONENT.md.
