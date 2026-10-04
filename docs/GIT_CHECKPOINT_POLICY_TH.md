# กติกาจุดย้อนกลับ: Commit และ Push หลังงานผ่านการตรวจ

ผู้ใช้ยืนยัน 1 ตุลาคม 2026 · ใช้กับ `elearning-ux-v2` · กติกากลางสำหรับ Codex, Gemini และ Cursor

## 1. สิ่งที่ผู้ใช้อนุญาต

เมื่อทำงานที่ผู้ใช้สั่งเสร็จเป็นชุดที่ตรวจแล้ว ให้ **commit และ push อัตโนมัติ พร้อมรายงานผลทุกครั้ง** ไม่ต้องถามอนุญาต Git ซ้ำสำหรับชุดนั้น คำสั่งเฉพาะล่าสุด เช่น “ยังไม่ commit”, “local เท่านั้น” หรือ “ยังไม่ push” มีน้ำหนักเหนือกติกานี้

กติกานี้อนุญาตเฉพาะการเก็บงานที่ได้รับมอบหมาย ไม่อนุญาตเพิ่มฟีเจอร์เอง เปลี่ยน UI/สิทธิ์เอง deploy หรือรวมงานค้างทั้งหมด การ push ไม่ใช่ deployment และไม่ยืนยันว่างานถูก merge เข้า main แล้ว

งานอ่าน/วิเคราะห์ที่ไม่เปลี่ยนไฟล์ไม่ต้องสร้าง empty commit งานเอกสารต้องผ่านการตรวจเอกสาร ส่วนงาน code ต้องผ่านการตรวจที่เกี่ยวข้องตาม [CODE_SPEC.md](CODE_SPEC.md) และคำสั่งเฉพาะงาน

## 2. ก่อนเริ่มแก้

1. ยืนยัน repository root, branch, HEAD, remote และ upstream ตรวจ `git status --short` กับ diff ทั้ง staged/unstaged รวม untracked ที่เกี่ยวข้อง
2. บันทึกงานค้างเดิมกับรายการไฟล์ที่เป็นขอบเขตของตนเอง ไม่ถือว่าไฟล์ dirty ทุกไฟล์เป็นงานของตน
3. ก่อน migration/refactor/rename จำนวนมาก ให้เก็บ checkpoint ของ baseline ที่ตรวจแล้ว และ push ก่อนเริ่ม ถ้า baseline ยังไม่ผ่านหรือรวม dirty work ของผู้อื่น อย่า commit ว่าเป็นเวอร์ชันที่ผ่าน ให้เก็บ recovery snapshot แยกและรายงานข้อจำกัด
4. Snapshot ต้องครอบคลุมไฟล์ tracked/untracked ที่เกี่ยวข้องและการลบ/rename เก็บ SHA ของ baseline, diff staged/unstaged, manifest และคำอธิบายการกู้คืน ไม่เก็บ secrets, `.env*`, browser storage หรือข้อมูลผู้ใช้จริงใน Git/remote
5. Snapshot ขณะอีก agent กำลังเขียนไฟล์ไม่ใช่ atomic snapshot ให้ติดป้ายว่าเป็น live recovery copy และบันทึกไฟล์ที่เปลี่ยน/อ่านไม่ได้ ห้ามอ้างว่าเป็นเวอร์ชันก่อนเริ่มงาน

## 3. ขนาดและเวลาของ checkpoint

- หนึ่ง commit คือหนึ่งชุดงานที่อธิบายและย้อนแยกได้ เช่น “เพิ่มกติกา Git”, “ตั้ง TypeScript tooling”, “ย้าย data/selectors” หรือ “ย้ายหน้าผู้เรียน”
- งานใหญ่ให้แบ่งชุดที่ build/typecheck และ flow ที่เกี่ยวข้องผ่าน ไม่รอจนเปลี่ยนทั้งระบบแล้วค่อย commit ครั้งเดียว
- ชุดงานต้อง self-contained: รวม imports, config และไฟล์ที่จำเป็นต่อการใช้งานชุดนั้น ไม่ push source ที่ rename ครึ่งทางจน build พัง
- ถ้าชุดยังไม่ผ่าน ห้ามประกาศว่างานโอเคหรือ push เป็น checkpoint ที่ผ่าน ใช้ snapshot สำหรับกู้ระหว่างทำ แล้วแก้ต่อ

