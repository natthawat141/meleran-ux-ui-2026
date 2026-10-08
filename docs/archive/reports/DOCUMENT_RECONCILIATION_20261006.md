# การปรับเอกสารให้ตรงฉบับที่ยืนยัน

6 ตุลาคม 2026 · ข้อมูลหลัก: [MELEARN_V1_SCOPE.md](../../MELEARN_V1_SCOPE.md) Final 1.6

ฉบับ 1.5 คัดลอกจากเอกสารที่เจ้าของตรวจแล้ว ฉบับ 1.6 เพิ่ม Stripe และคำสั่งสร้างแบบฝึกหัดตามคำยืนยันล่าสุด แยกกติกาที่อนุมัติออกจากสถานะ implementation

| เอกสาร | การปรับ |
| --- | --- |
| AGENTS, Gemini, Cursor, README และ docs/README | อ่านฉบับหลักก่อน UI/CODE และร่างเก่า |
| UI_SPEC | แก้ขอบเขตบทบาท, Enroll/Redeem, YouTube, AI และเลิกใช้กติกา Inbox/Commerce เดิม และเพิ่ม Stripe Checkout ตามคำยืนยันใหม่ รักษาแบรนด์ |
| CODE_SPEC | แยกพฤติกรรม store/Inbox/checkout/ส่วนแบ่งเดิมว่าเป็นต้นแบบ ไม่ใช้สร้าง Domain/API ของ V1 |
| FEATURE_RELEASE_MATRIX | ใช้ขอบเขตหนึ่งเดือนที่ยืนยันแล้ว แยกงานที่ยังไม่ทำและสถานะ prototype ออกจาก Production |
| BUSINESS_ANALYTICS_DATA_SPEC, BUSINESS_ANALYTICS_UI_SPEC, INBOX_PERMISSION_SPEC, INSTRUCTOR_ANALYTICS_UI_SPEC, ADMIN_MANAGEMENT_GAP_AUDIT_TH | ย้ายต้นฉบับไป `archive/pre-final-20261006/` พร้อมป้ายเลิกใช้ หน้าทางเข้าเดิมชี้ฉบับหลัก |
| เอกสารผลตรวจ Git/TypeScript/Email verification | เก็บผลตรวจตามวันที่ ไม่ใช้แทน business rules |
| เอกสารร่างระดับ workspace | เปลี่ยนเป็นทางเข้าฉบับหลัก สำรองต้นฉบับใน artifacts ของ workspace ไม่แก้ reference หรือ backups |

## สิ่งที่โค้ดยังไม่ใช่ระบบจริง

- Email verification/course review และ AI support เป็นต้นแบบ; ไม่มี Resend, Google OAuth, model/retrieval หรือฐานข้อมูล Production ที่เชื่อมแล้ว
- ประวัติ AI ในต้นแบบเก็บ browser-local ส่วนการเก็บคำถาม/คำตอบใน Database และโควตา 20 Prompt ที่ server เป็นงานที่ต้องส่งมอบตามฉบับหลัก
- Stripe และคำสั่ง AI สร้างชุดฝึกยังไม่ได้ต่อบริการจริง แม้อยู่ในขอบเขตที่ยืนยันแล้ว
- ยังมีหน้าต้นแบบนอกขอบเขตใน source การคง code ไว้ไม่เท่ากับรับรองว่า feature นั้นจะส่งมอบ และไม่มี feature ที่ประกาศ released จากผล build
- พฤติกรรม Redeem ผ่าน order/ส่วนแบ่ง และตัวเลือกอัปโหลดวิดีโอเดิมต้องปรับเมื่อทำ API จริงตามฉบับหลัก ไม่อ้างว่าระบบจริงพร้อมแล้ว
- ยังไม่กำหนด soft/hard delete และระยะเวลาเก็บข้อมูลหลังลบแชต ไม่เติมนโยบายนี้จากการคาดเดา
- แยก User/Admin frontend, Main/AI API และ PostgreSQL เป็นเรื่องที่คุยด้านเทคนิค ยังไม่ใช่ข้อสรุป stack ในเอกสารที่ยืนยัน

## Stripe Webhook-only ตามคำยืนยันล่าสุด

ปรับ Business Logic ทั้ง 14 ข้อ Flow API และกรณีตรวจรับ ให้ Webhook ที่ตรวจลายเซ็นแล้วเป็นผู้ให้ Enrollment เท่านั้น Success Page อ่านสถานะ ยกเลิก API /verify ที่ให้สิทธิ์จากหน้าผลจ่าย Checkout frontend เตรียมเรียก Payment API; Backend/Webhook จริงยังไม่มีใน repository นี้
