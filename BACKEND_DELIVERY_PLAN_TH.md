# Backend จริงและการเชื่อม Frontend

วันที่ 10 ตุลาคม 2026 · Delivery plan; local Auth/Profile/Admin-created Learner/Catalog/Free Enrollment implement แล้ว; ยังไม่ deploy หรือเชื่อม Frontend จริง

## ยืนยันจากผู้ใช้

- API ใช้ ASP.NET Core .NET 10; Frontend เป็น React Web/Admin ใน monorepo.
- Cloud Run อยู่ project `melearn-tutor`.
- Database อยู่ project `melearn-infra-prod`, PostgreSQL 16 Cloud SQL instance `melearn-tutor-db` สร้างแล้วใน Bangkok ตามคำสั่งผู้ใช้ และยืนยันให้ใช้ต่อ. ต้องเริ่มตัวเล็กเพื่อคุมค่าใช้จ่าย.
- Firebase Email/Google และ .NET Username ไม่มี email; บัญชีชุดเดียว Web/Admin แยก Login/session.
- เตรียม OpenRouter/model และ Resend environment แล้ว; provider adapter ยังไม่ implement. API keys เพียงอย่างเดียวไม่ทำให้ persistence/IAM/session พร้อม.

## Database configuration — instance ตรวจแล้ว; runtime/deployment ยังต้อง implement

| Setting | ข้อเสนอ |
| --- | --- |
| Engine / data access | PostgreSQL 16; EF Core 10/Npgsql adapter + migrations implement แล้ว ยังไม่ apply/ตรวจ SQL connection สด |
| Edition / tier | Enterprise / `db-f1-micro`, shared CPU, memory ประมาณ 0.6 GB |
| Availability | Single zone; ไม่เปิด HA/read replicas ในช่วงพัฒนา |
| Region | Bangkok `asia-southeast3` ตามคำสั่งล่าสุดของผู้ใช้ |
| Storage | SSD 10 GB, storage auto-increase cap 20 GB ตรวจแล้ว |
| Recovery | Daily backups เปิด retention 3 ชุด; backup คิดค่าใช้จ่ายแยก |
| Access | Cloud SQL connection ผ่าน service identity/proxy; ไม่เปิด authorized networks เป็น `0.0.0.0/0` |
| Cloud Run scaling | เสนอ min instances 0 / max 2 และจำกัด DB pool ต่อ process; ปรับตาม DB connection budget/ผล load test |

Shared-core ไม่มี Cloud SQL SLA; ใช้เริ่ม dev/integration เท่านั้น ไม่ประกาศพร้อม traffic จริงจากขนาดนี้. instance สร้างตามคำสั่งก่อนข้อความให้หยุด และเสร็จแล้ว; ผู้ใช้ยืนยันให้ใช้ต่อ. ไม่ใช่ production capacity guarantee และยังไม่มี Cloud Run deployment.

