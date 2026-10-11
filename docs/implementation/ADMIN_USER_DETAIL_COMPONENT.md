# MGMT-01 — Bounded Admin user detail

11 ต.ค. 2026 · HTTP component; whole MGMT-01/G-MANAGEMENT not accepted.
Canonical Draft `1.0.0-draft.1`, SHA256 `c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3`.

## Source and exact boundary

`GET /api/v1/admin/users/{id}` / `get_admin_users_id`; no body; 200 AdminUserDetailDto. Read MGMT-01 and its contract subset; Scope §2.1/2.2/3.4/6.2/6.9 governs identity and Admin management. Canonical permission is Admin account management, AdminSession only. No new endpoint, request/query field or permission.

Fresh normalized Admin plus matching Admin session/header is mandatory; caller claims and compatibility role strings never confer authority. Canonical permits self, other roles and another Admin as targets. Unknown target404; missing/invalid proof401; mismatched header/non-Admin403; stored shape/SQL failure safe500. The target path controls selection; extra query claims do not select hashes or another user.

Management controller/service supplies a ReadCommitted transaction to Auth public AdminUserDetailReader. Auth owns Account/UserRole/credential/linked-identity reads and uses a bounded field selection: identity metadata, profile JSON, createdAt; local credential accountId existence and external method only. No password hash, provider subject, session proof, creator/Instructor audit or academic/context data is selected/returned as detail. Response explicitly maps required nullable identity fields, normalized roles, deduplicated methods, created_at and canonical profile whitelist; no learning_eligible or persistence entity spread.

## Locking and schema differences

Session shared → actor/target Accounts sorted by ID shared → fresh Admin proof/roles → target normalized roles → projection. Sorting before requireAdmin matches Instructor grant-writer Account ordering and prevents cross-Admin lock inversion. Target profile/identity writers must hold Account exclusive before child updates; reads serialize with those writers. Auth-role writers retain original Account-first convention. No read-repair, grant, verification, credential/session change or startup/read side effect.

AdminUserDetailDto has an inline profile with no array cap. CurrentUser.AccountProfile has maxItems30. Auth-local projector retains the default30 for self/grant and takes the canonical Admin no-cap mode only for this facade; 31-item Admin arrays are not truncated or rejected. Recognized profile types are validated; unknown/private keys are dropped. Missing normalized target roles fail closed instead of inferring legacy roles.

Draft status projection retains pending for unverified self_email and active otherwise. This follows existing Draft wire behavior; it does not approve a general activation/disable policy. Scope confirms unverified self-email can log in but cannot start learning, while Admin-created accounts need no email verification to learn. Detail enum has no disabled value/field: Admin can inspect a disabled target without changing disabled/session authority, and that target's self request remains401. The status/disable interpretation gap stays open under D02/D03; no new enum, silent verification or authorization based on this displayed status.

Legacy Management detail getter removed. AST comparison proves all remaining prototype methods, including Account creation writer, are byte-identical after newline normalization; only its tracked quarantine file hash changes. Remaining creation/list/Instructor-directory behavior is still unverified and not approved by this read component.

## Evidence and remaining gates

18 actual HTTP/Test PostgreSQL cases: exact profile/method/null/date/role projection, Admin inline array versus self cap, own/other Admin, Draft verification metadata, namespaces and role tampering, expired/revoked/disabled and post-guard revocation/role removal, path/query tampering/unknown404, disabled-target inspection, missing normalized target roles, corrupted profile and real SQL failure, reconnect/parallel all27 counts/identity rows unchanged, actual target writer pg_blocking_pids wait, opposite Admin read/grant coordination.

10 unchanged actual Admin resources.ts/decodeManagementResponse → built Nest/Test PostgreSQL checks: bounded detail, self/other roles/null fields, normalized grant→detail parity, 31-item profile roundtrip, namespace403, non-Admin bound proof403, unknown404, anonymous401, reconnect/all-model/academic preservation and network failure. Only singleton configuration/session fixtures are injected; fetch/decoders remain actual. This is transport/decoder evidence, not React hook/page/browser acceptance.

Whole MGMT-01 remains NEEDS_DECISION: D02/D03 normalized creation/credentials/provider/status protocol, D16 directory/search/cursor and privacy review, complete Auth and actual Management browser gate/A07/A08. Original113 acceptance cases remain open. No schema/migration/library/contract/provider/cloud/STG/deploy change; all nine migration checksums retained.

Local regression checkpoint: 49 foundation + 28 feature units + 332 PostgreSQL = 409 tests; 124 client/transport checks including10 detail checks. [Hosted Nest CI 38097574321](https://github.com/natthawat141/meleran-tutor/actions/runs/38097574321) passed exact code SHA `008c9e8cd62933e734330f5a1ae4d9531959d721`; full task/feature/acceptance remain open.
