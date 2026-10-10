# Decision audit — 10 ตุลาคม 2026

ตรวจ Backend ที่ commit `9893bb3` เทียบกับคำยืนยันผู้ใช้, Final 1.6 และ canonical Draft `../../docs/api-contract/openapi.json`. ผลตรวจ: มีทั้ง policy ที่ agent กำหนดเอง, implementation ที่รับข้อมูลไม่ครบ Draft และข้อผิดพลาดของการคำนวณ response. การผ่าน test ไม่ใช่หลักฐานว่าการตัดสินใจเหล่านี้ได้รับอนุมัติ.

## สิ่งที่พบ

| ประเด็น | หลักฐาน | การจัดประเภทและผลกระทบ | งานแก้ |
| --- | --- | --- | --- |
| OpenRouter มี Sonnet 3.5 fallback ใน appsettings ที่ยังไม่ commit | พบใน working files ก่อนชุดแก้; ไม่พบ string นี้ใน Git history ของ appsettings ที่ค้น | ไม่มีคำยืนยันเลือก model นี้; ระบุผู้เขียนจากหลักฐานนี้ไม่ได้. ยังไม่มี OpenRouter adapter ใน Backend จึงยังไม่พบเส้นทางเรียก model นี้ใน implementation ที่ตรวจ | ถอนแล้วทั้ง source/build copies; มี architecture test กัน Model/ApiKey ใน appsettings. ใช้ ENV ตามผู้ใช้เลือก |
| Session อายุ 12 ชั่วโมงและ SameSite=Strict | `src/Melearn.Application/Accounts/AccountService.cs:31`, `src/Melearn.Api/Features/Accounts/AuthController.cs:40` | Agent เลือก development policy เองและบันทึกภายหลัง; ไม่ใช่ production policy ที่ผู้ใช้ยืนยัน. Strict ไม่ส่ง cookie ระหว่างไซต์ จึงยังรับรอง frontend/API ที่ใช้คนละไซต์ไม่ได้ | ตกลง domain/transport/TTL/CSRF ให้ชัดก่อน freeze; ไม่เปลี่ยนเป็น None โดยเดาอีกครั้ง |
| รหัสผ่าน local account ขั้นต่ำ 12 สูงสุด 1024 | `src/Melearn.Api/Features/Accounts/AdminAccountsController.cs:11`, `src/Melearn.Application/Accounts/AccountService.cs:55` | Agent เลือกเอง; AdminCreateUserRequest ใน canonical ยังไม่กำหนดความยาว. Draft signup/reset บาง flow ใช้ 8–128 ซึ่งไม่ใช่ policy final เช่นกัน. Validation จึงยังไม่เป็นข้อตกลงเดียวกัน | เลือก policy local/Firebase ที่สอดคล้องกัน แล้ว sync schema/UI/mock/backend/tests; ไม่ใช้ Draft ตัวใดเป็นคำอนุมัติแทนผู้ใช้ |
| Admin สร้างบัญชีพร้อม email ไม่ได้ | `src/Melearn.Api/Features/Accounts/AdminAccountsController.cs:25`; canonical AdminCreateUserRequest รับ email เป็น optional null/string | ข้อจำกัด implementation: ตอบ 422 เมื่อมี email ทั้งที่ Draft รับได้. Final 1.6 อนุญาตสร้างโดยไม่มี email แต่ไม่ได้สั่งห้ามมี email | ทำ email provisioning/verification ที่ถูกต้อง หรือระบุ endpoint เป็น partial ให้ชัดระหว่างทำ; ไม่แก้สเปกให้ตรงข้อจำกัดโดยเงียบ ๆ |
| auth_methods เดาจาก origin | `src/Melearn.Api/Features/Accounts/AccountContracts.cs:16` | ข้อผิดพลาด: origin คือแหล่งสร้างบัญชี ไม่ใช่ credentials/identities ที่ผูกจริง. บัญชี admin-created ที่ภายหลัง link Google ต้องเข้าด้วยทั้งสองวิธีตาม Final 1.6:206 แต่ mapping ปัจจุบันจะรายงานเพียง password. Link endpoint ยังไม่มี จึงยังไม่ได้ทดสอบ flow นี้ผ่าน HTTP จริง | อ่าน local credential และ external identities ที่ผูกจริง; เพิ่ม acceptance สำหรับบัญชีหลายวิธี Login |
| Rate limit 10 attempts/IP/minute | `src/Melearn.Api/Program.cs:23` | Agent เลือกค่าป้องกันเบื้องต้นเอง; limiter อยู่ใน process. Trusted proxy/distributed policy ยังไม่ทำ จึงยังไม่ยืนยันผลหลัง Cloud Run | ทดสอบ client IP และหลาย instances ก่อน deploy; กำหนด limits/error semantics ใน contract |
| Validation เพิ่มจาก canonical | AccountContracts caps identifier/password; AccountService avatar เฉพาะ HTTPS; Controllers request cap 32 KiB; Catalog จำกัด filters/cursor | เป็น technical safeguards ที่ต้องมีการออกแบบ แต่ยังไม่ sync Draft ทุกจุด. Frontend อาจส่ง JSON ที่ผ่าน schema แต่ API ปฏิเสธ | ทำ validation matrix เทียบ schema กับ runtime และแยกข้อจำกัดที่จำเป็นออกจาก business policy |
| IDs ใช้ Guid และ route constraint | Courses routes `{id:guid}`; Domain entities ใช้ Guid ขณะที่ Draft ระบุ string | เป็น implementation choice; ยังไม่มีหลักฐาน migration จาก IDs ของ mock/URL เดิม. ไม่ได้พิสูจน์ว่าลิงก์เก่าหรือข้อมูล mock จะใช้กับ real API ได้ | กำหนดรูปแบบ ID/compatibility และทดสอบ URL/data migration ก่อนสลับ frontend |
| Cloud SQL operational settings | `docs/CLOUD_SQL_SETUP_TH.md:3` บันทึก autosize cap 20 GB, backup retention 3, deletion protection; provisioning เดิมปิด PITR | ผู้ใช้อนุมัติ PostgreSQL Bangkok ขนาดเล็กและใช้ instance ที่สร้างแล้ว. รายละเอียด backup/cap/PITR เป็น operational choices ของ agent ไม่ได้มีคำยืนยันแยกทุกค่า; มีผลต่อค่าใช้จ่ายและการกู้ข้อมูล | Review recovery/cost policy ก่อนข้อมูลจริง; audit นี้ไม่ได้เปลี่ยน Cloud SQL และไม่ได้ตรวจ cloud state สดซ้ำ |