ราคา: ต้องเลือก region ใน [Cloud SQL pricing](https://cloud.google.com/sql/pricing) หรือ calculator ก่อนสร้าง. ค่า compute = regional hourly rate × ชั่วโมงที่เปิด (ประมาณ 730 ชั่วโมง/เดือน); บวก SSD 10 GB, backup, network/IP และภาษีตามบัญชี. Cloud Billing Catalog Bangkok Zonal Micro SKU 6AE1-4C1F-7DF2 ที่ตรวจวันที่ 10 ต.ค. 2026 ราคา USD 0.011025/hour (ประมาณ USD 8.05/730 ชั่วโมง เฉพาะ compute) ไม่ใช่ total bill. Cloud SQL มีค่า instance ขณะเปิดแม้ไม่มี traffic; Cloud Run min 0 ไม่ทำให้ DB หยุดตาม.

## Cross-project access

Cloud Run runtime service account ของ `melearn-tutor` ต้องมีสิทธิ์ Cloud SQL Client ที่ project/instance ฝั่ง `melearn-infra-prod` ตามรูปแบบการเชื่อม และ Cloud SQL Admin API ต้องเปิดทั้งสอง project สำหรับ connector/proxy. IAM Client ไม่ได้แทน database login/grants. Credential/migration user/runtime DB user แยกความรับผิดชอบ; ไม่ใช้ postgres admin เป็น runtime account.

เลือก public IP ผ่าน authenticated proxy/Cloud Run integration หรือ private network ตาม topology ที่ตกลง; ชุดนี้ยังไม่สร้าง VPC/service accounts/เปลี่ยน IAM. ตรวจ project ID ของ Firebase จาก config จริงแยกต่างหาก ห้ามถือว่า Firebase ต้องเป็น project เดียวกับ Cloud Run.

10 ต.ค.: เปิด Cloud SQL Admin API ฝั่ง infra และสร้าง instance แล้ว; tier availability/operation/instance describe ตรวจ RUNNABLE. ยังไม่เปลี่ยน IAM/Cloud Run หรือสร้าง application database/schema/runtime user. [คู่มือ setup](../melearn-tutor-api/docs/CLOUD_SQL_SETUP_TH.md).

## ลำดับ implementation และเกณฑ์เสร็จ

สถานะล่าสุด: 9 business operations และ account/session/course/enrollment persistence models; Release build 0 warnings/errors, 35 tests ผ่าน (relational SQLite/test host). Migration SQL และ bootstrap Admin command เตรียมแล้ว. `ConnectionStrings__Melearn` และ `Firebase__ProjectId` ใน ignored .env ยังว่างตอนตรวจ; ยังไม่มี live Cloud SQL/Firebase acceptance และ Frontend ยังใช้ mock. [Endpoint coverage/ข้อจำกัด/setup](../melearn-tutor-api/docs/FEATURE_DELIVERY_STATUS_TH.md). ข้อ 1/2/4 ด้านล่างทำได้บางส่วน ไม่ถือว่าจบครบ flow.

1. Persistence foundation: account/identity/local credential/app session tables และ migrations; uniqueness/transactions, DB connectivity และ readiness จริง. เลือก session cookie/Bearer/TTL/CORS/CSRF ตาม origins ที่ใช้งาน ไม่ใช้ app header เป็น role.
2. Auth/Profile: Firebase token exchange + local Username Login + logout + GET/PATCH /me; explicit account linking, role/disabled/verification checks และ Web/Admin isolation. ปรับ canonical OpenAPI/mock/generated types พร้อมกัน.
3. Frontend Auth integration: Firebase SDK Email/Google และ .NET Username; เปิด real API config เฉพาะ flow ที่ backend ผ่าน HTTP/permission/persistence tests. แสดงข้อผิดพลาดจริง ไม่ fallback store/mock หลัง real API fail.
4. Catalog/Enrollment: persisted published courses/public projection/free enrollment/own enrollments; ตรวจ Instructor/Admin rules และ email verified ตาม Final 1.6. ทดสอบ Login → profile → catalog → enroll แบบต่อเนื่อง.
5. Authoring/review/publish, Learning/Assessment/Certificate, Management/Blog; ตรวจ resource ownership, revisions, scores และ persistence หลัง restart. ย้ายแต่ละ feature ออกจาก mock เมื่อ backend ทำครบ flow นั้น.
6. Provider integrations: OpenRouter/quota, Resend local-account messages, Stripe verified webhook และ Cloudflare media ตาม contract/protocol ที่กำหนด. Firebase verification/reset ไม่สลับไป Resend โดยไม่มีการออกแบบ provider action links.
7. Deployment: GitHub CI/container build, secrets/service identity, migrations ผ่านแผน review, Cloud Run smoke/rollback และ frontend base URL/origins. ไม่รัน Docker local.

Done ของแต่ละ flow: wire JSON ตรง schema, permission/negative tests ผ่าน, ข้อมูลบันทึกถาวร, frontend ใช้ HTTP จริงของ flow นั้น และระบุ live/provider checks ที่ยังทำไม่ได้จาก credentials ที่ขาด. ไม่ต้องรอให้ 86 endpoints เสร็จทั้งหมดก่อนต่อ Frontend; ยังไม่ถือว่าแค่เปลี่ยน base URL ใช้งานทั้งระบบได้.

## แหล่งอ้างอิง

- [Cloud SQL machine series](https://docs.cloud.google.com/sql/docs/postgres/machine-series-overview)
- [Instance settings / shared-core SLA](https://docs.cloud.google.com/sql/docs/postgres/instance-settings)
- [Cloud Run → Cloud SQL, cross-project IAM](https://docs.cloud.google.com/sql/docs/postgres/connect-run)
- [Cloud Run service identity](https://docs.cloud.google.com/run/docs/configuring/services/service-identity)
- [Cloud SQL pricing](https://cloud.google.com/sql/pricing)
