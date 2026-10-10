# ผลตรวจ Web UI เทียบ Melearn V1 Final 1.6

ตรวจหลักครั้งแรก 7 ต.ค. 2026; Login และ responsive follow-up 8 ต.ค. 2026 · branch `refactor/v1-api-ready` · อ้างอิง [MELEARN_V1_SCOPE.md](MELEARN_V1_SCOPE.md)

## ขอบเขตและข้อสรุป

นี่เป็น **prototype UI/route audit** ไม่ใช่ production acceptance. ตรวจหลักเปิด built Web/Admin preview ด้วย Vite `--mode preview`; ตรวจ Web Landing, Catalog, Course detail, Blog index/article, Instructor public profile, About, Login/Register และ protected-route redirects. จากนั้นใช้บัญชีทดลองที่หน้า prototype เปิดเผยเองเพื่อ spot-check authenticated Learner dashboard/course list/certificate/AI, Instructor dashboard/curriculum/lesson editor และ Admin dashboard/articles/course management/review/users/instructors/redeem codes/course settings/curriculum. การ login เป็น local demo session ใน origin ของ preview เท่านั้น; ไม่ได้เรียก backend หรือทำ business mutation และออกจากระบบหลังตรวจแล้ว. วันที่ 8 ต.ค. ตรวจ Login Web/Admin เพิ่มใน Vite dev preview โดยไม่ submit form: Web แสดง Username/email และทางสมัครผู้เรียน; Admin แสดง copy เฉพาะผู้ดูแลและไม่มีลิงก์สมัคร; Admin non-admin rejection ตรวจด้วย unit test ว่าไม่เปลี่ยน local user. Follow-up responsive วันที่ 8 ต.ค. ตรวจ Guest Landing ที่ viewport จริง 390×844 และ 320×844: CTA เรียงเต็มความกว้างเป็นคอลัมน์เดียว, benefit ทั้งสามรายการไม่ถูกตัด และ `documentElement.scrollWidth` ไม่เกิน viewport; ตรวจ Admin Login ที่ 390×844 พบ form อยู่ในขอบ viewport โดยไม่ submit. Preview/dev mode เปิด route ที่ registry ยังจัดเป็น `prototype`; Production mode ยังคงปิดฟีเจอร์เหล่านั้นตาม gate. API, server permissions, persistence ข้ามอุปกรณ์ และ business fulfillment ไม่สามารถยืนยันจาก browser preview นี้

ส่วน Guest ที่ตรวจเห็น render ได้และ public course/blog มีเนื้อหาให้ดู. Structural route coverage ผ่าน 85 declarations (Web 50, Admin 35) เทียบ R3b snapshot; **ไม่ได้แปลว่าทุก feature ใน Final 1.6 ทำงานครบ**. Source audit พบความไม่ตรงกับข้อกำหนดที่ยืนยันแล้วหลายเรื่อง จึงยังเรียก prototype นี้ว่า V1 production-ready หรือ API-ready ไม่ได้; แก้ feature/business flow ในชุดที่ผู้ใช้อนุมัติแยกจาก R3c

## พื้นที่ที่ตรวจใน browser

