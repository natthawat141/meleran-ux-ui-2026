# ผลตรวจ Email Verification และ Course Review

วันที่ 6 ตุลาคม 2026 · Interactive prototype

## ขอบเขต

- สมัครอีเมลแล้ว Login ได้ แต่ต้องยืนยันก่อน Enroll, Redeem หรือเริ่มเรียน
- ลิงก์ยืนยันจำลองอายุ 24 ชั่วโมง ใช้ครั้งเดียว และ Resend มีช่วงรอ 60 วินาทีสำหรับต้นแบบ
- Google จำลองเชื่อมเฉพาะบัญชีที่ Login อยู่ ไม่สร้าง User หรือรวมบัญชีอัตโนมัติ
- คอร์สร่างส่งตรวจเป็น `pending_review` Admin อนุมัติหรือส่งกลับพร้อมเหตุผล
- Instructor เจ้าของคอร์สและ Admin เผยแพร่หลัง Approved ได้
- แก้คอร์ส Approved/Pending กลับ Draft ส่วน Published แก้ได้ทันที
- การเปลี่ยนข้อมูลคอร์ส บท รายการเนื้อหา และแบบทดสอบตรวจใน store actions

## ตรวจผ่าน

```powershell
npm.cmd run typecheck
node --test tests/email-verification.test.mjs tests/course-review.test.mjs tests/learning-history.test.mjs tests/access-code-redemption.test.ts
npm.cmd run build
git diff --check
```

Typecheck ผ่าน, tests 14 รายการผ่าน และ build ผ่าน มีคำเตือนจาก dependencies เรื่อง `use client` directives และ bundle ขนาดใหญ่

## ตรวจผ่านหน้าจอ

ทดสอบบน origin แยก `http://127.0.0.1:5175` ด้วยบัญชีและข้อมูลจำลองผ่าน UI โดยไม่ reset ข้อมูลเดโมเดิม

| Flow | ผลที่เห็น |
| --- | --- |
| สมัครและ Login ก่อนยืนยัน | Login ได้ หน้าลงเรียน/แลกรหัสแสดงให้ยืนยันก่อน |
| Resend | แสดงช่วงรอและสร้างลิงก์ใหม่ ลิงก์เดิมใช้ไม่ได้ |
| เปิดลิงก์ใหม่ | ยืนยันสำเร็จและลงเรียนฟรีได้ |
| เปิดลิงก์ที่ใช้แล้วซ้ำ | แจ้งว่าใช้ยืนยันไปแล้ว |
| Google จำลองด้วยอีเมลบัญชีอื่น | ปฏิเสธและแจ้งให้ Login บัญชีเดิม ไม่มีการรวมบัญชี |
| Instructor สร้างคอร์สและบทอ่าน | บันทึก Draft และส่งเข้าคิว Admin ได้ |
| Instructor เปิดคิว Admin | แสดงว่าไม่มีสิทธิ์ |
| Admin ส่งกลับ | ต้องมีเหตุผล คอร์สกลับ Draft และผู้สอนเห็นเหตุผลในหน้าตั้งค่า |
| Admin ส่งตรวจแทนและอนุมัติ | ออกจากคิวตรวจ แต่ยังไม่ Published |
| บันทึก Approved โดยไม่เปลี่ยนข้อมูล | ยังคง Approved |
| แก้ Approved ก่อน Publish | กลับ Draft ต้องส่งตรวจใหม่ |
| Instructor เผยแพร่หลังอนุมัติใหม่ | เปลี่ยนเป็น Published |
| แก้ Published | ข้อมูลเปลี่ยนและยังคง Published |

## ข้อจำกัด

ยังใช้ localStorage และสิทธิ์ฝั่งหน้าเว็บ ไม่มี backend, Resend หรือ Google OAuth จริง ลิงก์จำลองใช้ได้เฉพาะ browser/origin ที่มีข้อมูลบัญชีนี้ จึงไม่ใช่หลักฐานความพร้อม Production

Blog, Revoked code และ completion snapshot เป็นข้อกำหนดในเอกสารธุรกิจ ไม่ได้เพิ่มในโค้ดชุดนี้ ต้นแบบยังมีฟีเจอร์เดิมที่อยู่นอกขอบเขตรอบแรก

งานอยู่บน branch `feat/email-verification-course-review-20261006` แยกจากงาน Feature Release ที่ staged อยู่ใน checkout หลัก ยังไม่ได้รวมเข้าสาขานั้น
