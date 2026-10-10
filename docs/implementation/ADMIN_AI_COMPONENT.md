# Admin AI settings / Transcript — execution component

11 ต.ค. 2026. เป็น component ของ AI-01 และ session-resolution subset ของ AUTH-BASE-01; ไม่ปิด Auth/provider/Course-authoring task ทั้งชุดจาก fixture tests.

## Source และ operations

Confirmed business: Final 1.6 §1.2 permission `ai.configure_course` / `ai.manage_knowledge`, §2.9, §6.11, AI01–AI05/AI09–AI10. Admin เท่านั้นตั้งค่า AI และแก้ Transcript; Plain Text เก็บบรรทัด/timestamps; AI-only save ไม่เปลี่ยน learning draft, review, progress หรือ certificate. AI acceptance IDs เหล่านี้ยังต้องตรวจ full feature/browser gate.

Canonical HTTP: OpenAPI `1.0.0-draft.1`, SHA-256 `c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3` **ไม่เปลี่ยน**. Request/response ใน [AI-01 subset](contracts/AI-01.openapi.json):

| Method / path (prefix `/api/v1`) | operationId | Input → output |
| --- | --- | --- |
| PATCH /admin/courses/{id}/ai-support | patch_admin_courses_id_ai-support | AiSupportRequest → AiSupportResponse |
| GET /admin/courses/{id}/videos/{itemId}/ai-transcript | get_admin_courses_id_videos_itemId_ai-transcript | no body → WireAdminTranscript |
| PUT /admin/courses/{id}/videos/{itemId}/ai-transcript | put_admin_courses_id_videos_itemId_ai-transcript | TranscriptRequest → WireAdminTranscript |

## Principal / authorization component

Auth owns `public/PrincipalService`; public barrel exports its minimal types/interface. Resolve hashes the session proof using the existing SHA-256 format and reads AppSession + fresh Account + **normalized UserRole**. Expired/revoked/wrong-audience/disabled/unknown-origin proofs fail closed. No password/profile/provider/raw-secret data is returned. Resolution does not issue, refresh, revoke or migrate sessions.

`learningEligible` is account verification/readiness for Learner/Instructor, excluding Admin: admin-created accounts need no email; self-email/Google require the server's verified flag. Origin `google` alone is not provider proof. This flag does not grant Enrollment or replace course/source eligibility checks.

New `AuthoritativeAudience('admin')` guard opt-in uses the current Admin cookie + exact `x-melearn-app: admin`, and normalized roles. Compatibility comma-string roles and client role/audience claims cannot supply Admin authority. The new AI handlers use this opt-in. Existing prototype handlers remain on their tracked legacy path; **global cookie/TTL/CSRF/password/login/provider policy is still D01–D03**, and normalized role/session writers are not fully cut over. No fallback from missing normalized roles to compatibility roles.

Service revalidates authority inside the caller's PostgreSQL transaction. Shared locks on AppSession/Account/UserRole precede resource locks, so concurrent logout/disable/role deletion waits until the authorized operation finishes. Read-only GET also uses this boundary. This is transaction mechanics, not a new session-revocation business policy.

## Ownership / transactions

- `AiModule` owns VideoTranscript persistence. Course AI flag writes go through the exported **Course-owned AiSupportWriter**, not a cross-owner Prisma mutation.
- PATCH: authority locks → Course `FOR UPDATE` → update **aiEnabled only**. Learning revision, content status, published_at, updated_at and review history remain intact.
- GET/PUT: authority locks → Course shared lock → same-Course Chapter/video shared lock → transcript read/atomic upsert. Wrong course, article or missing video returns 404 before any write.
- PUT preserves exact text, including empty replacement; server sets editor id and `clock_timestamp()` on TIMESTAMPTZ. Unique itemId + atomic upsert handles concurrent replacements without duplicate rows. No request_id/ETag protocol is invented.
- Empty transcript GET returns `{item_id,text:'',edited_by:null,edited_at:null}` without creating a row. Disabling support preserves stored Transcript. Public CourseDetail never includes raw Transcript/editor fields.
- No network/provider calls, migration, seed or reset in runtime.

## Validation / transport limits

Typed DTOs reject omitted/null/wrong types/additional fields. Canonical text maximum is **200,000 Unicode characters**. The specific Transcript PUT JSON parser permits 3 MiB so fully escaped astral Unicode at this maximum fits (up to 2.4 MB plus envelope). Other JSON requests retain 100 KiB; Stripe remains raw 100 KiB. Both JSON parser branches are explicitly registered before Nest defaults; known parse/limit/encoding errors map to safe 400/413/415 without echoing body or diagnostics. No global increase of browser API body limits.

## Verification / remaining work

8 internal principal PostgreSQL tests: fresh normalized roles, no private projection, Web/Admin isolation, expiry/revocation/disable, readiness/provenance, stale-reference rejection, actual concurrent revocation lock wait and reconnect/no refresh.

13 actual Nest HTTP/PostgreSQL tests cover all 3 operations: canonical serialized schemas, empty/no-write GET, true/false persistence, plaintext/replacement/reconnect/audit, permission spoofing/audience/lifecycle/role deletion, strict validation, escaped Unicode maximum, cross-course/non-video 404, concurrent replacements, real transaction rollback after write and no diagnostic leak, unchanged existing approval/Quiz/Enrollment/Progress/Certificate snapshots and public field visibility.

Backend regression now 49 foundation + 16 feature units + 91 PostgreSQL/HTTP = **156 tests**. Full task/feature gate remains blocked by Auth/provider and authoring integration prerequisites. These tests use owned fixtures on `melearn_test`; they do not prove actual login, complete frontend editor/browser behavior, provider delivery or any of the 113 full business cases. No contract/schema/dependency/cloud/STG/deploy change.
