**เอกสารประวัติ — เลิกใช้เป็นข้อกำหนดปัจจุบัน 6 ต.ค. 2026**

รายการช่องว่างจากการตรวจต้นแบบ 1 ต.ค. ไม่ใช่ backlog ที่อนุมัติ งาน Admin รอบแรกให้ใช้ฉบับหลัก

ข้อมูลหลักคือ [MELEARN_V1_SCOPE.md](../../MELEARN_V1_SCOPE.md) ห้ามใช้ข้อความด้านล่างกำหนด scope/permission/API ปัจจุบัน

---

# สิ่งที่แอดมินยังขาด — source audit และรายการทำเร็ว

ตรวจต้นแบบปัจจุบันวันที่ 1 ต.ค. 2026 ภายใน elearning-ux-v2 รวม source TypeScript ที่ยังเป็นงานค้างใน checkout ขณะตรวจ ไม่ใช่การตรวจ backend Production และไม่ได้จัดเฟสแทนเจ้าของระบบ

Branch ของรายงานธุรกิจอาจยังไม่มีฟีเจอร์จากงานค้างทั้งหมดด้านล่าง ต้องรวม migration/ฟีเจอร์เดิมอย่างมีการตรวจอีกครั้งก่อนถือว่า release เดียวกัน

## มีอะไรแล้ว และขาดตรงไหน

| งานแอดมิน | สิ่งที่ source มีแล้ว | สิ่งที่ขาดสำหรับใช้จริง | ความเร็วในการเตรียม UX / ตัวพึ่งพา |
| --- | --- | --- | --- |
| ภาพรวมปฏิบัติการ | AdminPages: คำขอผู้สอน งานรอตรวจ คอร์ส ยอดซื้อ; ชุดนี้เพิ่มผู้เรียน ผู้สอน enrollments pending/failed orders | การแจ้งเตือนงานค้างพร้อมเจ้าของ/อายุงาน/ลำดับความสำคัญ | เร็วจาก state เดิมบางส่วน; ต้องยืนยัน SLA |
| ภาพรวมธุรกิจ | ชุดนี้มีกราฟรายวัน active/visitors/sessions/enrollments/purchases heatmap/funnel | traffic ทั้งเว็บ แหล่งที่มา bot filtering registered_at cohort retention attribution | UI เร็ว; ข้อมูลจริงต้อง event tracking/identity |
| รายงานการเงิน | ชุดนี้มี synthetic charge/refund/fee/net ledger/CSV/Drawer | payment/refund/fee records, settlement reconciliation, accounting definitions | UI ทำแล้ว; ใช้เงินจริงไม่ได้จนมี ledger/backend |
| คำสั่งซื้อ | OrderPages และ CommercePages: สถานะ/ค้นหา/รายละเอียด | state history, webhook/idempotency, manual recovery, partial refund approval | หน้ารายละเอียดเตรียมเร็ว; action จริงต้อง provider/rules |
| รายรับ/ค่าใช้จ่าย/ใบเสร็จ | ยังไม่พบ expense/invoice/tax domain | เอกสารรับเงิน เลขเอกสาร ค่าใช้จ่าย ภาษี และการยกเลิกเอกสาร | ต้องตกลงกติกากิจการ/บัญชีก่อน ไม่เดาอัตรา |
| ยอดโอน/ส่วนแบ่งผู้สอน | ไม่พบ payout/commission | รอบโอน สูตรส่วนแบ่ง adjustments recipient onboarding | ต้องถามว่าระบบมีส่วนแบ่งหรือไม่ก่อนเป็น requirement |
| ผู้ใช้ | AdminPages: list/search/role/detail และ changeUserRole; type มี status | registered_at/last_active, suspend/reactivate flow ที่ enforce จริง, session revocation, history | ตาราง/ตัวกรองเร็ว; lifecycle backend และกติกาต้องเพิ่ม |
| สิทธิ์แอดมิน/องค์กร | RolePage และ role menus ของ prototype | granular permissions, tenant isolation, ป้องกัน IDOR, audit role change | ตาราง permission เตรียมเร็ว; server enforcement จำเป็นก่อนจริง |
| ผู้สอน/คำเชิญ | approve/reject/create invite ใน store | resend/expiry, delivery, verification, review history | UX expiration/resend เร็ว; email/provider และเกณฑ์อนุมัติยังต้องเลือก |
| คอร์ส/เนื้อหา | list/search/editor/publish/curriculum/upload preview | draft version/approval/archive, asset ownership/quota, access impact on existing learners | UI archive/version preview พอเตรียมได้; business rules ต้องตกลง |
| งานมอบหมาย/ผลการเรียน | AssignmentsPage, AnalyticsPage, review queue, Pre/Post | backend assignments/attempt rules, bulk operations และ audit grade changes | รายงาน/ตัวกรองเพิ่มเร็วจาก state; ไม่ใช่คะแนนจริง |
| อินบ็อกซ์/บริการผู้เรียน | InboxPage/store และ permission spec ของ prototype | team ownership/assignment, response status/SLA, delivery, abuse controls, server access | status/assignment UX เร็ว; permission/delivery ต้อง backend |
| แจ้งเตือน/ประกาศ | browser notification/inbox unread ของ prototype | broadcast target preview, delivery outcome/retry, preferences/email/push | ตัวอย่าง center/target preview ทำง่าย; ส่งจริงต้องบริการและ permission |
| ใบรับรอง | list/detail/verification flow | revoke/reissue state history, access scope, audit และเอกสารที่ออกจริง | ตาราง lifecycle เตรียมเร็ว; กติกาเพิกถอนต้องยืนยัน |
| บทความ | BlogAdminPages: draft/publish/editor | scheduling/revision/approval และ asset lifecycle | บางส่วนเร็วจาก state แต่ไม่ใช่สิ่งเร่งด่วนก่อนเงิน/สิทธิ์ |
| การตลาด/ราคา | ราคาคอร์ส และ checkout prototype | coupon/discount campaigns, valid periods, attribution | ทำเมื่อยืนยันว่าต้องมีโปรโมชั่น; ไม่ถือเป็น mandatory โดยอัตโนมัติ |
| ตั้งค่าระบบ | ยังไม่พบ admin settings ที่รวมกติกา | organization profile/support channel, locale/timezone, feature access | ฟอร์ม read-only/draft ง่าย; ตั้งค่าเงินจริงต้อง validate/audit |
| Data export/audit | ชุดนี้มี CSV synthetic เฉพาะรายงาน | server exports, sensitive-data scope, audit log, retention/deletion | UX log/export เตรียมเร็ว; backend security เป็น prerequisite |
| สุขภาพระบบ/สำรอง | ไม่มีหลักฐาน production monitoring ใน prototype | webhook failures, job health, backups/restore verification | ไม่ใช้หน้าสรุปสวยเป็นหลักฐาน backup; ต้อง infra จริง |

