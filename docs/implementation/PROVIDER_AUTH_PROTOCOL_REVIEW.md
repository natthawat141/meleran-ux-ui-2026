# Firebase Auth — technical review packet

11 ต.ค. 2026 · PROVIDER-AUTH-01 / AUTH-01–03 / DB-06. Approved ownership/linking direction; **proposals below are not additional canonical operations**. Baseline Draft.2 SHA `b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be`. Read Scope §2.1/§5.8 and this packet; no need to reread the full handbook.

## Confirmed boundaries

Firebase owns Email/Google credentials, Nest owns local Username/app sessions. Self-signup creates Learner; unverified Email can login but cannot learn/buy/redeem/enroll. Admin-created local account needs no email and is immediately learning eligible. Linking requires existing account login, preserves identity/history/roles and never merges by matching email. Scope verification is a Resend-delivered, server-timed, one-use 24h link.

Current `ExternalIdentity` supports unique `(provider,project,subject)` with Account FK; `method` is credential metadata, never authorization. Current session/local kernel exists; durable verification/reset/link challenge state is still DB-06 work. Firebase public Web config is not server credential evidence.

## Proposed wire delta for the next reviewed revision

| Use case | Candidate wire | Required behavior |
| --- | --- | --- |
| Email/Google sign-in after Firebase client authentication | `POST /auth/firebase/exchange`, JSON `{id_token,audience}` | `200 {user:CurrentUser}` plus selected HttpOnly app cookie; checked provider identity, fresh normalized role/disabled/readiness state; Admin audience cannot create an Admin role |
| Attach Firebase identity to logged-in account | `POST /auth/firebase/link`, JSON `{id_token}` plus existing app cookie/header | Return canonical current account; bind to original Account, reject identity already owned elsewhere, preserve local credential/roles/academic history; same-link replay has no duplicate writes |
| Username login | Keep `POST /auth/login` / LoginRequest | Use local kernel; Email branch migration must have explicit Frontend compatibility plan, not silently accept Firebase passwords as local |
| Register/verify/resend/forgot/reset | Existing canonical operations retained pending protocol reconciliation | Resolve remote credential/delivery vs local proof ownership, recovery for linked local accounts and all-app revocation; no fake 24h enforcement based only on provider link defaults |

Necessary exchange/link design is authorized; exact request limits/status/error schemas, reauthentication proof freshness and legacy four Google deferred replacement mapping remain review work. Draft.2 still tracks 86 defined + 5 deferred; the next revision must document any inventory change explicitly rather than hiding old records.

## Token and transaction design to review

1. Verify server-side ID token signature, issuer, configured project audience, expiry and UID. Default SDK verification does not check revocation; use the explicit revocation check for proposed exchange/link verification. Do not trust client `email_verified`, UID or roles. [Firebase ID token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [revocation API](https://firebase.google.com/docs/auth/admin/manage-sessions).
2. Perform remote verification outside PostgreSQL transaction, then recheck local binding/account/session authority under transaction locks. Persist checked `(project,uid)`; no email-derived identity join or client-defined grant.
3. Existing binding uses its original Account. New verified Google/signup identity may create only the Scope-approved Learner origin. Email/password exchange must not bypass canonical registration and approved password constraints: review a server-controlled registration/binding record before allowing first mapping of an arbitrary Firebase Email user. Matching an existing email without binding requires existing-account login/link; it cannot select the target account automatically.
4. Link acquires fresh current-session authority, account advisory serialization and identity uniqueness. Define a lock order compatible with kernel Session → Account readers before implementation. Unique conflict/replay/rollback must preserve original owner and all academic data.
5. Reset requires a verified one-use purpose/account-bound proof, consumes it atomically with local state, revokes all app audiences and handles Firebase remote side effects/retries outside transaction. Specify revocation watermark/outbox if remote reset and database commit cannot be atomic; do not claim current internal password participant implements that protocol.

Firebase provides generated action links for a custom mail sender, but the cited mechanism alone does not establish Melearn's exact 24h proof lifetime. Review the custom action handler and durable Melearn proof boundary before implementing verification/recovery. [Firebase action-link generation](https://firebase.google.com/docs/auth/admin/email-action-links).

## Dependency and verification gates

Proposed dependency: official `firebase-admin` for checked token/user/action operations; justification is avoiding a hand-written JWT/key rotation/provider implementation. Select/pin a compatible release and review transitive lockfile delta before installation. No SDK was installed in the kernel checkpoint. Reuse approved Node crypto for local credentials; do not add Firebase Analytics to backend.

- Contract gate: reviewed delta, decision ledger/version/hash, task subsets, Frontend generated schemas, explicit old deferred mapping and unchanged 113 acceptance IDs.
- Unit/provider boundary: wrong issuer/project/expired/revoked/disabled/fake/custom token, unsupported sign-in method, empty proof, provider failure and redacted errors/logs.
- PostgreSQL: original-account binding, email collision without auto-merge, concurrent unique identity conflict, same-link replay, disabled/revoked-after-guard, rollback, session issuance/reset race and no duplicate history/role writes.
- Browser/provider: Web/Admin cookies and Origin checks, Email unverified login/readiness, Google and local login into the same linked account, no cross-audience logout, real sandbox reset/revoke and Resend delivery; emulator/adapter tests alone do not pass provider acceptance.
- Environment: verify server project/credential availability and Resend sender through metadata only. No new IAM/key, real user changes or live mail in this review packet.

Technical review can proceed from the approved direction. Remaining protocol details are separate from the already approved lifetime/constraints/ownership decisions.
