# Melearn API

ASP.NET Core .NET 10 · Clean Architecture + Feature-first / use cases · Backend foundation

เริ่มพัฒนา 10 ตุลาคม 2026 ตามคำสั่งผู้ใช้. ปัจจุบันเป็นโครง Backend ที่ build/test ได้ ยังไม่มี business API, authentication, database หรือ provider integration. Frontend ยังใช้ HTTP mock เดิม ห้ามเปลี่ยน base URL มาที่ host นี้แล้วคาดว่าจะใช้งานทั้งระบบได้.

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

คัดลอก `.env.example` เป็น `.env` และกรอก `OpenRouter__ApiKey`, `OpenRouter__Model`, `Resend__ApiKey`, `Resend__From` และ Firebase project/credential path เมื่อพร้อม. `.env` ถูก Git ignore; private credential file ให้เก็บนอก repository. Frontend ใช้เฉพาะ Firebase public client config; ห้ามนำ OpenRouter/Resend API keys ไปใส่ `VITE_*`.

```powershell
Copy-Item -LiteralPath .env.example -Destination .env # เฉพาะเมื่อยังไม่มี .env
.\scripts\dev.ps1 -CheckOnly
.\scripts\dev.ps1
```

ASP.NET Core อ่าน process environment แต่ไม่อ่าน `.env` โดยอัตโนมัติ. Script นี้โหลดค่าแล้วเรียก `dotnet run --no-launch-profile` เพื่อให้ URL/environment จากไฟล์มีผล; หลังหยุด process จะคืนค่า environment เดิม. Blank placeholders ไม่ทับค่าที่ตั้งไว้ภายนอก. ไม่รองรับ multiline, variable interpolation หรือ inline comments; syntax check ไม่ได้ตรวจว่า key/model/sender ใช้งานกับ provider ได้จริง.

ชื่อ `OpenRouter__ApiKey` map เป็น configuration `OpenRouter:ApiKey` ตาม [ASP.NET environment configuration](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/?view=aspnetcore-10.0). ค่า base URL อิง [OpenRouter API](https://openrouter.ai/docs/api/api-reference/models/get-models) และ [Resend API](https://resend.com/docs/api-reference/emails/send-email). ตัวแปรเหล่านี้เตรียมไว้สำหรับ adapters ที่จะ implement ต่อ; ยังไม่มีการเรียก AI/ส่งอีเมล/ตรวจ Firebase จริง และยังไม่เพิ่ม DB/session/media credentials ที่ยังไม่เลือก protocol.

| Endpoint | ผลที่คาดหวัง | ความหมาย |
| --- | --- | --- |
| `GET /health/live` | 200, `status: alive`, `stage: foundation` | API process ตอบ HTTP ได้ |
| `GET /health/ready` | 503, `backend_not_ready` | ยังไม่มี identity/persistence/business endpoints |
| `/api/v1/*` | 404 ตาม error envelope | ยังไม่ได้ implement business operations |

Health routes เป็น operational endpoints ใหม่ของ host ไม่ใช่ส่วนหนึ่งของ 86 business operations ใน Frontend Draft. ยังไม่มี route สำหรับ Swagger หรือ draft contract projection; ไม่มี fake login/seed เพื่อให้ดูเหมือน Backend พร้อม.

## เอกสารหลัก

- [Backend architecture และ decision register](docs/BACKEND_ARCHITECTURE.md)
- [Cloud SQL Bangkok และ environment setup](docs/CLOUD_SQL_SETUP_TH.md) — instance RUNNABLE; application DB connection ยังไม่ทดสอบ
- [Auth decision: Firebase Email/Google และ .NET Username](docs/AUTH_DECISION_TH.md) — ยืนยัน provider แล้ว; session/HTTP changes เป็น Draft ยังไม่ได้เชื่อมจริง
- Business scope: `../docs/MELEARN_V1_SCOPE.md` Final 1.6; ใน Frontend Git คือ `../melearn-tutor-frontend/docs/MELEARN_V1_SCOPE.md`
- API handbook: `../docs/api-contract/API_CONTRACT_FEATURES_TH.md`
- Canonical OpenAPI Draft: `../docs/api-contract/openapi.json`

Paths ข้างต้นอ้าง sibling checkout ใน workspace นี้. ยังไม่คัดลอก JSON/DTO เป็น contract อีกชุด. ก่อนสร้าง business API ให้ตกลงวิธีอ้าง version/แจกจ่าย canonical contract ระหว่าง repositories แล้วเพิ่ม contract tests.

## ผลตรวจ foundation

วันที่ 10 ต.ค. 2026: Release build ผ่าน 0 warnings / 0 errors; architecture tests 5 และ integration tests 10 ผ่าน รวม 15 tests. Tests ใช้ in-memory ASP.NET test host ไม่รัน Docker/DB/provider.

ตรวจ Kestrel จริงที่พอร์ต 5100 แล้ว: `/health/live` 200, `/health/ready` 503, `/api/v1/me` 404 และ `/test-only/throw` 404 ยืนยันว่า test-only controller ไม่เปิดใน dev host ปกติ. Locked restore ผ่าน. Business API และ provider acceptance ยังไม่ได้ implement.

Domain และ Infrastructure ยังเป็น project boundaries ที่ไม่มี business/persistence classes; ไม่มี UnitTests/ContractTests project เปล่าเพื่อให้ดูว่าครบ. เพิ่มเมื่อเริ่ม use case/DTO จริง.

CI workflow เตรียมไว้ใน `.github/workflows/dotnet.yml` แต่จะไม่ถือว่าผ่าน GitHub CI จนมี remote repository และ hosted run จริง. ไม่อนุญาต deploy หรือสร้าง cloud resources โดยการมีไฟล์นี้.
