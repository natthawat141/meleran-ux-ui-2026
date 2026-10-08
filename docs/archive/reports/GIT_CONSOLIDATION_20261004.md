# รวม Git ของต้นแบบ — 4 ตุลาคม 2026

ผู้ใช้สั่งรวม branch และงาน checkout ที่ค้างให้เป็นรุ่นล่าสุดบน main รวมถึงลดจำนวน branch บน GitHub ขอบเขตนี้ไม่ใช่ deploy หรือสร้างระบบ Production

## การตัดสินใจรวม source

Baseline คือ main `780e13a` ที่รวม TypeScript และ UX ล่าสุดแล้ว ตาม [ผลรวมงานก่อนหน้า](WORKSPACE_INTEGRATION_20261004.md) จากนั้น fast-forward ไป `adbdcdf` เพื่อรับโค้ดส่วนลด โค้ดเรียนฟรี และโค้ดเงินสดรุ่น TypeScript

| งานเดิม | วิธีรักษางาน |
| --- | --- |
| checkpoint/workspace-updates-2026-10-01, docs/verified-checkpoint-policy-20261001 | รักษา tooling และเอกสารรุ่นปัจจุบัน ซึ่งรวมกติกาเดิมแล้ว |
| feature/admin-business-reports | รายงานธุรกิจอยู่ที่ /admin/reports/finance แยกจากส่วนแบ่งผู้สอน /admin/finance |
| feature/instructor-analytics และงานค้าง | ใช้ typed analytics, comparison selectors, fixtures และ tests ที่รวมไว้แล้ว รักษา admin route รุ่นใหม่ |
| preview/landing-soft-shapes-20261003, preview/landing-yellow-20261004 | รักษา Landing ที่รวมและย้ายเป็น TypeScript แล้ว |
| codex/main-push-20261004, codex/course-cart-price-alert-20261004 | อยู่ในประวัติ main และมีโปรไฟล์ ตะกร้า การแจ้งราคา และรายได้ผู้สอนแล้ว |
| codex/discount-codes-20261004 | ใช้ TypeScript port adbdcdf แทน source JSX เก่า |
| งานค้าง elearn-prod-features | ย้ายกติกาสิทธิ์ผู้สอน การเก็บคำตอบและโจทย์ ณ เวลาเริ่มทำ และการมอบหมายงานเข้า schema ปัจจุบัน |

งานค้างสอง checkout ถูกเก็บเป็น snapshot แยกก่อนรวม ไม่ถือว่า source เก่าผ่านการตรวจ การรวม ancestry ของ branch เก่าใช้ merge strategy ours หลังตรวจและรวม implementation ที่เหมาะสมแล้ว เพื่อไม่คืน JSX, route ซ้ำ หรือ UI ที่ถูกแทนด้วยรุ่นใหม่ ไม่ใช้ force-push หรือเขียนประวัติที่เผยแพร่ใหม่

กติกาจากงานค้างที่เพิ่มกลับมา: ตรวจเจ้าของคอร์สก่อนลบ/มอบหมาย/ตรวจคะแนน, ห้ามลบเนื้อหาหรืองานที่มีคำตอบหรือประวัติเรียน, ยกเลิกงานโดยเก็บคำตอบ, ผูก attempt กับ assignment และเก็บ quizSnapshot สำหรับหน้าเรียน/ผล/ตรวจคะแนน ใช้แบบฟอร์มและการตรวจคะแนนรวมรุ่นปัจจุบัน ข้อมูล learnerIds รุ่นเก่าถูกอ่านเป็น assigneeIds โดยไม่ reset browser storage

## Archive และการกู้คืน

สำรอง branch tips ทั้งหมด 11 tips และงานค้าง 2 snapshots เป็น annotated tags บน GitHub ใน prefix `archive/git-consolidation-20261004/` รวม 13 tags

- `pending-features`: `f3ff85379ebbc412fc6ad151188a59366658d96b`
- `pending-instructor-analytics`: `a10ab7a7a60592a4af1c8fdadf5c90c13ab4dc36`
- `main`: baseline `780e13a0bc1dde8c664e2ae2dd4bb4d1ebc7f101`

สำเนาภายนอก repository: `D:\code\elearn-prod\.recovery\git-consolidation-20261004-143750` มี manifest, SHA256, staged/unstaged patches และ source ที่ค้าง ไม่สำรอง secrets, .env, dependencies หรือ browser data

เอกสารร่างเก่า AI_CONTRIBUTING.md, DESIGN.md, UX-CONTRACT.md, docs/API-MOCK-BOUNDARY.md และ docs/LEARNER-ANALYTICS-UI-SPEC.md อยู่ใน pending-features archive ไม่วางทับสเปกกลาง UI_SPEC/CODE_SPEC หรือใช้ schema/เส้นทางเก่าเป็นกติกาปัจจุบัน คำอ้างถึง learner analytics ใน source เป็นที่มาทางประวัติเท่านั้น

กู้ใน checkout ใหม่ เช่น `git worktree add --detach <new-path> archive/git-consolidation-20261004/pending-features` ห้าม restore ทับงานใหม่ ตรวจ manifest ก่อนเลือกไฟล์ที่ต้องการ

## ตรวจชุด source ที่รวม

- `npm.cmd run typecheck`
- `npm.cmd run build` (warnings เดิมเรื่อง dependency directives และขนาด chunk)
- `node --test tests/business-reports.test.mjs tests/profile-model.test.mjs tests/instructorAnalytics.test.ts tests/instructor-finance.test.mjs tests/learning-history.test.mjs`: 19 tests
- `git diff --check` และตรวจรายการ staged files เฉพาะชุดนี้

ไม่มี browser preview ยาวหรือ deploy ในงานนี้ ผลทดสอบเป็นหลักฐานของต้นแบบและ local selectors ไม่ยืนยัน server authorization หรือบัญชี Production

## การจัด checkout และ branch

เมื่อ push main และตรวจ remote SHA แล้ว ให้ checkout หลักอยู่บน main ส่วน checkout รองทั้งแปดอยู่ detached ที่ main รุ่นเดียวกัน รักษาโฟลเดอร์และ ignored local files ไว้ งานค้างต้นฉบับต้องตรงกับ snapshot SHA256 ก่อนผูก HEAD/index กับ snapshot แล้วจึงเปลี่ยน checkout

ลบเฉพาะ branch ที่ตรวจ ancestry แล้วว่ารวมเข้ากับ main และมี archive tag บน remote: remote แปด branch และ local สิบ branch ทั้งหมด ยังคง main และ archive tags สำหรับกู้คืน
