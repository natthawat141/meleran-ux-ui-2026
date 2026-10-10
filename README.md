# Melearn Tutor — Frontend + NestJS Backend

Branch `backend/v1-foundation` in [natthawat141/meleran-tutor](https://github.com/natthawat141/meleran-tutor/tree/backend/v1-foundation).
User confirmed NestJS placement and execution on 11 October 2026.

- `frontend/`: existing React Web/Admin monorepo.
- `backend/`: NestJS/TypeScript/Prisma/PostgreSQL; see [commands](backend/README.md).
- `docs/`: Final 1.6 and canonical Draft OpenAPI; [execution status](docs/implementation/EXECUTION_STATUS.md).
- `legacy/aspnet/`: preserved reference; previous commits also remain in Git history.
- `.github/workflows/`: frontend CI and Nest CI with ephemeral PostgreSQL.

Only this branch changes. No deployment, STG, data migration from ASP.NET, or overwrite of `main`.
Environment, service credentials, installed dependencies and database files remain ignored.
Progress and verified acceptance are tracked separately; prototype handlers are partial.
