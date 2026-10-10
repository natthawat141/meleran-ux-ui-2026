# MGMT-04 — Managed Quiz locator

11 ต.ค. 2026 · Component evidence; whole MGMT-04/G-MANAGEMENT ยังไม่ผ่าน.
Canonical Draft `1.0.0-draft.1`, SHA256 `c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3`.

## Confirmed HTTP และ authority

`GET /api/v1/managed-quizzes/{id}` / `get_managed-quizzes_id`: ไม่มี body; 200 `ManagedQuizLocator` มีเพียง `course_id` และ `item_id`. Scope Final 1.6 §3.4/3.5/6.6 และ canonical MGMT-04 subset เป็น requirement; current UI ใช้เป็น interoperability evidence.

WebSession หรือ AdminSession ตาม canonical. Fresh normalized Instructor ต้องเป็น Course owner; normalized Admin จัดการได้ผ่านทั้งสอง audience ที่ bind กับ cookie ถูกต้อง. Learner ไม่มีสิทธิ์; compatibility role string ไม่ให้สิทธิ์. Enrollment ในคอร์สผู้อื่นไม่ให้ authoring rights. Unknown/non-quiz/foreign-owner resource คืน 404 แบบเดียวกัน; invalid principal 401; role forbidden 403. Draft/pending review/approved/published อ่าน private authoring locator ได้ตาม owner; ไม่ใช้ public catalog Published predicate กับ editor. ไม่ตรวจ verified-email หรือ enrollment เป็นเงื่อนไขเพิ่ม.

## Wire ID และ storage boundary

`{id}` คือ CourseItem ID ของ quiz item ใน canonical authoring aggregate; internal Prisma Quiz.id เป็น storage identity ที่ต่างกัน. Handbook R4A §managed quiz locator เชื่อม editor กับ course/item; AuthoringCourseDto แสดง item IDs. Actual `frontend/packages/course-authoring/src/http-view.ts` authoringForm กำหนด EditorQuiz.id และ item.quizId จาก item.id; actual Web/Admin useAuthoringWorkspace เรียก locator ด้วย ID นี้. ใช้หลักฐานนี้ยืนยัน HTTP mapping เท่านั้น ไม่เอา mock entity มาออกแบบ DB. ไม่มี dual-ID lookup/fallback หรือเปิดเผย internal Quiz ID.

## Technical implementation และ transaction

Feature-local Management controller/service/DTO; Auth public PrincipalService ตรวจ Session/Account/UserRole ใหม่ใน caller ReadCommitted transaction. Lock auth → Course shared → Item/Quiz shared และ recheck same-course/type link. SQL ตรวจ owner ก่อนเลือก IDs, เลือกเฉพาะสอง public IDs; ไม่ select question/prompt/key/answer/profile/transcript.

Course shared lock ทำให้ ownership change รอจน read จบ; authoring writer ในอนาคตต้อง Course exclusive ก่อน Item/Quiz. Fresh principal รับมือ revocation/disable หลัง route guard. Missing link คืน404; actual SQL failure safe500; ไม่มี read-repair หรือ startup/read write. No schema/migration/dependency/contract/provider/cloud/STG/deployment change.

## Evidence และ remaining gates

13 actual HTTP/Test PostgreSQL cases: exact DTO and distinct IDs; all V1 states/unverified owner; Admin Web/Admin namespaces; enrolled foreign owner404; role-string tampering; cookie/audience/anonymous; unknown/article/internal Quiz UUID; revoked/expired/disabled; owner transfer and revocation after guard; reconnect/parallel reads preserve all27 model counts/private definitions/academic rows; actual SQL error; real pg_blocking_pids ownership-lock wait.

8 actual client checks: unchanged Web/Admin resources.ts + canonical decodeManagementResponse → built Nest → Test PostgreSQL; exact decoded IDs, Admin authority, current pure authoringForm ID roundtrip, enrolled foreign Instructor404, anonymous401, unknown/article/storage UUID404, reconnect/no writes and network failure without fallback. Inject configured singleton client only; actual fetch/decoders remain unchanged. Pure form fixture is an ID mapping check, not evidence for authoring HTTP or React/browser acceptance.

Whole MGMT-04 remains NEEDS_DECISION: D16 roster/query/PII, GET Instructor/Admin learner directories, managed Attempt/GRADE prerequisites and actual Management browser gate. Full Auth/login/provider and course-authoring feature gates also remain open. No numbered case added or closed in the original113 acceptance set. See [execution status](EXECUTION_STATUS.md).

Local checkpoint: 49 foundation + 28 feature units + 307 PostgreSQL = 384 tests; 114 client/transport checks including8 locator checks. Hosted checkpoint pending; previous CI is historical evidence.