| พื้นที่ | ผลการเปิด preview | ขอบเขตของหลักฐาน |
| --- | --- | --- |
| Guest Landing / About | เปิดและเห็น content/CTA/ภาพ/footer; responsive follow-up ของ Landing ที่ 390×844 และ 320×844 ผ่าน โดย CTA/benefit ไม่ถูกตัดและไม่มี horizontal overflow | ตรวจ responsive เฉพาะ Landing สองขนาดและ Admin Login หนึ่งขนาด; ยังไม่ผ่าน breakpoint matrix, contrast หรือ keyboard audit |
| Public Course Catalog / Detail | ค้นหา/หมวด/ตัวอย่างคอร์สและรายละเอียดเปิดได้; direct link และ browser Back ใช้ได้ | เป็น fixture ใน prototype; ยังไม่ได้ทดสอบ enroll, checkout หรือสิทธิ์จาก server |
| Blog index / article | รายการและเนื้อหา Published ตัวอย่างเปิดได้ | ยังไม่ตรวจ Admin publish persistence หรือสิทธิ์จาก backend |
| Instructor public profile | เปิด route และรายการคอร์สตัวอย่างได้ | ไม่ใช่ Instructor workspace |
| Login / Register | Web และ Admin แสดง Username/email field; Web คงสมัครผู้เรียน; Admin แสดง copy ของผู้ดูแลและไม่มี signup link; protected Web routes ส่ง `next` ไป Login | การค้นหา Username/email และการปฏิเสธ role ที่ผิดเป็น prototype-local เท่านั้น; ยังไม่เรียก auth API หรือยืนยัน session server |
| Learner workspace | `/learn` ส่ง unauthenticated user ไป Login; demo session เปิด dashboard, คอร์สของฉัน, ใบรับรอง และ Melearn AI ได้ | เป็น local fixtures; AI ระบุว่าใช้ JSON mock API. ไม่ได้ส่งคำถาม/สร้างข้อมูลหรือยืนยัน progress/certificate จาก server |
| Instructor workspace | `/teach` และ `/teach/courses/.../curriculum` เปิดด้วยบัญชีทดลองผู้สอน; dashboard แสดงคอร์ส/ผู้เรียน/งานตรวจและ curriculum แสดงบท/วิดีโอ/บทอ่าน/แบบฝึกหัด | ยังไม่ได้ submit grading, edit/save content, preview/publish หรือยืนยัน ownership จาก server |
| Admin | Admin app build แยก; `/admin` ส่ง unauthenticated user ไป `/login?next=%2Fadmin`; Login ระบุ Admin, ซ่อน signup link; ที่ 390×844 form อยู่ใน viewport ไม่มี horizontal overflow และไม่ submit | ไม่ได้ submit approve/issue code/save course หรือ Login form. Role check เป็น UX ของ local mock เท่านั้น; backend ต้อง enforce identity/role เอง |

Web/Learner spot-check ทำที่ประมาณ 860 × 768; Admin spot-check ทำที่ประมาณ 1253 × 711. Landing ใช้โลโก้จริง แถบประกาศแดง CTA หลักสีน้ำเงิน และพื้น/ข้อความตามทิศทาง UI_SPEC; Catalog และ Learner course list จัดการ์ดสองคอลัมน์; Course detail และ Instructor/Admin workspace จัดเนื้อหาใน shell ได้ใน viewport ที่เห็น. Responsive follow-up ทดสอบ Web Landing 390×844/320×844 และ Admin Login 390×844; Landing CTA และ benefits อยู่ใน viewport และ document ไม่กว้างเกิน viewport. พบแถบเลื่อนแนวนอนบน Admin รหัสแลกที่ 1253 × 711 และแถบเลื่อนภายในตารางใบรับรองว่างที่ 860 × 768 ซึ่งต้องตรวจเพิ่ม. นี่ไม่ใช่ responsive breakpoint matrix; ไม่ได้อ่าน computed color/contrast หรือทดสอบ focus/keyboard

## ช่องว่างที่ยืนยันจาก source เทียบ Final 1.6

