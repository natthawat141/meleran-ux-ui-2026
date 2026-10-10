# AI-04 — Persisted latest practice answer

11 ต.ค. 2026 · Component checkpoint; full AI-04/G-AI ยัง BLOCKED โดย AI-03/provider, Auth และ browser prerequisites.

## Confirmed contract และ scope

- Final 1.6 §2.10/2.11, §3.5, §4.5, §5.12 และ §6.11: Learner/Instructor/Admin ตอบเฉพาะชุดของตน; คำตอบล่าสุดใช้โจทย์เดิม ไม่ใช้ Prompt เพิ่ม ไม่แก้ผลเรียน. AI27–AI29 ยังต้องตรวจ generation/history/UI ครบก่อน acceptance.
- `PUT /api/v1/me/ai/conversations/{id}/messages/{messageId}/practice/answers`; operationId `put_me_ai_conversations_id_messages_messageId_practice_answers`. Request exact `{question_id, option_id}`; response `{question_id, correct, explanation, summary}` โดย summary=null จนตอบครบ. ใช้ [AI-04 subset](contracts/AI-04.openapi.json).
- Canonical `1.0.0-draft.1`, SHA-256 `c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3` ไม่เปลี่ยน; ไม่ freeze decisions ที่ค้าง.

## Reviewed schema และ transaction

Lead/schema owner เพิ่ม migration ต่อจาก applied SQL เดิม; ใช้เฉพาะ `melearn_test`, ไม่มี STG/Production migration.

| Migration | SHA-256 | Delta |
| --- | --- | --- |
| `20261011043000_db05_practice_message` | `612266c0df0d4c516cbd1546cc5ded6f875d8b243d318b55d8cf66dd7ab974be` | General chat มี courseId=null; one-to-one Practice→own assistant Message, composite FK และ immutable identity/payload |
| `20261011044000_db05_practice_message_lock` | `3a23c0e8a4eccc4b7e16494e08f3990b4f05430241aea580f384f4524d632605` | Message FOR SHARE ใน validation trigger กัน race กับ role update; ไม่แก้ migration ที่ใช้แล้ว |

Legacy Practice ที่ messageId=null คงเดิมและไม่เปิดผ่าน route; ไม่มีการเดา/backfill linkage. FK/unique/trigger ตรวจ same owner/conversation/assistant, one practice/message และป้องกัน mutation ของ message identity. ใหม่ควรเขียนด้วย owner transaction ตามลำดับเดียวกัน; D11 retention/delete ยังไม่ตัดสิน.

Answer transaction: fresh bound Auth identity/normalized namespace → Conversation FOR UPDATE → own assistant Message FOR SHARE → linked Practice FOR UPDATE. Validate stable question/option IDs จาก private snapshot, ใช้ DB clock บันทึกเฉพาะ latest selection/time พร้อม Conversation activity; title/context/definitions คงเดิม. PostgreSQL rollback ครอบคลุมทั้งสอง writes. Derive correctness/summary จาก server key; คืน explanation เฉพาะข้อที่ตอบ. ไม่มี provider call, quota/request, QuizAttempt/Progress/Enrollment/Certificate writes.

Internal **technical serialization**, ไม่ใช่ provider/business contract: `payloadSnapshot={version:1,questions:[{id,prompt,options:[{id,text}],correct_option_id,explanation}]}`; `answers[questionId]={option_id,answered_at:UTC ISO}`. Reject corrupt versions/IDs/options/answers แบบ safe500 โดยไม่ซ่อมข้อมูลหรือเผย private keys. AI-03 ต้อง validate/serialize format นี้เมื่อ generation พร้อม; ไม่คัดลอก provider result ตรง ๆ.

## Evidence และ gates ที่ยังเหลือ

- 6 snapshot unit tests; 6 actual PostgreSQL schema tests รวม eight-migration DDL rollback/checksum/general FK/legacy preservation และ blocking-role race ทั้งสองลำดับ.
- 14 actual Nest HTTP/PostgreSQL answer tests: contract/permissions/latest/multiple tabs/reconnect/forged input, fresh identity, safe corrupt-state errors, actual DB failure rollback และเดิม quota/academic values ไม่เปลี่ยน.
- 8 unchanged `aiApi.answerPractice`/decoder → built Nest → Test PostgreSQL checks; fixture เป็น trusted persisted practice/session ไม่ใช่หลักฐาน provider generation/login/browser acceptance.
- Whole 113-case acceptance ยัง 0/113. Full AI-04 ต้อง AI-03 generation, AI history read/reconnect, full Auth และ authenticated browser G-AI. D11/D12/provider lifecycle ยังเปิด; task status ไม่เปลี่ยนเป็น DONE จาก fixture tests.

Verification: foundation/component/database configs ใน `backend/test/`, `typecheck`, `check:blueprint`, `check:boundaries`, Nest build, `scripts/smoke-test-api.cjs` และ `scripts/verify-frontend-detail.cjs`; schema parity ตรวจจริงบน Test PostgreSQL. Tests ใช้ isolated target/explicit reset opt-in และล้างเฉพาะ fixtures ของตน.
