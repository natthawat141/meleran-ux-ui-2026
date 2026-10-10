# AI-05 — Rename owned conversation

11 ต.ค. 2026 · Component checkpoint. Whole AI-05 ยัง NEEDS_DECISION โดย DELETE/D11; no feature/browser acceptance claim.

## Confirmed scope / canonical contract

- Final 1.6 §2.10, §3.5, §6.11 และ AI13/AI23: Learner/Instructor/Admin เปลี่ยนชื่อเฉพาะแชตตนเอง, ชื่อไม่ว่าง≤80; ไม่เปลี่ยน ID/context/history/quota/academic linkage. Subsequent AI response must preserve manual title.
- `PATCH /api/v1/me/ai/conversations/{id}`; operationId `patch_me_ai_conversations_id`; exact body `{title}`; response200 `WireAiConversation={id,title,course_id,created_at,updated_at}` ตาม [AI-05 subset](contracts/AI-05.openapi.json). WebSession OR AdminSession; foreign owner including Admin hidden404.
- Canonical `1.0.0-draft.1`, SHA-256 `c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3` ไม่เปลี่ยน. No extra endpoint or business policy.

## Technical behavior / observed prototype difference

AI owns feature-local RenameConversationController/Service/Pipe/DTO. Validate exact required string, reject blank-only input and >80 Unicode code points per JSON Schema maxLength; reject ownership/course/context fields. Preserve valid submitted text, including surrounding spaces. Observed prototype trims and uses UTF-16 length; that behavior is reference, not a confirmed normalization policy. Proposed reconciliation for this component: retain canonical Unicode limit and Scope nonblank validation without silently transforming valid titles. Authenticated browser/form normalization remains an integration review item, not claimed closed.

ReadCommitted transaction: Auth `requireSelfRead` holds/revalidates bound identity and normalized Admin namespace → own non-hidden Conversation FOR UPDATE → DB clock → update title/activity only, return explicit persisted five-field projection. No learning eligibility/Course knowledge dependency for owned history. Created time, course/account/context and original Message/Practice/Request/Quota stay unchanged. Same lock order as practice answers; subsequent answer updates activity without replacing title. General conversations remain course_id=null; previous null title can become the validated user title.

Unknown/foreign/hidden404, anonymous/expired/revoked/disabled401, namespace mismatch401/403 and non-Admin Admin session403, invalid body422, malformed JSON400, actual DB failure safe500 with title/activity rollback. No raw private context/keys/proofs serialized. Existing deletedAt predicate tested; no deletion API/retention policy implementation.

## Evidence and remaining gates

- 12 actual HTTP/Test PostgreSQL tests: canonical metadata, 80 Unicode/81/blank/extra claims, foreign Instructor/Admin and own roles, hidden/unknown, fresh identity/session revocation, reconnect/repeat with all 27 counts/history proofs preserved, real PG failure rollback, answer after rename retains manual title, actual competing history mutation waits on transaction.
- 7 unchanged `aiApi.renameConversation`/decoder → built Nest/Test PostgreSQL checks: owner projection/persistence, foreign Instructor/Admin404, anonymous401, blank422, reconnect and network failure. Original message/practice/quota and Enrollment/Progress/Certificate snapshots preserved. Trusted conversation/session fixtures only.
- Full AI-05: still requires AI-02 create/list/history, full Auth, actual generation preserving manual title, authenticated browser G-AI, DELETE/D11 retention and last-chat navigation. AI13/AI23 are not accepted from these component tests; full business acceptance remains0/113.
- No schema/migration/contract/dependency/cloud/STG/deploy change. Keep all 8 applied migration bytes immutable.

Verification: strict typecheck, boundaries/blueprint, foundation/components/PostgreSQL Jest configs, Nest build, runtime smoke and unchanged frontend-client harness. Isolated test target/explicit reset opt-in; cleanup only scoped fixtures.

Verified code SHA: `dc2bf7830eceaf214fc0686175926d9a39de2cb4`; [hosted Nest CI 38089906867](https://github.com/natthawat141/meleran-tutor/actions/runs/38089906867) passed 288 tests + 66 client checks, build/smoke/blueprint/boundaries. Delete retention/provider generation/login/browser and full acceptance remain unverified.
