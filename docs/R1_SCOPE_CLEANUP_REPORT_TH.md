# R1 Scope Cleanup — Melearn Final 1.6

วันที่ 7 ตุลาคม 2026 · branch `refactor/v1-api-ready`

ผู้ใช้สั่ง “ทำต่อเลย” หลังรับรายงาน R0 จึงเริ่ม implementation ตาม [execution plan](FRONTEND_REFACTOR_PLAN_TH.md) โดยไม่ deploy/merge main หรือ reset ข้อมูลใน browser ขอบเขตธุรกิจยังเป็น [Final 1.6](MELEARN_V1_SCOPE.md) ผลต่อ API จริงต้องตรวจแยกจาก prototype

## จุดเริ่มและขอบเขต

เริ่มจาก checkpoint R0 `7991f0c7d5899161318fbf09a09182b39d5957e2` working tree/index สะอาด ใช้ Luna xhigh implementation agents แบ่งไฟล์ไม่ทับกัน Lead review/import integration/ตรวจงาน/Git checkpoints เอง ไม่ใช้ R0 inventory roles เขียน source โดยเงียบ ๆ

## R1a — แยก retained dependencies

- แยก `payments` สำหรับ Stripe checkout/result และ `redeem` สำหรับหน้ารับโค้ด/Admin codes ออกจาก legacy `commerce`; roster ผู้สอนย้าย gate ไป `instructorCourses` ทุกสถานะยัง prototype ไม่เปิด production routes จาก build ที่ผ่าน
- ย้ายคิวตรวจคำตอบและ types ไป `src/lib/assessment-review.ts`; queue/grading consumers ไม่ import analytics helper อีกต่อไป analytics เดิมยัง re-export เพื่อให้ dashboard ทำงานจนถอนในชุดถัดไป
- คิวตรวจมี scoped layout/filter CSS ของตน ไม่ import `analytics.css`; roster ใน InsightPages ไม่มี dependency กับ analytics อยู่แล้ว จึงไม่สร้าง abstraction เพิ่ม
- แยก PaymentPages/RedeemCourseCodePage จาก CommercePages ซึ่งเหลือ Orders/OrderDetail; App import จากเจ้าของใหม่ URL/guards/persistence behavior ยังเดิมใน checkpoint นี้
- เพิ่ม semantic route-owner tests ให้จับ Payment/Redeem/roster ที่กลับไปผูก legacy gates แม้ config กับเอกสารจะตรงกันเอง

**ยังไม่ใช่ scope cleanup ทั้งหมด:** R1a ยังเก็บ legacy routes/actions รวม Admin grading, Redeem ที่สร้าง Order/share และ local persistence เดิมไว้เพื่อย้อนชุด structural prep ได้ สิ่งเหล่านี้ต้องถอนใน R1b/R1c

### ผลตรวจ R1a

| Check | ผล |
| --- | --- |
| `npm.cmd run typecheck` | PASS |
| `node --test tests/*.test.ts tests/*.test.mjs` | PASS 52/52; รวม historical tests ของส่วนที่ยังไม่ถอน |
| `npm.cmd run build` | PASS Vite 7.3.6; warnings module `use client` ใน libraries และ chunk >500KB ยังมี; index JS 2,980.96kB/gzip901.27kB |
| Browser `/teach/reviews` | session Admin เดิม: queue แสดง 4 รายการพร้อม filters/grade controls ตาม baseline R1a; computed queue เป็น flex/column/gap20px, filter เป็น flex/wrap |
| Browser `/learn/redeem` | หน้า input/check code แสดงตามเดิมหลัง extraction; ไม่ส่งโค้ด/สร้างรายการ/ทำ mutation |
| Console | พบ Ant Alert `message` deprecation warning; ไม่มีหลักฐาน JS runtime exception จาก navigation ที่ตรวจ |
| ข้อมูล/session | ไม่ sign-in/out/switch role/reset storage/save/grade/pay; navigation อาจทำ persistence effect ของแอปเอง ไม่ export browser data |

ผล browser นี้เป็น Admin navigation เท่านั้น ไม่ใช่ learner/instructor lifecycle, mobile/visual acceptance ครบทุกหน้า หรือ live API/Stripe/backend integration

## R1b/R1c — งานที่กำลังตามต่อ

ถอน out-of-scope capabilities/permission gaps ตาม R0 matrix แล้วจัด state/actions/fixtures/loader และ Redeem compatibility ที่ไม่สร้าง Order/share โดยตรวจว่า stored attempts/enrollments/certificates/used codes ยังอยู่ ปิดช่อง reseed legacy data และคง learning-history guards ก่อน checkpoint ชุดถัดไป

## Rollback

R1a ย้อนด้วย revert checkpoint ของชุดนี้ ไม่ reset branch/history; code rollback ไม่คืน browser schema หรือข้อมูลที่บันทึกแล้วโดยอัตโนมัติ `prototype`/tag คงจุดเดิม ไม่รวม generated dist/node_modules หรือ secrets ใน commit
