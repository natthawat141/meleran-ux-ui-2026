# AI-03 — Own daily quota read

11 ต.ค. 2026 · Component checkpoint; AI-03 ทั้งชุดยัง NEEDS_DECISION โดย D12 และ provider/generation prerequisites.

## Confirmed scope / canonical contract

- Final 1.6 §2.10 และ §6.11: 20 **successful** Prompt ต่อบัญชี/วันไทย ทุกบทบาท/คอร์ส; รีเซ็ตวันใหม่เวลา 00:00 Asia/Bangkok, retain history/old-day pending work. อ่าน/จัดการประวัติไม่ใช้ Prompt และอ่านได้แม้เต็มโควตา.
- `GET /api/v1/me/ai/usage`; operationId `get_me_ai_usage`; no body/parameters; response exact `{limit,used,remaining,reset_at}` ตาม [AI-03 subset](contracts/AI-03.openapi.json) `WireAiUsage`. Own Learner/Instructor/Admin, WebSession OR AdminSession; fresh normalized namespace authority.
- Canonical `1.0.0-draft.1`, SHA-256 `c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3` ไม่เปลี่ยน. Draft example limit=2 เป็น illustrative data ไม่ใช่ limit policy; implementation ใช้ Scope=20, ไม่แก้ contract example เอง.

## Technical implementation

AI owns Controller/Service/DTO, `ai.config.ts` และ `quota-window.ts`. Config กลาง AI `AI_DAILY_PROMPT_LIMIT=20`, timezone `Asia/Bangkok`; ไม่กระจายเลขใน runtime feature/UI และไม่มี Admin config endpoint ใหม่. Future limit changes must review DB-05 `success+pending<=20` safety constraint with schema owner.

ReadCommitted caller transaction: Auth `requireSelfRead` holds/rechecks bound Session/Account/normalized roles → one PostgreSQL `clock_timestamp()` instant → explicit PostgreSQL timezone date/next local midnight → same-account/day `AIUsageDaily.successCount` only. One instant prevents date/reset mismatch across midnight; process/session timezone has no effect. `reset_at` is UTC ISO for next midnight Thai time.

Missing row: used=0, remaining=20; no create/reset/delete. Existing row: used=successCount, remaining=20-used. Pending is not successful usage and does not reduce this successful-prompt projection; **GET does not reserve/admit a request**. T1 admission with pending reservations, provider timeout/cleanup/replay/finalization remain separate AI-03/D12 work. No row locks on quota, mutation, provider call, Course knowledge or academic reads/writes. Reject impossible persisted counters safely instead of fabricated/clamped usage.

Account/date/count query claims are ignored by this parameter-free route; cannot select foreign usage or modify quotas. Anonymous/expired/revoked/disabled returns401, namespace/session mismatch401/403, non-Admin Admin session403, actual database failure safe500. No private account/request/reservation/context fields serialized.

## Evidence and remaining gates

- 12 actual Nest HTTP/Test PostgreSQL tests: exact contract; missing today; own roles/same20 limit; client forgery; session/namespace/fresh post-guard authority; reconnect/parallel no-write; actual PG failure; explicit Thai midnight/month/year/leap boundaries in UTC and Honolulu database session timezones. Original old-day pending request/counter snapshots retained.
- 7 unchanged `aiApi.usage`/decoder → built Nest/Test PostgreSQL checks: own Learner/Instructor/Admin counters, anonymous401, exhausted quota still readable, reconnect and network failure; counters and original Enrollment/Progress/Certificate preserved. Trusted stored-session/daily-counter fixtures; no provider or browser acceptance claim.
- AI-03 whole task remains NEEDS_DECISION: no POST messages, real provider generation, durable reservation/finalization/recovery D12, full Auth, history/browser G-AI. Full business acceptance remains0/113; AI18–AI20 are not closed from this read component.
- No schema/migration, canonical HTTP, dependency, cloud/STG/deploy change. Existing 8 migration SQL bytes immutable.

Verification: `typecheck`, `check:boundaries`, foundation/component/database Jest configs, Nest build, runtime smoke, unchanged-client integration and Blueprint gate. Tests use isolated melearn_test/reset opt-in, cleanup only own fixtures.

Verified code SHA: `702b776f8b0399f4627ae3745931cca1f1e6f8fb`; [hosted Nest CI 38089235653](https://github.com/natthawat141/meleran-tutor/actions/runs/38089235653) passed 276 tests + 59 client checks, build/smoke/blueprint/boundaries. Provider reservation/generation/login/browser and full acceptance remain unverified.
