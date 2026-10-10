# Resume persistence / ordering — execution component

11 ต.ค. 2026. LEARN-02 internal participant and LEARN-01 read correction; **public PUT Resume is not implemented by this checkpoint**. Input reconciliation below remains pending.

## Confirmed requirements / traceability

- Final 1.6 §2.5/6.4: persist own position/latest item on the server, survive devices/logout, and never turn resume/opening into completion. §2.7 preserves historic completion/Certificate.
- Canonical `1.0.0-draft.1`, SHA-256 `c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3` unchanged. [LEARN-02 subset](contracts/LEARN-02.openapi.json): eventual PUT `/api/v1/learn/items/{id}/resume`, operationId `put_learn_items_id_resume`, required JSON body `ResumeRequest` → `ResumeResponse`. No new endpoint.
- ResumeRequest permits optional `position_seconds`, number>=0 or null, with no integer/video-only restriction in schema. ResumeResponse fixes `{item_id,resume:{position_seconds,updated_at}}` and forbids extra fields.
- Original A06/Q02 and other LEARN-02 cases remain mapped; these technical tests do not close full acceptance.

## Pending input reconciliation / proposed mapping

Actual frontend mock (`tools/provisional-api/flow-c-learning.ts`) rejects fractional/video-missing position and non-video numeric position; this is reference behavior, not a business source. Scope does not state those restrictions. An explicit question is pending with the user; elapsed time is not approval.

Proposed option 1: preserve canonical schema, accept an explicit non-negative numeric or null position; omission preserves an existing position (or null on first touch). Null explicitly clears position. All allowed content types can retain latest-item context; no watch-time/completion inference. Autosave cadence/precision limits are not invented.

Option 2 requires an approved contract revision: limit numeric position to video/integer and document item-type-dependent validation. Do not copy the mock rules or change canonical schema silently.

The participant below accepts an **explicit trusted number/null only** and does not choose omission semantics. Public controller/DTO/permission orchestration and full mutation/client/browser gate remain pending that answer and prerequisites.

## Implemented owner / transaction mechanics

- Enrollments owns `public/ResumeWriter` and `storedResume`; exported through the existing EnrollmentsModule/public barrel. Learning consumes the owner format; no cross-owner Prisma write.
- Caller establishes fresh authorized learner/own Course access, holds Course shared lock and Enrollment exclusive lock, then calls `save(tx,enrollmentId,itemId,courseId,explicitPosition)`. This kernel does not authorize an HTTP request, open its own transaction, grant, grade or complete anything. Runtime never seeds/migrates.
- Parameterized `INSERT ... ON CONFLICT(enrollmentId,itemId)` changes only Progress.resumeData/updatedAt. Existing completedAt, Enrollment counters/snapshot/time, Certificate and source records remain intact. Same-course FKs reject mismatched items; downstream failure rolls back the actual SQL.
- PostgreSQL clock_timestamp supplies actual write time, truncated to milliseconds and stored as UTC ISO text in resumeData.updated_at. Completion may later touch Progress.updatedAt without changing this saved resume timestamp.
- Enrollment-exclusive serialization allocates a private `_resume_order` decimal string from max prior order+1 in the same transaction. This bigint storage order distinguishes two saves with equal millisecond timestamps/clock movement; it is never returned in the HTTP DTO. No migration or client-supplied ordering field.
- Learning read selects latest new-format resume by that server order. Older rows without the new fields retain timestamp/itemId fallback; all future writers must use the owner interface. Read/write projections validate stored timestamps/order and fail closed for corrupt state, without private diagnostics. Explicit valid save can repair a corrupt timestamp on its own resume row.
- No dependency installation, schema/migration, provider call, cloud changes, STG or deployment.

## Evidence / gates

`test/database/resume-writer.pg-spec.ts`: **8 actual PostgreSQL tests**. Explicit position/null/zero and canonical internal response, one-row upsert, historic completion/Certificate untouched, transaction rollback, FK/invalid-value failure, UTC under Bangkok timezone, coordinated concurrency, same-millisecond order and later completion timestamp not changing latest-item selection, safe corrupt timestamp/recovery, reconnect/read integration. Caller locks are prerequisites; these tests do not establish a new public authorization shortcut.

Existing fullstack frontend harness now uses the actual **built ResumeWriter** with owned test fixtures, then reads via built Nest and unchanged frontend Learning API/decoder. It asserts canonical resume projection and hides private order/extra JSON. Existing 24 client checks remain 6 Catalog + 7 Free Enroll + 11 Learning; this is internal-writer/read integration, **not public Resume mutation or browser acceptance**.

Recheck typecheck/boundaries/blueprint, foundation/feature units/database suite, build; after database tests finish run smoke + frontend harness sequentially. Expected aggregate checkpoint: **49 + 16 + 125 = 190 tests**, plus 24 client checks. Verified SHA/hosted CI is tracked in EXECUTION_STATUS.json after the checkpoint. Whole LEARN-02 remains BLOCKED; manual completion/COMPLETION-01 D06 and full Auth/authoring/browser gates are still required.