## 4. เลือกไฟล์และป้องกันงานปน

- Stage เฉพาะรายการ path ที่เป็นงานชุดนี้ ตรวจ diff ของแต่ละไฟล์ก่อน stage และตรวจ staged diff อีกครั้ง รวมรายการลบ/rename ด้วย
- ห้าม `git add .`, `git add -A` ทั้ง repository, blanket commit หรือ stage ด้วย wildcard ที่รวมไฟล์ไม่เกี่ยวข้อง
- ถ้ามี staged files ของผู้อื่น ห้าม unstage/เปลี่ยน index ของเขาเพื่อความสะดวก และห้าม commit index รวมโดยไม่ตรวจ
- หากไฟล์เดียวกันมีการเปลี่ยนจากหลายงาน ให้เลือกเฉพาะ hunks ที่แยกได้และตรวจว่าชุดนั้นทำงานครบ ถ้าแยกอย่างมั่นใจไม่ได้ ให้เก็บ snapshot และแจ้งความจำเป็นในการประสาน ไม่เดาว่างานทั้งหมดเป็นของตน
- ตรวจ secrets และไฟล์ที่ไม่ควรอยู่ใน commit เช่น `.env`, uploads จริง, browser export, `node_modules`, `dist` และ artifacts ที่ใช้ได้เฉพาะเครื่อง
- อย่าเปลี่ยนชื่อ branch, checkout, rebase, amend หรือ reset งานของผู้อื่น ห้าม force-push และห้ามแก้ประวัติที่ push แล้ว

## 5. เมื่อมีหลาย agent ทำงานพร้อมกัน

แยก worktree/branch สำหรับงานเขียนเมื่อทำได้ อย่าให้หลาย agent ใช้ staging และ commit บน checkout เดียวกันพร้อมกัน

- ถ้าอีก agent กำลังย้าย TS ใน checkout หลัก ให้ทำงานเอกสาร/งานอิสระบน branch แยก โดยไม่เปลี่ยน HEAD หรือ index ของ checkout นั้น
- ใช้ worktree หรือ isolated index ที่ตรวจแล้วเฉพาะกรณีรู้วิธีรักษางานเดิมและ commit content ได้ ห้ามใช้เทคนิคนี้เพื่อหลบการตรวจ diff
- Push branch แยกได้ตามกติกานี้ และรายงานว่าอยู่บน branch ใด การ merge/cherry-pick เข้างานของ agent อื่นต้องประสานก่อน ไม่ทำให้ประวัติหรือไฟล์ที่เขากำลังใช้เปลี่ยนโดยเงียบ ๆ
- ถ้าไม่ได้อยู่ในสถานการณ์ concurrent และ branch ปัจจุบันเหมาะสม ให้ใช้ upstream เดิม ไม่สร้าง branch ใหม่ทุก commit โดยไม่จำเป็น
- ตรวจ remote/upstream ของ branch ก่อน push ใช้ปลายทางที่มีหลักฐาน ห้ามส่งไป remote ที่เดาเอง หาก main ขยับให้หยุดการ push ที่ไม่เป็น fast-forward แล้วแก้การรวมงานอย่างเจาะจง ไม่ force

## 6. ตรวจงานก่อน Commit และ Push

| ประเภทงาน | การตรวจขั้นต่ำ |
| --- | --- |
| เอกสาร/กติกา | ลิงก์ path ความสอดคล้อง และ whitespace; ไม่ต้อง build แอปเพียงเพราะแก้เอกสาร |
| Source JavaScript | Build และ flow ที่สัมพันธ์กับการเปลี่ยน |
| Source TypeScript | Typecheck, build และ flow ที่สัมพันธ์กับการเปลี่ยน |
| Migration ทั้งระบบ | เกณฑ์ใน [คำสั่งย้าย TypeScript](TYPESCRIPT_MIGRATION_INSTRUCTIONS_TH.md) รวมการรักษา UI/ข้อมูลเดิม |

