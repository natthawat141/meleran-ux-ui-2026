# R4b-flow B — แคตตาล็อกสาธารณะในโหมดพัฒนา

สถานะ: guest Catalog + Landing และ free Enrollment อ่าน provisional mock ขณะ `vite dev`; Auth และ R7 learner pages มี integration report แยกที่ [R7 progress](R7_API_MOCK_PROGRESS_TH.md). Contract ยังเป็น Draft และไม่มี DTO ใน `packages/contracts`.

## สิ่งที่เปลี่ยน

- `tools/provisional-api/dev-server.ts` เปิด HTTP ที่ `127.0.0.1:8787` ตอน `npm run dev` ของ Web หรือ Admin ผ่าน dev plugin ของ app นั้น
- Vite Web/Admin ส่ง `/mock-api` ไปที่พอร์ตนั้น; request ของแต่ละ app มี session cookie แยกกัน
- ผู้เยี่ยมชมที่ยังไม่ล็อกอิน เปิด `/courses` และ `/courses/:id` แล้วหน้าอ่าน `GET /mock-api/v1/courses` กับ `GET /mock-api/v1/courses/{id}` ผ่าน `createCatalogApi`
- ลิงก์ใช้ `id` เพราะ mock ยังไม่ค้นด้วย slug
- ราคา `amount_minor` แสดงเป็นบาทโดยหาร 100 (สมมติฐาน THB) คอร์สฟรีคือ `price: null`
- โหลดไม่สำเร็จ ข้อมูลไม่ตรงรูป หรือยกเลิกคำขอ แสดงข้อความและปุ่มลองใหม่ ไม่ดึงคอร์สจาก local store มาแทน
- Production build ยังเรนเดอร์แคตตาล็อกเดิมในเครื่อง เพราะไม่มีเซิร์ฟเวอร์นี้ใน build

## ที่ยังเป็นของเดิม

คอร์สฟรีสมัครผ่าน mock ได้หลัง Login; paid checkout ยังรอ R8. `/explore` และ production build ยังคงใช้ local store เพื่อรักษา prototype flow.

## การตรวจ

- `tests/provisional-catalog-dev-server.test.mjs` ตรวจ HTTP จริงของ dev server, ราคา, URL ปก และแหล่งข้อมูลของหน้า
- ชุด `node --test`, typecheck, boundary และ build ของ Web
- เปิด guest `/courses` ในเบราว์เซอร์: รายการตัวอย่าง 3 คอร์ส, ค้นหา, หมวด, หน้ารายละเอียดไม่มีข้อความ SECRET
