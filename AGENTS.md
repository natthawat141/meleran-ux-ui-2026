# AGENTS.md — Melearn UX/UI

## Read before editing

อ่าน [`docs/UI_SPEC.md`](docs/UI_SPEC.md) และ [`docs/CODE_SPEC.md`](docs/CODE_SPEC.md) ให้ครบก่อนแก้ UI หรือ code ใช้ [`docs/README.md`](docs/README.md) สำหรับแผนผังเอกสารและวิธีเปิดกับ AI แต่ละตัว

อ่าน [`docs/GIT_CHECKPOINT_POLICY_TH.md`](docs/GIT_CHECKPOINT_POLICY_TH.md) ด้วย: ผู้ใช้ยืนยัน 1 ต.ค. 2026 ให้ commit และ push อัตโนมัติเมื่อชุดงานที่สั่งผ่านการตรวจ พร้อมรายงาน SHA/branch/ผล push รักษา staged/dirty work ของผู้อื่นและแยก branch เมื่อทำพร้อมกัน

Repository นี้เป็น interactive UX prototype ของ Melearn: React + Vite + TypeScript/TSX ยังไม่มี backend Production ข้อมูล บัญชี การจ่ายเงิน และการสลับบทบาทเป็นการจำลองในเบราว์เซอร์

เมื่อเปิด repository แยกจาก workspace ให้อ่านไฟล์นี้ได้โดยไม่ต้องมี `D:\code\elearn-prod` อยู่บนเครื่อง เมื่อทำงานใน workspace ใหญ่ ให้อ่าน `../AI_WORKSPACE_GUIDE_TH.md` ด้วย ห้ามแก้โปรเจกต์ reference อื่นโดยอัตโนมัติ

## Priority and scope

- อ่าน [กติกาคุยแบบและมอบหมายงานโค้ด](docs/AI_DELEGATION_POLICY_TH.md): คุยและตกลงแบบก่อนเมื่อผู้ใช้ขอ งานโค้ดง่าย ๆ ให้ subagent GPT-6 Luna ลงมือ โดย agent หลักกำหนดสเปกและตรวจงาน
- คำสั่งล่าสุดและคำยืนยันเฉพาะของผู้ใช้เป็นทิศทางหลัก สเปกนี้รักษาสิ่งที่ตกลงแล้ว ไม่ได้ล็อกทุกหน้าตลอดไป
- ตรวจ route และ source ปัจจุบันก่อนแก้ เก็บ flow ที่ผู้ใช้รับแล้ว และทำหน้าที่ผู้ใช้ระบุให้ครบ
- ถ้าผู้ใช้ให้คุยหรือวางแผนก่อน ให้ส่งข้อวิเคราะห์ก่อนเริ่ม code ถ้าสั่งแก้แล้ว ให้ดำเนินงานในขอบเขตนั้น ไม่ขออนุมัติการเลือก component หรือ spacing ตามปกติซ้ำ
- ตรวจ `git status` ก่อนทำงาน รักษาการแก้ค้างของผู้ใช้ และรายงานสิ่งที่ยังไม่ได้ตรวจตามจริง

## Design guardrails

- พื้นขาว + ฟ้าอ่อนเย็น + primary `#0074e8`; ข้อความและเงาใช้ neutral เข้ม ฟอนต์ `Anuphan Variable`
- ห้ามเพิ่มครีม เหลือง earth tone ม่วง หรือส้มเป็นสีตกแต่ง ใช้ semantic status color ของ theme เฉพาะสถานะที่มีความหมาย
- ใช้โลโก้จริงใน `src/assets/melearn-ui/logo.PNG` และ asset ที่มีอยู่ ห้ามแทนด้วยตัวอักษรหรืออีโมจิ
- ใช้ component ที่มีอยู่ก่อน: Mantine สำหรับ workspace shell, Ant Design สำหรับ CRUD/form/table, shadcn/Base UI ที่มีอยู่สำหรับ login/register, Tiptap สำหรับเนื้อหา, Motion สำหรับ animation
- ห้ามเปลี่ยนทุกหน้าเป็นการ์ดเหมือนกัน ห้ามสร้าง input/button ใหม่เลียนแบบ library หรือเพิ่ม library เพื่อเปลี่ยนหน้าตาอย่างเดียว
- หน้าจัดบทต้องแก้รายการวิดีโอ บทอ่าน และแบบฝึกหัดได้จริงใน prototype ใช้ editor ตามชนิดเนื้อหา ไม่ลดเหลือฟอร์ม text ล้วน
- Navbar จอเล็กเก็บ action บัญชีไว้ในเมนู ผู้ใช้ใน workspace อยู่ด้านขวา Footer public มีชุดเดียว
- โหมดมืดเตรียม token ไว้แล้ว ค่าเริ่มต้นเป็น light ยังไม่เพิ่มปุ่มสลับจนกว่าผู้ใช้สั่ง
- ไม่ใช้ Impeccable ที่ผู้ใช้ยกเลิก และไม่ให้ skill/template เปลี่ยนแบรนด์ที่ตกลงไว้

## Delivery

- แยก page, component, state และ CSS ตามหน้าที่ จัด JSX ที่เพิ่มใหม่ให้อ่านง่าย
- ใช้คำไทยตรงงาน บอกสถานะบันทึก ข้อผิดพลาด และผลการกระทำให้ผู้ใช้เข้าใจ
- ตรวจเท่าที่เหมาะกับการเปลี่ยนแปลง: code เปลี่ยนให้รัน build; เอกสารอย่างเดียวตรวจ path/link และความสอดคล้อง ดู flow ที่แก้เท่าที่เครื่องมืออนุญาต ไม่อ้างว่าเทสต์หน้าที่ไม่ได้เปิด
- `npm.cmd run dev -- --port 5174` สำหรับ preview; `npm.cmd run build` สำหรับ build ใน Windows
- คำขอแก้ UI ไม่ใช่อนุญาต deploy เปลี่ยนข้อมูลจริง หรือ reset เดโมของผู้ใช้ Commit/push ใช้กติกา checkpoint กลาง เลือกเฉพาะไฟล์ในขอบเขตและแจ้งงานค้างที่ไม่ได้รวม
- สรุปงานเป็นภาษาไทย บอกสิ่งที่เปลี่ยน เหตุผล และผลตรวจที่สำคัญ