## ทำง่ายและคุ้มก่อน โดยยังไม่แบ่งเฟส

1. **ทำในชุดนี้แล้ว:** ทางเข้ารายงาน, ตัวเลขผู้ใช้/ลงทะเบียน/คำสั่งซื้อจาก state, business daily chart/heatmap/funnel และ financial transaction report พร้อม CSV และสเปก
2. **ต่อเร็วจากข้อมูลเดิม:** แถว “งานต้องจัดการ” ที่กดไปคิวได้, ตัวกรอง pending/failed ให้ครบ, รายละเอียด order แสดงสถานะชัด, รายงาน course/user พร้อม scope/export ที่เหมาะสม
3. **เตรียม UX ได้เร็ว แต่ต้องเพิ่มข้อมูล:** user last-active/history, support status/assignee, notification delivery status, invitation expiry และ content lifecycle
4. **ต้องตกลงก่อน action จริง:** refund approvals, payment provider, receipts/tax, instructor commission, organization permission และ suspension/access rules

คำว่า “เร็ว” หมายถึงงาน UI/ตัวอย่าง ไม่ใช่ความพร้อม production ห้ามเพิ่มปุ่มที่ทำเงินจริง/เปลี่ยนสิทธิ์จริงโดยไม่มี service/rules รองรับ

## ขั้นต่ำที่ต้องมีเมื่อเริ่มเปิดให้ชำระเงินจริง

- Payment/order/enrollment linkage พร้อม authoritative success, idempotency และ history
- รายงานเงินรับ/คืน/fee ที่กระทบยอดกับรายการได้ การคืนเงินจริงตรวจสิทธิ์และติดตามผล
- สิทธิ์อ่าน/export ข้อมูลเงินและข้อมูลผู้เรียน พร้อม audit trail
- รูปแบบเอกสารรับเงินและภาษีที่ผู้รับผิดชอบกิจการยืนยัน
- การจัดการธุรกรรมผิดพลาด การช่วยเหลือผู้ซื้อ และการสำรอง/กู้ที่ตรวจจริง

ไม่จำเป็นต้องรอ ML หรือ advanced attribution เพื่อทำขั้นต่ำเหล่านี้; แต่ควรออกแบบ raw events ตั้งแต่ต้นตาม [สเปกข้อมูล](BUSINESS_ANALYTICS_DATA_SPEC.md) เพื่อไม่ต้องเก็บประวัติย้อนหลังใหม่

## Evidence และขอบเขต

ตรวจ routes ใน `src/App.tsx`, menus ใน `src/components/Shell.tsx`, admin pages, types, data/store, AssignmentsPage และ inbox source ไม่ได้ตรวจว่า server/API/service จริงมีอยู่ที่อื่น จึงใช้คำว่า “ไม่พบในต้นแบบ” แทนการสรุปว่าทั้งองค์กรไม่มีระบบนั้น

UI ใหม่และ acceptance อยู่ใน [UI specification](BUSINESS_ANALYTICS_UI_SPEC.md) ระบบจริงต้องออกแบบ API/error/permission/ledger ตาม contract ที่ยืนยันแล้ว ไม่เอา mock JSON เป็น schema สุดท้ายโดยตรง