| ระดับ | ข้อกำหนด | พฤติกรรมที่พบใน prototype | ผลต่อความพร้อม |
| --- | --- | --- | --- |
| สูง — วิดีโอ (Scope §2.3, V01–V03) | Instructor/Admin ใส่ YouTube Link; Player เล่น embed ได้; Upload แสดงว่ายังไม่พร้อมและไม่เก็บไฟล์ | `VideoEditor` รับ MP4/WebM เป็น base64 ใน browser และบอกให้ใช้ URL ไฟล์ตรง; learner player ส่ง URL เข้า HTML `<video>` จึงไม่รองรับ YouTube watch URL ตามที่ scope ต้องการ | authoring/player ยังใช้ flow ที่ตกลงกันไม่ได้; ต้องแยก YouTube embed/error และ Upload-not-ready ใน feature work |
| สูง — เกณฑ์ Quiz (Q03–Q04) | คำตอบครบและคะแนนดิบ **มากกว่า 70%** จึงผ่าน; 70% พอดีไม่ผ่าน | `src/store.tsx` ปัดคะแนนด้วย `Math.round` และเทียบ `>= quiz.passPercent || 60`; อีก branch สำหรับ essay ใช้ threshold เดิม | boundary 70%/ค่าตั้งต้นยังผิดจาก Final 1.6; server ต้องคำนวณคะแนนจริงเมื่อย้าย API |
| สูง — ผลจบ/ใบรับรอง (F04, F08) | เก็บ `completed_at` และ `completion_snapshot` ณ วันที่จบ; เพิ่มบทภายหลังไม่ทำให้ใบเดิมหาย | `awardCertificate` คำนวณความครบจากรายการคอร์สปัจจุบัน และ prototype type ไม่มี snapshot field ดังกล่าว | completion/certificate ไม่ใช่ immutable server record; ต้องตกลง Enrollment/Progress/Certificate contract และ migration behavior |
| สูง — AIPractice / AI history / quota (Scope §2.10–2.11, §4.4.9/4.4.11, AI11/AI16/AI24/AI27) | สร้างชุดฝึกตามคำสั่งในแชต เก็บชุด/คำตอบ/ผลในประวัติ และใช้ quota 20 successful prompts/บัญชี/วันไทย | `src/api/ai-practice-mock.ts` ใช้ชุด JSON เฉพาะเศษส่วน; AI history เป็น localStorage mock และยังไม่มี server quota/history | UI fixture ไม่ใช่ AI integration หรือข้อมูลใช้ข้ามอุปกรณ์; ต้องออกแบบ server API, quota, idempotency และ snapshot ใน R4a/R9 |
| กลาง-สูง — Login Username (Scope §1, A07/A15) | Login ด้วย Username หรืออีเมลได้; บัญชีที่ Admin สร้างอาจไม่มีอีเมล | **Prototype follow-up 8 ต.ค. ปิดช่องว่าง UI/local action:** field รับ Username/email แบบ text และ helper ค้นหา case-insensitive; ยังไม่มี auth API | UI prototype รองรับแล้ว; ต้องยืนยัน identifier/request/error contract กับ Backend ใน R4a ก่อนถือว่า flow พร้อม |
| กลาง-สูง — Course review concurrency (C07) | ถ้ารายละเอียดเปลี่ยนระหว่าง Admin ตรวจ ให้แจ้งตรวจฉบับล่าสุดและไม่อนุมัติฉบับเก่าเงียบ ๆ | `CourseReviewPage` เรียก `reviewCourse(course.id, 'approve')` โดยไม่ส่ง revision/updated token จากหน้าที่เปิดตรวจ | ต้องมี version/precondition ใน contract และ UI conflict state ไม่ใช่เพียงปุ่ม approve |
| กลาง — Admin login / route mismatch | Admin app ใช้ login entry ที่เหมาะกับ Admin; public signup สำหรับผู้เรียนอยู่ใน Web flow | **Prototype follow-up 8 ต.ค. ปิดช่องว่าง UI/route:** route ระบุ `audience="admin"`, ซ่อน learner signup, สำเร็จไป `next` หรือ `/admin`; non-admin demo ถูกปฏิเสธก่อนเปลี่ยน local user | UI prototype แก้แล้ว; ยังต้องใช้ Backend/session role enforcement จริง และไม่ถือ client check เป็น security |
| Blocker ต่อ production — Auth/Payment/Redeem/permissions | Identity, email, Google, Stripe Webhook, Enrollment, one-use Redeem และ role/ownership ตรวจโดย server | Auth/Redeem ใช้ prototype-local state; มี Payment API client เรียก `/me/payments/...` และตรวจ response แต่ preview นี้ไม่ได้เรียก backend จริงหรือยืนยัน Stripe Webhook; route guards เป็น client UX | มี API-client shape สำหรับ Payment แต่ยังไม่มีหลักฐานว่า server/fulfillment พร้อม; ห้ามใช้ปุ่มหรือ client state เป็นหลักฐานว่า Login, Payment หรือสิทธิ์สำเร็จ |

