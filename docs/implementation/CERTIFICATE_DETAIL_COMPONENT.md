# CERT-01 — Owned historical certificate detail

11 ต.ค. 2026. Single canonical metadata read implemented; list, automatic issuance, download and full feature acceptance remain open.

## Confirmed and traceability

- Final 1.6 §2.7/3.2/5.7/6.7; original F02/F04/F06/F08 remain mapped to CERT-01. An issued certificate belongs to one completed Enrollment and retains the recipient/course name, issue date and code after later edits. GET detail verifies ownership; it does not issue a certificate or recalculate completion.
- Canonical `1.0.0-draft.1`, SHA-256 `c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3` unchanged: `GET /api/v1/me/certificates/{id}` / `get_me_certificates_id`; no request body; 200 `WireServerCertificate` with exactly id/code/course_id/course_title/learner_name/issued_at/enrollment_id. See [CERT-01 subset](contracts/CERT-01.openapi.json).
- Owner-only read is distinct from eligibility to create an Enrollment or learn. Scope's email-verification restriction applies to new Checkout/Enroll/Redeem/learning, not this historical self-read. A later role/profile change or course archive does not rewrite an issued certificate. Admin/Instructor management permission cannot read another account's certificate through this self endpoint.

## Implementation and technical boundaries

- Certificates owns feature-local controller, read service, typed DTO and module. Auth public requireSelfRead resolves and holds fresh Session/Account/normalized-role rows before the resource read; dual audience remains bound to the stored session and Admin namespace requires a current normalized Admin role. No cookie/login/provider policy changes.
- Owner-filtered join first holds the Enrollment, then rechecks and holds the same linked Certificate before selecting private names. Foreign/unknown IDs share safe 404 (resource concealment, consistent with the existing Draft flow); anonymous/revoked/expired/disabled sessions fail 401, invalid audience/namespace authority 403. Actual DB errors remain safe generic 500.
- Explicit projection selects issue-time certificate fields and Enrollment.courseId/completedAt only; no current Course/Account profile, completion_snapshot, answer keys, Resume, raw Transcript, renderer/file or provider data is serialized. DB-02 protects original issuance and completion linkage; malformed completion fails closed without repairing data.
- Lock order: Auth session/account/roles → owned Enrollment shared → same Certificate shared; matches Enrollment-before-Certificate for a future completion issuer rather than depending on a join's lock order. No Course lock, write, automatic issue participant, migration or dependency installation. This read does not inspect current item counts or invalidate historical completion.

## Verified component evidence and remaining gates

- `test/database/certificate-read.pg-spec.ts`: 13 actual HTTP/PostgreSQL tests; canonical seven-field projection, foreign learner/Instructor/Admin and unknown 404, owned historical record through Web/Admin, namespace forgery, session expiry/revocation/disable, historical self-read after readiness/role changes, rename/archive/additional content/reassignment, concurrent/reconnect with all 27 model counts and academic history unchanged, post-guard authority recheck, real DB failure masking, observed concurrent disable lock wait and Enrollment-before-Certificate wait with a competing fixture transaction rolling back without deadlock.
- Frontend harness uses the unchanged actual certificateApi.get/decoder and HttpClient with fixture-only singleton configuration. Seven checks cover owner projection, foreign Instructor/Admin, anonymous/unknown, rename/archive/reconnect and network failure. A trusted historical completed fixture is not automatic Completion/Certificate issuance evidence. No frontend source or browser/UI behavior changed.
- Aggregate counts, code SHA and CI evidence are recorded in EXECUTION_STATUS after checks. F02/F04/F06/F08 are not declared fully accepted from component checks. Full Auth/normalized writers, actual automatic completion, list query policy and D07 file delivery/download/browser G-CERTIFICATE remain open. No new endpoint, public certificate verification page, cloud/STG/deploy or production migration.