## สิ่งที่ยืนยันแล้วและยังไม่พบว่าขัดในชุดที่ตรวจ

- ASP.NET Core, PostgreSQL Bangkok, Firebase Email/Google + local Username, R2, OpenRouter/Resend placeholders และ Web/Admin login แยก เป็นทิศทางจากผู้ใช้ ไม่ใช่ model/provider ที่ agent เลือกขึ้นเอง.
- Backend ตรวจ role/ownership; audience/header ไม่เพิ่มสิทธิ์ Admin. Admin ซื้อ/สมัครคอร์สไม่ได้; Instructor สมัครคอร์สตนเองไม่ได้. บัญชี self-email ที่ไม่ verified ไม่มีสิทธิ์เริ่มเรียน ขณะที่ admin-created ไม่ต้องมี email ก่อน.
- ไม่พบค่าจริงใน secret placeholders ที่ตรวจของ `.env.example` working/committed และช่อง R2 key ใน appsettings.Development. นี่ไม่ใช่ผล secret scan ทั้ง repository/history.

## ความพร้อมที่ต้องรายงานให้ตรง

มี 9 business operations เป็น implementation บางส่วน ไม่ใช่ Backend ครบ 86 operations. Frontend ยังใช้ mock; ยังไม่ apply migrations/ตรวจ live PostgreSQL, Firebase token verifier/link/email recovery, R2 upload, AI/Resend และ feature อื่นยังไม่ครบ. การใส่ API keys อย่างเดียวจึงยังไม่ทำให้ระบบครบใช้งานจริง.

HTTP integration ใช้ SQLite test host และส่ง Cookie header เอง: ตรวจ session/permissions ได้ แต่ไม่พิสูจน์ browser SameSite/CORS, PostgreSQL concurrency หรือ Cloud Run proxy behavior. บาง assertions เช่น SameSite=Strict ตรวจตามสิ่งที่ agent เขียน จึงตรวจไม่พบว่าค่านั้นยังไม่ตกลงใน contract.

ตรวจซ้ำใน audit นี้: `dotnet test Melearn.slnx --configuration Release --no-restore --verbosity quiet` ผ่าน 36 tests (architecture 6 + HTTP integration 30). ผลนี้ยืนยันชุดทดสอบปัจจุบันเท่านั้น ไม่ปิด findings ในตาราง.

## ลำดับการแก้

1. แก้ response auth_methods ให้สะท้อน credentials/identities จริง และเพิ่มกรณี link ใน acceptance เมื่อทำ linking.
2. ทำรายการ validation/request/response differences ระหว่าง 9 operations กับ canonical; แก้ endpoint ที่ partial และ sync frontend/mock/schema/tests พร้อมกัน.
3. ตัดสิน production session/password/rate/recovery policies จาก deployment และ business needs ก่อนนำไปใช้จริง; ไม่ถือค่าช่วงพัฒนาเป็นข้อตกลงถาวร.
4. ตรวจ PostgreSQL/Firebase และ frontend flow จริง แล้วจึงขยาย feature ต่อจากฐานที่ตรง contract.

Audit นี้ไม่เปลี่ยน business source, credentials, infrastructure หรือ deploy. Sonnet fallback ถูกถอนในชุดแก้ก่อน audit; ประเด็นอื่นในตารางยังเปิดอยู่.

อ้างอิงพฤติกรรม cookie: [MDN Set-Cookie / SameSite](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).