หลักฐาน source ที่ตรวจรวม `src/pages/AuthPages.tsx`, `src/components/chapter/VideoEditor.tsx`, `src/pages/learner/LessonPages.tsx`, `src/store.tsx`, `src/api/ai-practice-mock.ts`, `src/pages/admin/CourseReviewPage.tsx` และ Final 1.6 acceptance cases. Prefix `STAY-` เป็นข้อเท็จจริงใน prototype แต่ scope ไม่ได้กำหนดรูปแบบ prefix ใบรับรอง จึงไม่ถือ prefix เพียงอย่างเดียวเป็น scope violation; gap ที่ยืนยันได้คือ snapshot/completion persistence

จุดที่ควรยืนยันถ้อยคำ: Landing มีข้อความ “มีผู้สอนคอยช่วย ถามเรื่องที่ยังไม่เข้าใจ” ขณะที่ Inbox/ถามผู้สอนเป็นความสามารถที่ถอดออกใน R1. อาจสื่อเป็นคำอธิบายการสอนทั่วไปหรือทำให้คาดหวังการติดต่อผู้สอนโดยตรง; จึงบันทึกเป็น copy review item ไม่สรุปว่าเป็น business rule ใหม่

## สิ่งที่ยังไม่ได้ตรวจหรือพิสูจน์

- authenticated routes นอกเหนือจากหน้าตัวอย่างที่ระบุ, responsive breakpoints นอกเหนือจาก Landing 390/320 และ Admin Login 390, computed theme styles, keyboard/contrast/accessibility เต็มรูปแบบ
- การ submit/edit/save/approve/issue code, grading, payment/redeem fulfillment, และ end-to-end state-changing scenarios; authenticated spot-check นี้อ่านหน้าจอเท่านั้น
- YouTube URL parsing/embed success/error, การกด progress จริง, Resume หลัง sign-out/อุปกรณ์อื่น
- ขอบ 70% แบบ raw, pending essay/image grading, คะแนนดีที่สุด, certificate idempotency และ completion snapshot
- Stripe webhook fulfillment, payment race/retry, Redeem concurrency/revoke, authorization/ownership จาก server
- AI knowledge/context, cross-device history, quota ตาม Asia/Bangkok, request retry/idempotency และ AIPractice persistence
- C07 stale-review conflict behavior ในหลาย Admin sessions

Static route tests และการเปิดหน้าไม่แทน acceptance scenario เหล่านี้; รายการนี้ควรกลายเป็น UI/API integration cases เมื่อแต่ละ contract พร้อม

## แนวเริ่ม API Contract (R4a)

คุยกับ backend ตาม flow ไม่สร้าง schema จาก `LmsData`/fixture: เริ่มด้วย convention ร่วม (identity/session assumptions, ID/time/error format, permission/precondition และ idempotency เมื่อจำเป็น) แล้วเลือก flow แรก เช่น Public Course → Enrollment (free/Stripe/Redeem) → Learning/Progress/Quiz → Certificate. ทำตัวอย่าง success/error และระบุว่า server เป็นผู้ตัดสินสิทธิ์/คะแนน/fulfillment. AI practice/history/quota และ Course Review stale-version ทำเป็น contracts เฉพาะ flow; ยังไม่เขียน TanStack Query hooks จนสัญญาของ slice นั้นได้รับการยืนยัน