ตรวจ whitespace ของไฟล์ใหม่ด้วย เพราะ `git diff --check` ปกติไม่ครอบคลุม untracked จนกว่าจะ stage

ก่อนสร้าง commit ให้ตรวจรายการไฟล์และ diff ใน index ที่จะใช้จริง หลังสร้างให้ตรวจ `git show --stat` และ tree ของ commit อีกครั้ง เพื่อยืนยันว่าไม่ได้รวม source ของงานอื่น

ใช้ commit message ที่บอกผลลัพธ์ เช่น `docs: add automatic verified checkpoint policy` หรือ `refactor: migrate analytics selectors to TypeScript` ไม่ใช้เพียง “done” หรือ “fix everything” รายละเอียดผลตรวจอาจอยู่ใน body หรือรายงานส่งมอบ

หลัง push ให้ตรวจ SHA ของ remote branch ว่าตรงกับ commit ที่ส่ง ถ้า network/authentication ทำให้ push ไม่สำเร็จ ให้เก็บ local commit ไว้และรายงานตรง ๆ ไม่บอกว่าขึ้น Git แล้ว ห้ามซื้อบริการ/เปลี่ยน credentials เพื่อแก้เอง

## 7. สิ่งที่ต้องพูดทุกครั้งหลังส่งมอบ

รายงานสั้น ๆ ให้ผู้ใช้ทราบ:

1. ทำอะไรเสร็จและตรวจอะไรผ่าน
2. Commit SHA และชื่อ branch
3. Push สำเร็จหรือไม่ พร้อมลิงก์ commit เมื่อมี remote URL
4. งานค้าง/ไฟล์ของผู้อื่นที่ไม่ได้รวม และข้อจำกัดที่สำคัญ
5. ถ้ามี snapshot ให้บอกตำแหน่งและว่าเป็น baseline หรือ live copy

ตัวอย่าง: “เพิ่มกติกาแล้ว ตรวจลิงก์ผ่าน · commit `abc1234` · push ไป `docs/checkpoint-policy` แล้ว ยังไม่ได้ merge เข้า main และไม่ได้รวมงาน TS ที่กำลังทำ”

## 8. การย้อนกลับ

- โดยทั่วไปให้ revert commit ของชุดงานบน branch ที่เหมาะสม ตรวจผลหลังย้อนและ push ตามกติกา ไม่ลบประวัติที่เผยแพร่แล้ว
- แยก code rollback ออกจากการคืน browser data/migration ของข้อมูล Commit ไม่ได้สำรอง localStorage, sessionStorage หรือ `.env`
- อย่า restore snapshot ทับ checkout ที่มีคนทำงานอยู่ ตรวจ manifest และสร้างโฟลเดอร์/checkout แยกก่อนเลือกกู้เฉพาะไฟล์
- หากจะทิ้งงานค้าง เปลี่ยนประวัติ หรือย้อนระบบจริง ต้องมีคำสั่งเจาะจงจากผู้ใช้ กติกา auto commit/push ไม่ได้อนุญาตสิ่งเหล่านี้

## 9. การโหลดกติกาใน Agent

AGENTS.md, GEMINI.md และ Cursor rule ของทั้ง workspace และแอปชี้มาที่เอกสารนี้ ไม่ทำสำเนากติกาเต็มหลายชุด

ไฟล์ที่แก้ไม่ได้ทำให้ session ที่กำลังรันอ่านใหม่โดยอัตโนมัติ ต้องให้ agent ที่กำลังทำงานอ่านเอกสารนี้ก่อน checkpoint ถัดไป หรือ reload context ตามเครื่องมือ ตรวจการรับกติกาจากผลจริง อย่าอ้างว่าทุก agent รับแล้วเพียงเพราะเขียนไฟล์
