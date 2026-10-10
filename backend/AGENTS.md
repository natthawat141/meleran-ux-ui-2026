# Melearn NestJS execution

Confirmed 11 October 2026: NestJS/TypeScript/Prisma/PostgreSQL in this fullstack
repository on `backend/v1-foundation`. Work alone. ASP.NET under
`../legacy/aspnet` is reference only; preserve its history and standalone ENV.

Read the selected task and `../docs/implementation/ARCHITECTURE.md`; consult
Final 1.6 and canonical Draft OpenAPI only for the referenced rules or conflicts.
Use `EXECUTION_STATUS.json` for current readiness; task documents retain planning
baseline. No invented business policy, endpoint or provider protocol.

The Lead is the sole schema/migration owner. Never rewrite an applied migration.
Use isolated `melearn_test` only with explicit migration/reset opt-in. Runtime
never seeds/migrates. ENV and credentials remain ignored. No STG/deploy/new
instance/main overwrite/force push. Commit explicit scoped paths after checks.

Use approved lockfile dependencies. Provider libraries require explicit
justification. Targeted tests per task, contract/authorization/persistence per
feature; CI build at checkpoints. Technical tests are not 113-case acceptance.
