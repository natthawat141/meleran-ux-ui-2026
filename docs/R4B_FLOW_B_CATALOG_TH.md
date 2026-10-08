# R4b-flow B — แคตตาล็อกสาธารณะในโหมดพัฒนา

สถานะ: ต่อเฉพาะ guest catalog ของ Web ขณะ `vite dev` Contract ยังเป็น draft ไม่มี DTO ใน `packages/contracts` และยังไม่มี TanStack Query

## สิ่งที่เปลี่ยน

- `tools/provisional-api/dev-server.ts` เปิด HTTP ที่ `127.0.0.1:8787` เฉพาะตอน `npm run dev` ของ Web ผ่านปลั๊กอิน `apps/web/dev-catalog-server-plugin.ts` (ไฟล์นี้อยู่นอก `apps/web/src` จึง import mock ได้)
- Vite ส่ง `/mock-api` ต่อไปที่พอร์ตนั้น
- ผู้เยี่ยมชมที่ยังไม่ล็อกอิน เปิด `/courses` และ `/courses/:id` แล้วหน้าอ่าน `GET /mock-api/v1/courses` กับ `GET /mock-api/v1/courses/{id}` ผ่าน `createCatalogApi`
- ลิงก์ใช้ `id` เพราะ mock ยังไม่ค้นด้วย slug
- ราคา `amount_minor` แสดงเป็นบาทโดยหาร 100 (สมมติฐาน THB) คอร์สฟรีคือ `price: null`
- โหลดไม่สำเร็จ ข้อมูลไม่ตรงรูป หรือยกเลิกคำขอ แสดงข้อความและปุ่มลองใหม่ ไม่ดึงคอร์สจาก local store มาแทน
- Production build ยังเรนเดอร์แคตตาล็อกเดิมในเครื่อง เพราะไม่มีเซิร์ฟเวอร์นี้ใน build

## ที่ยังเป็นของเดิม

หน้าแรก, แคตตาล็อกหลังล็อกอิน (`/explore`), ปุ่มเข้าสู่ระบบบนหน้ารายละเอียด และการสมัครเรียน ยังใช้ local store ปุ่มบนหน้ารายละเอียดในโหมดพัฒนาพาไปหน้าเข้าสู่ระบบเท่านั้น

## การตรวจ

- `tests/provisional-catalog-dev-server.test.mjs` ตรวจ HTTP จริงของ dev server, ราคา, URL ปก และแหล่งข้อมูลของหน้า
- ชุด `node --test`, typecheck, boundary และ build ของ Web
- เปิด guest `/courses` ในเบราว์เซอร์: รายการตัวอย่าง 3 คอร์ส, ค้นหา, หมวด, หน้ารายละเอียดไม่มีข้อความ SECRET
