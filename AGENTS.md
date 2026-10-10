# Melearn API working instructions

ผู้ใช้ยืนยัน ASP.NET Core .NET 10 และอนุญาต foundation ตาม Clean Architecture + Feature-first วันที่ 10 ต.ค. 2026. อ่าน README และ docs/BACKEND_ARCHITECTURE.md ก่อนแก้. ทำคนเดียวตามคำสั่งล่าสุดที่ยกเลิก subagents.

Business rules ใช้ workspace ../docs/MELEARN_V1_SCOPE.md Final 1.6 หรือสำเนา Frontend ../melearn-tutor-frontend/docs/MELEARN_V1_SCOPE.md. API Draft canonical อยู่ ../docs/api-contract/openapi.json. อย่าถือว่า frontend mock, DTOs หรือ memory ของสแตกเก่าเป็น database/security/provider implementation.

- รักษา dependency rules และ scope ใน architecture document; Controllers ไม่มี business/SQL/provider code.
- Auth provider ยืนยัน 10 ต.ค. 2026: Firebase Email/Google และ .NET Username ไม่มี email; อ่าน docs/AUTH_DECISION_TH.md. PostgreSQL 16 Cloud SQL Bangkok ยืนยันและ instance melearn-tutor-db สร้างแล้ว; อ่าน docs/CLOUD_SQL_SETUP_TH.md. EF Core/Npgsql เป็นแนวทาง data access ที่เสนอ; session/media protocol ยังต้องกำหนด. ไม่เพิ่ม provider/infra ใหม่โดยเดาแทนผู้ใช้.
- Request/response DTO แยกจาก entities; nullable/required/errors ต้องตรง Contract.
- ไม่ deploy, รัน local Docker, สร้าง cloud resources หรือแก้ reference systems โดยอัตโนมัติ.
- ตรวจ restore/build/test และ scoped diff ก่อน commit. ห้าม blanket git add/reset/force push. Repo ใหม่ยังไม่มี remote; ไม่เดา remote หรือส่ง Backend เข้า Frontend Git.
- สรุปเป็นภาษาไทย แยก foundation/build/test, business implementation และ production readiness.
