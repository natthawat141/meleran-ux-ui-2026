# Melearn API

ASP.NET Core .NET 10 · Clean Architecture + Feature-first / use cases · Backend foundation

Git: private repository [natthawat141/melearn-tutor-api](https://github.com/natthawat141/melearn-tutor-api), branch `backend/v1-foundation`. ผู้ใช้สั่งพักการเขียน API และเก็บ code ขึ้น Git วันที่ 10 ต.ค. 2026; ยังไม่ deploy Backend. `.env`/generated output ไม่ได้ขึ้น Git; shared scope/contract ฉบับหลักยังอยู่ใน workspace sibling `../docs`.

เริ่มพัฒนา 10 ตุลาคม 2026 ตามคำสั่งผู้ใช้. มี EF Core/PostgreSQL adapter + migrations และ 13 business operations สำหรับ local Username Auth/Profile, Admin accounts/Instructor assignment และ Catalog/Free Enrollment. ยังไม่ apply Cloud SQL หรือทำ Firebase/provider integrations. Frontend ยังใช้ HTTP mock; ไม่เปลี่ยน base URL ทั้งระบบจน endpoint ที่เกี่ยวข้องพร้อม. [สถานะ feature และวิธีตั้งค่า](docs/FEATURE_DELIVERY_STATUS_TH.md).

## เริ่มใช้งาน

ต้องมี SDK `10.0.400` ตาม `global.json` (รองรับ patch ใหม่ของ feature band เดียวกัน).

```powershell
cd D:\code\elearn-prod\melearn-tutor-api
dotnet restore Melearn.slnx --locked-mode
dotnet build Melearn.slnx --configuration Release --no-restore
dotnet test Melearn.slnx --configuration Release --no-build --no-restore
dotnet run --project src/Melearn.Api --launch-profile http
```

HTTP dev host: `http://127.0.0.1:5100`.

### Local environment

Cloudflare R2: กรอก `CloudflareR2__AccountId`, `CloudflareR2__BucketName`, `CloudflareR2__ServiceUrl` (S3 API endpoint จาก Cloudflare), `CloudflareR2__AccessKeyId` และ `CloudflareR2__SecretAccessKey` ใน `.env` ฝั่ง Backend. `CloudflareR2__PublicBaseUrl` เป็น public/custom domain ถ้ามี; private bucket เว้นว่างได้. ยังไม่มี upload adapter; ช่องเหล่านี้เป็นการเตรียม configuration เท่านั้น.

คัดลอก `.env.example` เป็น `.env` และกรอก `OpenRouter__ApiKey`, `OpenRouter__Model`, `Resend__ApiKey`, `Resend__From` และ Firebase project/credential path เมื่อพร้อม. `.env` ถูก Git ignore; private credential file ให้เก็บนอก repository. Frontend ใช้เฉพาะ Firebase public client config; ห้ามนำ OpenRouter/Resend API keys ไปใส่ `VITE_*`.

```powershell
Copy-Item -LiteralPath .env.example -Destination .env # เฉพาะเมื่อยังไม่มี .env
.\scripts\dev.ps1 -CheckOnly
.\scripts\dev.ps1
```

ASP.NET Core อ่าน process environment แต่ไม่อ่าน `.env` โดยอัตโนมัติ. Script นี้โหลดค่าแล้วเรียก `dotnet run --no-launch-profile` เพื่อให้ URL/environment จากไฟล์มีผล; หลังหยุด process จะคืนค่า environment เดิม. Blank placeholders ไม่ทับค่าที่ตั้งไว้ภายนอก. ไม่รองรับ multiline, variable interpolation หรือ inline comments; syntax check ไม่ได้ตรวจว่า key/model/sender ใช้งานกับ provider ได้จริง.

OpenRouter key/model/base URL ตั้งผ่าน `OpenRouter__ApiKey`, `OpenRouter__Model`, `OpenRouter__BaseUrl` ใน `.env` ฝั่ง Backend เมื่อรันด้วย script หรือ process environment/secret configuration บน hosting. `appsettings*.json` ไม่มี OpenRouter model fallback; ไม่เลือก paid model โดยอัตโนมัติ. การรัน `dotnet run` ตรง ๆ ไม่โหลด `.env`.

`bin/` และ `obj/` เป็น generated build output ที่ Git ignore. `bin/Release/net10.0` มี DLL ของแอป/dependencies, EXE app host, PDB debug symbols, deps/runtimeconfig JSON และสำเนา appsettings ตามปกติ. แก้ source/config ที่อยู่ใต้ `src/` แล้ว build ใหม่; ไม่แก้สำเนาใน bin. Deployment ใช้ผล `dotnet publish`.

ชื่อ `OpenRouter__ApiKey` map เป็น configuration `OpenRouter:ApiKey` ตาม [ASP.NET environment configuration](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/?view=aspnetcore-10.0). ค่า base URL อิง [OpenRouter API](https://openrouter.ai/docs/api/api-reference/models/get-models) และ [Resend API](https://resend.com/docs/api-reference/emails/send-email). AI/อีเมล/Firebase/R2 adapters ยังไม่ implement. Database ใช้ ConnectionStrings__Melearn; session/CORS/bootstrap ดูเอกสารสถานะ feature.

| Endpoint | ผลที่คาดหวัง | ความหมาย |
| --- | --- | --- |
| `GET /health/live` | 200, `status: alive`, `stage: foundation` | API process ตอบ HTTP ได้ |
| `GET /health/ready` | 503, `backend_not_ready` | ยังไม่เปิด runtime readiness; live DB/Firebase/Frontend acceptance ยังไม่ครบ |
| `GET /api/v1/me` | 401 เมื่อไม่มี session | local Auth/Profile implement แล้ว; ต้องตั้ง DB และ provision account |
| `GET /api/v1/courses` | 503 เมื่อยังไม่ตั้ง DB | ไม่มี mock fallback; ต้อง apply migrations ก่อน |
| business routes ที่ยังไม่ implement | 404 ตาม error envelope | ยังไม่เปิด use case นั้น |

Health routes เป็น operational endpoints ใหม่ของ host ไม่ใช่ส่วนหนึ่งของ 86 business operations ใน Frontend Draft. ยังไม่มี route สำหรับ Swagger หรือ draft contract projection; ไม่มี fake login/seed เพื่อให้ดูเหมือน Backend พร้อม.

## เอกสารหลัก

- [แผน Backend B0–B10 / สถานะ 14 ฟีเจอร์ / เกณฑ์ตรวจรับ](../docs/BACKEND_DELIVERY_PLAN_TH.md)
- [Backend architecture และ decision register](docs/BACKEND_ARCHITECTURE.md)
- [Feature delivery และ setup/ข้อจำกัด](docs/FEATURE_DELIVERY_STATUS_TH.md)
- [Cloud SQL Bangkok และ environment setup](docs/CLOUD_SQL_SETUP_TH.md) — instance RUNNABLE; application DB connection ยังไม่ทดสอบ
- [Auth decision: Firebase Email/Google และ .NET Username](docs/AUTH_DECISION_TH.md) — ยืนยัน provider แล้ว; session/HTTP changes เป็น Draft ยังไม่ได้เชื่อมจริง
- Business scope: `../docs/MELEARN_V1_SCOPE.md` Final 1.6; ใน Frontend Git คือ `../melearn-tutor-frontend/docs/MELEARN_V1_SCOPE.md`
- API handbook: `../docs/api-contract/API_CONTRACT_FEATURES_TH.md`
- Canonical OpenAPI Draft: `../docs/api-contract/openapi.json`

Paths ข้างต้นอ้าง sibling checkout ใน workspace นี้. ยังไม่คัดลอก JSON/DTO เป็น contract อีกชุด. ก่อนสร้าง business API ให้ตกลงวิธีอ้าง version/แจกจ่าย canonical contract ระหว่าง repositories แล้วเพิ่ม contract tests.

## ผลตรวจ foundation

วันที่ 10 ต.ค. 2026: Release build/test ผ่าน; architecture tests 6 และ HTTP integration tests 46 ผ่าน รวม 52 tests. Business tests ใช้ relational SQLite ใน ASP.NET test host; ไม่รัน Docker หรือ live Cloud SQL/provider. Response ของ Admin management ตรวจชนิด/required/nullable/enum/additional fields กับ snapshot ของ canonical schema. Snapshot ตรวจซ้ำได้ด้วย `scripts/sync-account-contract.ps1 -CheckOnly`; regenerate หลัง review contract change ด้วย script เดียวกัน. ผลล่าสุดและ coverage อยู่ในเอกสารสถานะ feature.

ตรวจ Kestrel ชุดล่าสุดด้วย temporary port 5110 แล้ว: `/health/live` 200, `/health/ready` 503, `/api/v1/me` 401, `/api/v1/courses` 503 (persistence_not_configured) และ `/test-only/throw` 404. ปิด process ที่ใช้ตรวจแล้ว. Live Cloud SQL/Firebase acceptance ยังไม่ได้ตรวจ; ไม่ใช้ผล foundation เก่าแทนชุดนี้.

Domain/Application/Infrastructure มี account/session/catalog/enrollment models, use cases และ EF adapters แล้ว. Migration SQL สร้างไว้เพื่อ review; ยังไม่ apply live DB. DTO ของ subset นี้อ้าง canonical Draft; Firebase/contract synchronization และ PostgreSQL acceptance ยังต้องทำต่อ.

CI workflow เตรียมไว้ใน `.github/workflows/dotnet.yml` แต่จะไม่ถือว่าผ่าน GitHub CI จนมี remote repository และ hosted run จริง. ไม่อนุญาต deploy หรือสร้าง cloud resources โดยการมีไฟล์นี้.
