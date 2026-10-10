# Melearn Frontend

ชื่อโฟลเดอร์ workspace: `melearn-tutor-frontend`. เอกสาร API Contract หลักย้ายไป [shared docs](../docs/api-contract/README.md); OpenAPI ใน package เป็น snapshot สำหรับ standalone clone/CI. แก้ canonical แล้วใช้ `npm run contracts:sync` ก่อน generate/check; Git remote เดิมไม่เปลี่ยน.

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

## Cloud Run Frontend

Target ที่ผู้ใช้ยืนยัน 10 ต.ค. 2026: project `melearn-tutor`, Bangkok `asia-southeast3`, services `melearn-web` และ `melearn-admin`. แต่ละ service ใช้ 1 vCPU / 256 MiB, first-generation runtime, request-based CPU, minimum instances 0 และ maximum instances 1 ทั้งระดับ service/revision. ไม่เปิด startup CPU boost. Cloud Run maximum instances เป็น scaling limit; อาจเกินชั่วคราวระหว่าง platform events ตาม [ข้อจำกัดของ Google](https://docs.cloud.google.com/run/docs/configuring/max-instances).

```powershell
.\scripts\deploy-cloud-run.ps1
# Default = mock preview ที่ทดลองใช้งานได้เหมือน local
# หลัง Backend พร้อม: -DeploymentMode remote -ApiBaseUrl https://<api-origin>/api/v1
```

Default deployment เป็น **mock preview**: [Mock Cloud Build](containers/cloudbuild.mock.yaml) build `VITE_API_MODE=mock`, `VITE_APP_ENV=preview`, `/mock-api/v1`. Web container ให้บริการ SPA และ mock ใน memory; Admin container ให้บริการ SPA และ forward mock requests ไป Web โดย cookie อยู่ origin ของแต่ละ app และ audience แยก Web/Admin. มีสอง Cloud Run services เท่านั้น. ไม่ใช้ API/provider keys จริง ไม่ส่งอีเมลหรือตัดเงินจริง และไม่ใช่ Production Backend. ข้อมูล mock เริ่มใหม่เมื่อ Web instance หยุด/restart รวมถึง scale to zero; refresh หรือ login ใหม่หลัง session หาย. บัญชี Learner `learner@example.test`, Instructor `instructor-a@example.test`, Admin `admin` ใช้รหัส `mock-password-1` (ข้อมูลสมมติสำหรับ demo).

`-DeploymentMode remote` ใช้ [Static Cloud Build](containers/cloudbuild.yaml) และต้องกำหนด Backend URL ที่ใช้งานได้เอง. ทั้งสอง mode build บน Cloud Build ไม่รัน local Docker; ignore files ตัด local configuration/secrets ออกจาก upload. Mock อยู่ฝั่ง server ใน `tools/mock-preview` และไม่เข้า frontend/shared package runtime.

สถานะ 10 ต.ค. 2026: mock preview deploy สำเร็จจาก source `1819db7410cc` บน `main` ผ่าน [Cloud Build](https://console.cloud.google.com/cloud-build/builds;region=asia-southeast3/b941b630-eac7-47cc-a957-792c3ab5d76c?project=melearn-tutor) และ [Frontend CI](https://github.com/natthawat141/meleran-tutor/actions/runs/38059476415). ชุด local tests ผ่าน 173 tests รวม adapter/session boundary. ไม่ใช้ local Docker.

| App | Live URL | Ready revision |
| --- | --- | --- |
| Web | https://melearn-web-963924709921.asia-southeast3.run.app | `melearn-web-00004-znc` |
| Admin | https://melearn-admin-963924709921.asia-southeast3.run.app | `melearn-admin-00004-lsn` |

ตรวจค่าบริการจริงแล้ว: Bangkok, CPU 1 / RAM 256 MiB, min 0 / max 1 ทั้ง service/revision และ traffic 100% ต่อบริการ. Runtime ใช้ `melearn-frontend-runtime` ที่ไม่มี project roles; แยกจาก default Cloud Build identity ซึ่งได้รับ `roles/cloudbuild.builds.builder`. HTTP `/health` ตอบ 200 และ `ok` ทั้งสองบริการ; หน้าแรก/deep links และ JS/CSS ตอบ 200, assets มี immutable cache. Public health ใช้ `/health`. Static remote image ยังคงใช้ `/healthz` ภายใน container ได้ แต่ public Google frontend ไม่ส่ง path นี้ถึง container ในการตรวจครั้งก่อน.

ตรวจ HTTP flow บน Cloud จริงผ่าน: Login และ `/me` ของ Learner/Instructor/Admin, Catalog → enroll ฟรี → เปิดบทเรียน → complete, Admin users/Blog, Instructor/Admin เห็นข้อมูลคอร์สชุดเดียวกัน และ logout Web ไม่กระทบ Admin session. หน้า SPA/deep link กับ JS/CSS โหลดผ่านและมี `X-Melearn-Deployment: mock-preview`. เครื่องมือ browser เปิดไม่ได้ (`failed to write kernel assets`) จึงยังไม่ได้ตรวจการคลิก UI ใน browser รอบนี้. ผลตรวจนี้เป็น mock acceptance ไม่ยืนยัน Backend/provider จริง.

## อ่านต่อ

- [Docs index](docs/README.md), [UI Spec](docs/UI_SPEC.md), [Code Spec](docs/CODE_SPEC.md), [AGENTS](AGENTS.md)
- [Frontend plan](docs/FRONTEND_REFACTOR_PLAN_TH.md), [current progress/known gaps](docs/R7_API_MOCK_PROGRESS_TH.md)
- [API Draft พร้อม Screen HTTP JSON](docs/API_CONTRACT_R4A_DRAFT_TH.md), [Auth/Catalog Draft](docs/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md)
- [Acceptance matrix](docs/FRONTEND_API_ACCEPTANCE_MATRIX_TH.md), [Release matrix](docs/FEATURE_RELEASE_MATRIX.md)

Draft contracts ใช้ส่งต่อ Backend ได้ แต่ต้อง review/freeze และตรวจ real integration ก่อน Production. YouTube อยู่ใน V1; Google/email/upload/Stripe/AI provider จริงยังไม่พร้อม. Mock tests/build ไม่ยืนยัน deployment หรือ security/persistence ของ Backend จริง.
