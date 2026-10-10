# Redeem / Revoke — execution component

11 ต.ค. 2026: REDEEM-01 Admin revoke HTTP + REDEEM-02 internal atomic participant. Whole tasks remain BLOCKED; **public POST /me/redeem, issue/list APIs and G-REDEEM/G-AI are not complete**.

## Confirmed / contract

- Final 1.6 §2.1/2.4/3.3/5.4: Admin only issues/revokes, Unused → Used or Revoked, no expiry, terminal state/audit preserved; one code grants one course once. Admin/own Instructor/unverified account cannot redeem. Existing entitlement returns unchanged without consuming another code; failed grant/transaction leaves Unused.
- Original E04–E13/P08/P12 remain mapped. Technical component tests do not close these end-to-end acceptance cases or imply payment fulfillment is implemented.
- Canonical `1.0.0-draft.1`, SHA-256 `c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3` unchanged. Implemented: `POST /api/v1/admin/redeem-codes/{id}/revoke`, operationId `post_admin_redeem-codes_id_revoke`, optional EmptyRequest → 200 RevokeCodeResponse. [REDEEM-01 subset](contracts/REDEEM-01.openapi.json) includes exact errors/security; no new endpoint.
- HTTP returns only `{id,status:'revoked',revoked_at}`. Unknown ID 404; Used 409 `invalid_state` with `details.reason='used'`; invalid object/array EmptyRequest 422, primitive JSON root 400 from shared parser; unauthenticated 401 / insufficient role or wrong app 403 / internal failure safe 500. Replaying Revoked reads its original result with no audit write, preserving the Draft reference response without permitting a second transition.

## Implemented transaction / ownership

- Feature-local RedeemModule/controller/RevokeCodeService/RedeemWriter; no schema/migration/dependency additions. Shared EmptyRequestPipe is reused by Free Enroll and Revoke; the existing Enrollments import reexports the same pipe. Error details gains typed `reason`, matching the existing canonical Used example.
- Revoke: normalized stored Admin audience/role guard → resource transaction revalidates/holds Session, Account and roles → Code FOR UPDATE → only Unused changes status/revokedBy/revokedAt. PostgreSQL clock_timestamp supplies UTC audit. Revoke does not acquire Course/Enrollment after Code, avoiding a reversed resource lock order. It does not modify course/access/academic/financial state.
- Internal `RedeemWriter.redeem(tx,codeId,accountId,courseId)` is **not HTTP authorization**. Caller owns fresh eligible learner/other-owner checks, approved course lifecycle/type context and Course shared lock, then participant takes Code exclusive lock. Callers use ReadCommitted and the same transaction for all related state; no provider/network work inside it.
- Participant rejects unknown/wrong-course/Used/Revoked, calls the existing owner EntitlementWriter, consumes only a newly created grant and links actual actor/time/enrollment in the same transaction. Existing or concurrently won enrollment returns original source/time/history and keeps this fresh code Unused. No lookup/expiry/case-normalization policy is inferred by a participant that receives a trusted code ID.
- Row lock makes Redeem/Revoke converge; existing same-course FK/unique constraints and final-history triggers enforce the persisted audit. Caller failures after grant or after Code transition roll back both. No independently committed grant, charge, refund, Progress, Certificate or provider event is created.

## Evidence / remaining gates

`test/database/redeem-transaction.pg-spec.ts`: 21 actual PostgreSQL tests; 13 focus on revoke HTTP/auth/validation/persistence and 8 on internal redemption/races. These include original audit/reconnect, repeat/concurrent Admins, Used denial, anonymous/Web/wrong audience/normalized roles/expired/revoked session denial, post-guard role revocation, safe post-SQL rollback, real pg_blocking_pids authority wait, existing Stripe completion/Certificate preservation, no expiry, same-code two-account and two-code one-account convergence, failures, wrong-course/unavailable and **both directions** of observed Code lock wait. Cross-owner internal caller fixtures do not stand in for public Redeem permission tests.

Frontend harness imports the unchanged Admin redeemAdminApi/decoder and only injects its HttpClient configuration. Seven real-client checks cover revoke and reconnect, replay, Used409, unknown404, wrong-app403, anonymous401, network failure; an actual built RedeemWriter creates the Used fixture. No mock transport or frontend source change. Existing Catalog/Free/Learning checks remain 24; new total 31 client checks. No authenticated browser/login-provider gate claimed.

Remaining: REDEEM-01 issue/list and reviewed generation/query/visibility; REDEEM-02 exact public input normalization and allowed Course-state mapping vs prototype Published-only behavior, fresh HTTP eligibility/owner checks, public 200/201 decoder integration; Course/Auth prerequisites; payment interaction/provider and full G-REDEEM delivered together with G-AI. Public HTTP stays absent until those prerequisites are concrete, rather than copying mock behavior into business requirements. Existing planning task scopes are preserved.

Current verification/SHA/CI lives in EXECUTION_STATUS.json. No STG, deploy, live migration or cloud resource changes.

Verified code SHA: `371a0304148910fa87cd5fe6b15cc342f6b4b996`; [hosted Nest CI 38084954707](https://github.com/natthawat141/meleran-tutor/actions/runs/38084954707) ผ่าน 211 tests + 31 client checks, build/smoke/blueprint/boundaries. Public Redeem/issue/list and full browser/provider gates remain unverified.
