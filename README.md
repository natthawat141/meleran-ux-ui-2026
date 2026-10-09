# Melearn Frontend

React + TypeScript monorepo: `apps/web` สำหรับ Guest/Learner/Instructor และ `apps/admin` สำหรับ Admin; build/deployment แยกกัน. ขอบเขตธุรกิจใช้ [Final 1.6](docs/MELEARN_V1_SCOPE.md). ยังไม่มี Production Backend.

Business data ใช้ HTTP client + TanStack Query กับ API mock; ถอน root `src`, `@legacy` และ `packages/store` แล้ว. Mock เก็บข้อมูลใน memory ร่วมกัน ขณะที่ cookies/query cache แยก app/account. Restart mock ล้างข้อมูล. Unsaved editor drafts อาจอยู่ใน sessionStorage; ไม่ใช่ business source of truth.

## เริ่มพัฒนา

```powershell
npm.cmd ci
npm.cmd run dev:web
npm.cmd run dev:admin
```

Web default `http://127.0.0.1:5173`, Admin `http://127.0.0.1:5174`, API mock `127.0.0.1:8787` ผ่าน Vite proxy `/mock-api/v1`. Vite plugins เริ่ม/reuse server ร่วมกัน. บัญชีทดสอบและ reset behavior ดู [Mock guide](docs/PROVISIONAL_API_MOCK_TH.md).

```powershell
npm.cmd run contracts:setup
npm.cmd run contracts:check
npm.cmd test
npm.cmd run typecheck
npm.cmd run check:boundaries
npm.cmd run build
```

Build outputs: `dist/web`, `dist/admin`. `VITE_API_MODE=mock|remote`, `VITE_API_BASE_URL`, `VITE_API_CREDENTIALS` เป็น build-time config; default dev=mock, build=remote (`/api/v1`). API unavailable แสดง error. Production frontend containers ไม่รวม mock และยังต้องต่อ Backend URL/proxy/CORS/session policy.

HTTP contract source: [OpenAPI Draft](packages/contracts/openapi/openapi.json), generated types export `@melearn/contracts/http`. การแก้ schema ให้ generate/check ตาม [R4a guide](docs/API_CONTRACT_R4A_DRAFT_TH.md); Backend ยังต้อง review/freeze ต่อ flow.

## อ่านต่อ

- [Docs index](docs/README.md), [UI Spec](docs/UI_SPEC.md), [Code Spec](docs/CODE_SPEC.md), [AGENTS](AGENTS.md)
- [Frontend plan](docs/FRONTEND_REFACTOR_PLAN_TH.md), [current progress/known gaps](docs/R7_API_MOCK_PROGRESS_TH.md)
- [API Draft พร้อม Screen HTTP JSON](docs/API_CONTRACT_R4A_DRAFT_TH.md), [Auth/Catalog Draft](docs/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md)
- [Acceptance matrix](docs/FRONTEND_API_ACCEPTANCE_MATRIX_TH.md), [Release matrix](docs/FEATURE_RELEASE_MATRIX.md)

Draft contracts ใช้ส่งต่อ Backend ได้ แต่ต้อง review/freeze และตรวจ real integration ก่อน Production. YouTube อยู่ใน V1; Google/email/upload/Stripe/AI provider จริงยังไม่พร้อม. Mock tests/build ไม่ยืนยัน deployment หรือ security/persistence ของ Backend จริง.
