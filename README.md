# Melearn API

ASP.NET Core .NET 10 · Clean Architecture + Feature-first / use cases · Backend foundation

เริ่มพัฒนา 10 ตุลาคม 2026 ตามคำสั่งผู้ใช้. ปัจจุบันเป็นโครง Backend ที่ build/test ได้ ยังไม่มี business API, authentication, database หรือ provider integration. Frontend ยังใช้ HTTP mock เดิม ห้ามเปลี่ยน base URL มาที่ host นี้แล้วคาดว่าจะใช้งานทั้งระบบได้.

## เริ่มใช้งาน

ต้องมี SDK `10.0.400` ตาม `global.json` (รองรับ patch ใหม่ของ feature band เดียวกัน).

```powershell
cd D:\code\elearn-prod\melearn-api
dotnet restore Melearn.slnx --locked-mode
dotnet build Melearn.slnx --configuration Release --no-restore
dotnet test Melearn.slnx --configuration Release --no-build --no-restore
dotnet run --project src/Melearn.Api --launch-profile http
```

HTTP dev host: `http://127.0.0.1:5100`.

| Endpoint | ผลที่คาดหวัง | ความหมาย |
| --- | --- | --- |
| `GET /health/live` | 200, `status: alive`, `stage: foundation` | API process ตอบ HTTP ได้ |
| `GET /health/ready` | 503, `backend_not_ready` | ยังไม่มี identity/persistence/business endpoints |
| `/api/v1/*` | 404 ตาม error envelope | ยังไม่ได้ implement business operations |

Health routes เป็น operational endpoints ใหม่ของ host ไม่ใช่ส่วนหนึ่งของ 86 business operations ใน Frontend Draft. ยังไม่มี route สำหรับ Swagger หรือ draft contract projection; ไม่มี fake login/seed เพื่อให้ดูเหมือน Backend พร้อม.

## เอกสารหลัก

- [Backend architecture และ decision register](docs/BACKEND_ARCHITECTURE.md)
- Business scope: `../MELEARN_V1_SCOPE.md` Final 1.6; ใน Frontend Git คือ `../elearning-ux-v2/docs/MELEARN_V1_SCOPE.md`
- API handbook: `../elearning-ux-v2/docs/API_CONTRACT_FEATURES_TH.md`
- Canonical OpenAPI Draft: `../elearning-ux-v2/packages/contracts/openapi/openapi.json`

Paths ข้างต้นอ้าง sibling checkout ใน workspace นี้. ยังไม่คัดลอก JSON/DTO เป็น contract อีกชุด. ก่อนสร้าง business API ให้ตกลงวิธีอ้าง version/แจกจ่าย canonical contract ระหว่าง repositories แล้วเพิ่ม contract tests.

## ผลตรวจ foundation

วันที่ 10 ต.ค. 2026: Release build ผ่าน 0 warnings / 0 errors; architecture tests 5 และ integration tests 10 ผ่าน รวม 15 tests. Tests ใช้ in-memory ASP.NET test host ไม่รัน Docker/DB/provider.

ตรวจ Kestrel จริงที่พอร์ต 5100 แล้ว: `/health/live` 200, `/health/ready` 503, `/api/v1/me` 404 และ `/test-only/throw` 404 ยืนยันว่า test-only controller ไม่เปิดใน dev host ปกติ. Locked restore ผ่าน. Business API และ provider acceptance ยังไม่ได้ implement.

Domain และ Infrastructure ยังเป็น project boundaries ที่ไม่มี business/persistence classes; ไม่มี UnitTests/ContractTests project เปล่าเพื่อให้ดูว่าครบ. เพิ่มเมื่อเริ่ม use case/DTO จริง.

CI workflow เตรียมไว้ใน `.github/workflows/dotnet.yml` แต่จะไม่ถือว่าผ่าน GitHub CI จนมี remote repository และ hosted run จริง. ไม่อนุญาต deploy หรือสร้าง cloud resources โดยการมีไฟล์นี้.
