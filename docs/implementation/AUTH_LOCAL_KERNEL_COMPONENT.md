# Auth local credential / app session kernel — 11 ต.ค. 2026

Task AUTH-BASE-01, component only. **Confirmed approval**: ผู้ใช้ตอบ “เอาตามนั้นเลย” ต่อสรุป D01/D02/D03; session absolute 12h/no sliding, Web/Admin isolation, Logout current session, password-reset revokes all account app sessions; username ASCII 3–30/case-insensitive uniqueness; new password 8–128 characters; profile omitted preserves/null clears nullable/arrays replace. Firebase owns Email/Google credentials; Nest owns local Username and app sessions; explicit linking/no email auto-merge. Necessary exchange/link contract design is authorized.

Canonical `1.0.0-draft.2`, SHA-256 `b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be`. AdminCreateUserRequest constraints aligned, LoginRequest unchanged. Task context subsets, generated handbook and Frontend snapshot/types synchronized. **No HTTP path added**; inventory stays 86 defined + 5 deferred / 113 acceptance cases.

## Technical implementation

- Auth-private `LocalPasswordService`: async Node crypto PBKDF2-SHA256, 600,000 iterations, random 16-byte salt/32-byte key and strict versioned encoding. Unknown/malformed credentials do bounded dummy KDF work; no legacy hash fallback. Passwords count Unicode code points and preserve whitespace/normalization. [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Node crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html).
- `LocalAuthenticationService`: Username branch only, uppercase ASCII lookup, KDF outside transaction, then credential still current/disabled status/normalized role grants checked under locks. Audience does not grant a role; unverified Email-origin user can login but receives no learning readiness.
- `SessionWriter`: random 32-byte bearer proof, database stores only SHA-256; absolute expiry from PostgreSQL clock. Internal returned secret is for future cookie adapter, absent from user DTO.
- New issuance/reset/revoke-all writers first acquire per-account transaction advisory lock. Revokers acquire sorted Sessions → Account → Credential; fresh principal readers use compatible Session → Account order. Lock prevents new-session phantom during reset scan. Credential update and both-audience revocations commit/rollback together.
- Trusted internal reset participant assumes caller has verified reset authority. It **does not** verify reset/action-link proof or implement the reset HTTP operation. No Auth public barrel export, extra library, schema or migration.

## Verified scope and remaining work

18 real PostgreSQL cases cover durable/canonical sessions, precise expiry/no sliding, fresh role/credential denial, wrong audience/disabled user, isolation, atomic reset, rollback, replay and actual `pg_blocking_pids` observed issuance/reset/reader lock races. Six unit cases cover real KDF, metadata, tampering, Unicode bounds and username normalization. Full checkpoint results and exact hosted SHA are recorded in EXECUTION_STATUS.json after verification.

**Legacy HTTP Login remains quarantined** and does not yet use the new advisory protocol; coordinated issuance/reset guarantee is for new kernel writers. No complete login/reset acceptance claimed. Next: cookie/CSRF/CORS technical review, coordinated legacy cutover, trusted reset caller and Firebase exchange/link/recovery contract/provider integration, then actual browser gate. Numeric throttle limits, production origins and provider proof freshness were not included in the approved summary.

Counts of accepted operations/tasks/waves/cases do not increase from this internal component. AUTH-BASE-01 is READY for remaining kernel/transport work; AUTH-01 still requires the full Username/Email provider flow. D02 constraint policy is confirmed; D01 transport and D03 protocol work must not reopen lifetime/ownership decisions.

## Reproduction

From `backend/`, use existing lockfile dependencies: strict typecheck; boundary/blueprint checks; Jest foundation/components/database configs; Nest build; runtime smoke and actual Frontend client harness. PostgreSQL suite uses only isolated `melearn_test` with process-only `ALLOW_TEST_DATABASE_RESET=yes`; database suites/harness/smoke run sequentially. No runtime seed/migrate, STG, deploy, production mutation or legacy-data migration.
