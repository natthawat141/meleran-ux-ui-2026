# Melearn NestJS Backend

Execution target for the approved NestJS / TypeScript / Prisma / PostgreSQL V1 blueprint. Source of truth: [business scope](../docs/MELEARN_V1_SCOPE.md), [canonical Draft OpenAPI](../docs/api-contract/openapi.json), [architecture](../docs/implementation/ARCHITECTURE.md), [execution plan](../docs/implementation/EXECUTION_PLAN.md).

## Current verified state — 11 October 2026

FOUNDATION-01 and DB-01/02/05/03/04 completed: shared HTTP bootstrap, strict TypeScript, canonical safe errors, typed LoginRequest boundary, local ENV loading, isolated PostgreSQL migrations and tests. Existing 13 prototype handlers remain partial; this does not mean 86 operations or 113 acceptance cases are complete. Firebase and other provider adapters are pending. See [current execution status](../docs/implementation/EXECUTION_STATUS.md).

Use the existing Cloud SQL instance and dedicated melearn_test database. No STG, deployment, new instance or production migration. Runtime credentials and migration credentials are separate and stored only in ignored .env. Runtime does not seed or migrate; former demo seed is now a test fixture.

## Targeted verification

Node 22+ is required for native ENV parsing (verified locally on Node 24.14.0). Installed lockfile dependencies are reused. pnpm workspace build approvals now cover only the already-approved Nest/Prisma dependencies. Use frozen lockfile installs in CI.

- Typecheck: node node_modules/typescript/bin/tsc --noEmit --incremental false
- Foundation: node node_modules/jest/bin/jest.js --config test/jest-foundation.json --runInBand
- Feature-local units: node node_modules/jest/bin/jest.js --config test/jest-components.json --runInBand
- Build: node node_modules/@nestjs/cli/bin/nest.js build
- Database: set ALLOW_TEST_DATABASE_RESET=yes for this process, then node node_modules/jest/bin/jest.js --config test/jest-database.json --runInBand
- Runtime smoke after build: node scripts/smoke-test-api.cjs (temporary local API, dedicated TEST target, no seed/reset)
- Frontend client integration after build: set process-only ALLOW_TEST_DATABASE_RESET=yes, then node scripts/verify-frontend-detail.cjs; unchanged Catalog client → real Nest HTTP → owned Test PostgreSQL fixtures. Run after database tests finish, since global no-write counts require a quiet database.
- Migration status: node scripts/prisma-test.cjs status
- Reviewed TEST migration only: set ALLOW_TEST_DATABASE_MIGRATION=yes for this process, then node scripts/prisma-test.cjs migrate

The database tests select TEST_DATABASE_URL only after verifying TEST_DATABASE_NAME, PostgreSQL scheme and explicit reset opt-in. They reject a configured application DATABASE_URL that identifies the same reset target. DATABASE_URL is intentionally blank until the local application target is selected; smoke checks inject the test target explicitly.

The old test:e2e suite is guarded before connecting or clearing data. Its 13 prototype tests are compatibility evidence only, not the full business acceptance suite. Do not run them against an application database.

Public CourseDetail and Instructor profile have verified actual HTTP projections. The internal EntitlementWriter and submitted-score calculator are tested prerequisites; they are not authenticated enrollment/payment/assessment endpoints. Auth-owned normalized role writers, eligibility/provider source proofs and full feature gates remain pending. Blog storage/contract gaps are tracked in [CONTRACT_STORAGE_GAPS](../docs/implementation/CONTRACT_STORAGE_GAPS.md).

## Environment and remaining work

Prepared .env contains Firebase public Web config and server project ID plus mapped OpenRouter/Resend/R2/Stripe settings. Public Web config is not an Admin credential. Explicit process environment takes precedence over local .env; no secrets or provider payloads are logged. Missing sender, Firebase server identity, Stripe webhook configuration and D01–D16 decisions remain visible in the plan. No provider smoke calls have been made.

The authoritative Nest target is this fullstack backend on backend/v1-foundation. D13 is confirmed; root Nest CI is configured, and hosted results are tracked separately. The source-only pre-execution snapshot is in ../artifacts/nest-wave1-baseline-20261011 (ENV/databases excluded).
