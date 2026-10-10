# DB-01 extension — Course creator audit

11 ต.ค. 2026 · Schema prerequisite for COURSE-01; no new HTTP operation or feature acceptance.
Contract remains Draft `1.0.0-draft.1`, SHA256 `c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3`.

## Confirmed requirement and discovered gap

Final 1.6 §2.2 separates data creator from the sole Course Instructor: Admin can create on behalf of an Instructor. COURSE-01 also requires creator/time. Logical DOMAIN_MODEL already includes creator, but physical Course had only instructorId. That old field cannot prove who created a course.

## Technical design / compatibility

- Courses owns optional Course.createdBy, a retained FK to Account; Auth remains Account owner. Prisma named CourseCreator relation and creator index support audited authoring without a second identity copy.
- New audited authoring writers must INSERT createdBy from the freshly authenticated actor in the same transaction as Course and existing createdAt. Never accept a creator claim from the request or use selected Instructor as a substitute. This batch adds persistence support only; HTTP creation writers are still pending.
- Existing rows retain createdBy=NULL because their original creator is unknown. The actual upgrade probe compares every old Course field before/after ALTER and proves no ownership-derived backfill. Nullable compatibility does not make creator capture optional for new audited writers.
- Database trigger rejects changing/clearing original creator, including guessed legacy NULL backfill. Current Instructor transfer and original creator role changes do not rewrite audit. FK restricts Account deletion; creator PK rewriting cannot cascade through immutable audit. Accounts retain stable identity IDs.
- Existing createdAt storage/value is preserved; no timezone conversion, fabricated actor/time, Course status/revision reset or academic/approval mutation. No new table, HTTP field, role/eligibility/retry/revision policy.
- Add-only migration `20261011045000_db01_course_creator`, after all eight immutable applied batches. Only isolated melearn_test is migrated; no production/STG or new cloud resources. Lead remains sole schema owner.

## Verification / remaining work

Seven PostgreSQL cases: exact applied checksum and full nine-batch DDL rollback over27 models; actual old-row upgrade preserving all original fields and unknown creator; distinct Admin creator/Instructor transfer/role change/reconnect; rejected audit edits with atomic rollback; invalid/deleted creator FK; failed creation rollback; observed pg_blocking_pids FK wait when creator deletion races a Course INSERT.

Prisma validate/generate and read-only actual Test PostgreSQL→Prisma diff: no DDL delta. Blueprint now requires every migration directory to appear exactly once with its checksum in EXECUTION_STATUS, so a newly added batch cannot bypass traceability checks.

Whole COURSE-01 still requires canonical Instructor/Admin creation and directories, reviewed D10 create/replay/precondition handling, complete Auth/Management prerequisites and real authoring browser gate. This schema verification does not accept creation behavior, permission enforcement or any original113 case. Scope §2.2/COURSE-01 is the read set; no duplicate business specification.

Local regression checkpoint: 49 foundation + 28 feature units + 314 PostgreSQL = 391 tests; unchanged114 real client/transport checks. [Hosted Nest CI 38096201158](https://github.com/natthawat141/meleran-tutor/actions/runs/38096201158) passed exact code SHA `621a27ed079ba1c3290645d84c598e0f9984492b` after all nine migrations; full creation/feature/acceptance remain open.
