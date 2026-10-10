# ASSESS-02 — Single owned Attempt read

11 ต.ค. 2026. `GET /api/v1/learn/attempts/{id}` / `get_learn_attempts_id` → `WireAttemptView` implemented as a component. ไม่มี request body. Whole ASSESS-02 ยัง NEEDS_DECISION เพราะ `GET /learn/items/{id}/results` ต้องเลือก best attempt ตาม D06.

Canonical `1.0.0-draft.1`, SHA-256 `c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3` unchanged; [task/subset](tasks/ASSESS-02.md), Scope permission `learning.read_self`, §2.6/§5.6/§6.6 เป็น source. Task mapping เดิม A06/A09/Q06/Q07/AI21 คงเดิม; single-read tests สนับสนุนเฉพาะส่วนที่เกี่ยวข้อง ไม่ใช่ full acceptance ของ cases เหล่านี้.

## Confirmed behavior

- เจ้าของผลเรียนอ่าน Attempt ของตนได้; Instructor เจ้าของคอร์ส/Admin ไม่ได้สิทธิ์ข้าม ownership จาก self route. ใช้ Web session ตาม canonical; session/normalized roles ต้องตรวจจาก server ใหม่.
- คำถาม/ตัวเลือก/คะแนนเต็มใช้ snapshot ตอนเริ่ม ไม่ใช้ Question ปัจจุบัน. อ่านคำตอบและ feedback ของตน; ไม่คืน correct keys, grader identity, private metadata หรือ snapshot entity ทั้งก้อน.
- In progress/Pending review ยังไม่มี final earned/percent/passed/question_results; Graded ต้องมีคะแนนครบและผล strict >70. คะแนน 70 พอดีไม่ผ่าน; ห้าม derive pass จาก floating-point percentage ที่อาจปัดเป็น 70.
- GET ไม่ grade/complete/issue Certificate/grant/repair. Snapshot และ academic history เดิมคงอยู่หลังแก้หรือลบ live Question, rename หรือ archive Course. Permission `learning.read_self` เป็น self historical record; ไม่ใช้ข้อห้ามเริ่มเรียน/ซื้อใหม่เพื่อลบสิทธิ์อ่านประวัติของเจ้าของเมื่อ role/verification เปลี่ยน.

## Technical implementation / future writer handoff

- AssessmentsModule อยู่ feature-local; Controller → AttemptReadService → typed DTO/projector. Reuse Auth public PrincipalService; no new package/schema/migration.
- Transaction locks Auth session/account/normalized existing roles → own Enrollment `FOR SHARE` → Attempt `FOR SHARE`. Ownership/same-course FK ถูกตรวจ ก่อนอ่าน private academic fields. Unknown/malformed/foreign IDs 404 แบบเดียวกัน. Future Save/Submit/Grade writers ต้องจับ Enrollment → Attempt exclusive ก่อนแก้ Answer และ summary ใน transaction เดียวกัน; parent lock ไม่ใช่ DB trigger ที่บังคับ writer ใด ๆ ให้อัตโนมัติ.
- SQL เลือกเฉพาะ `definitionSnapshot.item_id` และ question public `prompt/options/prompt_doc`; ไม่ SELECT correct_key หรือ definitionSnapshot/payloadSnapshot ทั้งก้อน. Answer selects response/score/comment เท่านั้น ไม่อ่าน grader/provider credentials.
- **Internal storage convention for upcoming ASSESS-01 writer:** definitionSnapshot ต้องมี immutable string `item_id`; normalized AttemptQuestion owns questionId/type/position/maxScore และ payloadSnapshot public `{prompt: string, options: [{id,text}], prompt_doc?: JSON}`. Private keys อยู่คนละ fieldและไม่มีใน public SQL projection. Convention เป็น technical projection ของ canonical fields; ไม่แปลง live/prototype JSON เป็น snapshot จาก GET หรือเพิ่ม fallback.
- Validate unique question/option IDs, typed answers, finite numbers and snapshot maximum/grade sum. Graded summary ต้องตรง normalized scores, complete answer content และ existing exact Decimal score helper. JSON Number ใช้แสดงผลเท่านั้น; pass proof คำนวณด้วย Decimal ก่อน conversion. Zero maximum ไม่ผ่านและ percent=null เพราะไม่มี denominator; ไม่แก้ global Decimal precision.
- Invalid/missing snapshots/inconsistent summary/SQL fault → masked canonical500; ไม่เติม missing grade เป็น0หรือซ่อมข้อมูล. Unrecognized public shapeไม่ส่ง entity ไปให้ client.

## Explicit unresolved boundary

Scope/DB มี `submitted` state แต่ `WireAttemptView.status` มีเพียง in_progress/pending_review/graded. Reader fail closed สำหรับ stored Submitted และไม่ rename state เอง. **Proposed technical resolution:** future atomic Submit ใช้ Submitted เป็น intermediate ใน transaction ก่อน commit final graded/pending_review; ถ้าต้องให้ committed Submitted อ่านได้ ต้อง approve canonical revision + frontend snapshot/decoder ก่อน. ไม่ถือข้อเสนอนี้ว่า D10 ปิดแล้ว.

Full ASSESS-01 start/save/submit, normalized snapshot writer, Grade/Completion orchestration, D06 best result, D09 image ownership/upload, D10 replay/revision และ actual Auth/browser gate ยังไม่ผ่าน. Historical image answer ที่ test เป็น stored fixture; ไม่ใช่ proof ของ production upload หรือการตรวจสิทธิ์ไฟล์.

## Evidence / reproducible checks

- 6 feature unit tests: exact >70 despite wire rounding; mismatched summary/grades; missing actual answers; zero maximum/global Decimal preservation; private metadata/prototype-like opaque ID safety; unresolved Submitted/invalid snapshots.
- 15 actual HTTP/PostgreSQL tests: three canonical states/all four question types, pending grades, private-field omission, edit/delete/archive/reconnect snapshots, self normalized roles, foreign/unknown404, namespace/anonymous/expired/revoked/disabled, post-guard revoke, bad snapshot/Submitted500/no repair, parallel no writes, SQL500 and actual `pg_blocking_pids` grade-writer wait.
- 9 named unchanged `assessmentApi.attempt`/decoder client checks → real fetch/built Nest/isolated PG: open, pending, graded/feedback/keys, foreign Instructor/Admin, anonymous, unknown, corrupt500/no repair, reconnect/no writes, network failure.
- Run typecheck/boundaries/blueprint; components/PG suites; build; smoke; `verify-frontend-detail.cjs` after PG tests finish. Owned fixture cleanup only; no truncate/cloud/prod mutation. Client harness uses config/session fixtures; provider/login/browser and numbered acceptance remain open.

Aggregate counts/exact hosted SHA are recorded in [Execution Status](EXECUTION_STATUS.md) after verification. No contract/dependency/cloud/STG/deployment change.
