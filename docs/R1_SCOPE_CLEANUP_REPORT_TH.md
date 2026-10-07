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

## R1b/R1c — Functional cleanup และ compatibility

- ถอน 28 routes จาก baseline 89 เหลือ 61 routes/59 feature paths และ 13 feature keys; ถอน 44 tracked files ของ legacy capability/fixtures/tests; ถอน Cart/Orders เต็ม, Inbox, Finance/share/referral, analytics/comparison, Assignment แยก, instructor requests/invites, Guest lesson preview, public certificate verification และ Admin global certificate browser พร้อม source/CSS/tests ของ capability ที่เลิกใช้
- Admin directory ยังคง `/admin/instructors` โดยแยกจาก requests/invites; เพิ่มบทบาท Instructor ให้บัญชี Learner เดิมที่เข้าเงื่อนไขผ่าน action เฉพาะ ไม่เปิดการเปลี่ยน role แบบอิสระ
- ถอน destructive course deletion; คง course authoring, management preview, roster/progress/result และ owner certificate URL ที่อยู่ใน scope UI ของ retained flows ไม่มี redesign
- Admin ไม่มี grading entry/action; Instructor ตรวจได้เฉพาะ submitted/pending ของคอร์สตน; helper ตรวจ quiz/course relationship; notification destinations และ grading returnTo จำกัด retained local routes
- Learner/Instructor learning writes ต้องมี Enrollment และเงื่อนไขบัญชี; ถอด first-lesson public bypass; Instructor ยังเรียนคอร์สของผู้อื่นได้ตามสิทธิ์
- `redeemCodes` มี unused/used/revoked ใช้ครั้งเดียว ไม่มี expiry สำหรับโค้ดใหม่; Redeem transition เพิ่ม Enrollment ไม่สร้าง Order/share; legacy cash codes map โดยหลักฐานการใช้ ส่วน discount codes ไม่สร้างสิทธิ์
- คง `/checkout/:orderId/result?channel=redeem` ผ่าน read-only adapter ของรายการเดิม: แสดงสิทธิ์เฉพาะ Enrollment ที่มีอยู่แล้ว ไม่ให้สิทธิ์จาก paid order เพียงอย่างเดียว; URL retained ไม่เปลี่ยน ส่วน 28 URL ที่ถอดเข้า Not Found ไม่มี redirect ไปความสามารถใหม่
- loader ไม่เติม fixture rows ใน saved snapshot; เก็บ retired collections/metadata เช่น assignmentId ที่ผูกกับ attempt ใน `legacyPrototype.collections` แบบ inert; คง answers/scores/IDs/enrollments/certificates/progress/used codes ที่อ่านได้
- malformed rows/progress หรือ saved root ที่อ่านไม่ได้ถูกเก็บใน rejectedSnapshotFields/unreadableStoredSnapshot ไม่ใช้เป็น active state และไม่ reseed sample data แทน; round-trip tests ตรวจ idempotency การเก็บข้อมูลนี้เป็น local compatibility ไม่ใช่ API DTO
- ถอด unused assignment fixture และ comparison seed metadata; historical R0 source links ใช้ Git baseline `19ec7aa3389a14dd79328a1c8e8285c24f171865` เพื่อยังอ่านหลักฐานของไฟล์ที่ถอนแล้วได้

### ผลตรวจ R1b/R1c

| Check | ผล |
| --- | --- |
| `npm.cmd run typecheck` | PASS |
| `node --test tests/*.test.ts tests/*.test.mjs` | PASS 53/53 รวม migration/history/redeem/route ownership/notification/grading checks |
| `npm.cmd run build` | PASS Vite 7.3.6 ใน 33.91s; index JS 2,585.06kB/gzip797.35kB; library use-client warnings และ chunk >500KB ยังมี |
| Browser Admin | dashboard/nav ไม่มี legacy entries; access codes แสดงรหัสเดิมที่ใช้แล้ว; `/teach/reviews` Unauthorized; `/account/cart` Not Found |
| Browser Instructor | คิวตรวจแสดง 3 งานของเจ้าของคอร์ส เรียงตามเวลาส่ง; `/learn/redeem` เปิดได้ |
| Session/data | ทดสอบสลับบทบาทตัวอย่าง Admin → Instructor → Admin และยืนยันคืน session เดิม; ไม่ grade/create/revoke/redeem/pay/reset ข้อมูลผ่าน browser |
| Console | Ant Alert message deprecation warning เดิม; ไม่พบ runtime exception ในหน้าที่ตรวจ |
| Git | R1a checkpoint `e1a97e3abe84bcff0d404666d359b8af21a80e84` push แล้ว; R1b/R1c เป็น checkpoint ถัดไปบน branch เดิม |

### สิ่งที่ยังต้องทำตาม phase ถัดไป

R1 เป็น scope cleanup ของต้นแบบ ไม่ใช่ Final 1.6 implementation ครบหรือ API readiness: แอปยังรวม Web/Admin, server state ยังอยู่ local store, permission/score/progress/payment/quota ต้องย้ายไป backend ตาม contract; grading thresholds/media completion/highest score/AI quota/auth flows ตรวจและปรับใน phases ที่กำหนด ไม่อนุมานว่า tests/build ทำให้พร้อม production ไม่มี live Stripe/backend acceptance หรือ mobile/visual regression ครบทุกหน้า ขั้นถัดไป R2a พิสูจน์ controlled authoring core interface ก่อน R2b split workspace

## Rollback

R1a ย้อนด้วย revert checkpoint ของชุดนี้ ไม่ reset branch/history; code rollback ไม่คืน browser schema หรือข้อมูลที่บันทึกแล้วโดยอัตโนมัติ `prototype`/tag คงจุดเดิม ไม่รวม generated dist/node_modules หรือ secrets ใน commit
