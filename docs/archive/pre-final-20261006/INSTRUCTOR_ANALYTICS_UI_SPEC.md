**เอกสารประวัติ — เลิกใช้เป็นข้อกำหนดปัจจุบัน 6 ต.ค. 2026**

แผน analytics แบบเดิมไม่ใช่รายการส่งมอบรอบแรก ใช้ฉบับหลักสำหรับการตรวจคำตอบและขอบเขตข้อมูลผู้สอน ไม่แสดงส่วนแบ่ง

ข้อมูลหลักคือ [MELEARN_V1_SCOPE.md](../../MELEARN_V1_SCOPE.md) ห้ามใช้ข้อความด้านล่างกำหนด scope/permission/API ปัจจุบัน

---

# Instructor analytics — UX/UI และคำสั่ง implementation

สถานะ: ผู้ใช้อนุมัติให้เขียนสเปกและให้ GPT-6 Luna ทำ prototype ตามสเปก วันที่ 1 ต.ค. 2026 ใช้กับ elearning-ux-v2 เท่านั้น ไม่ใช่การอนุมัติ backend หรือกติกาจ่ายเงินให้ผู้สอน

## 1. เป้าหมายและขอบเขต

ให้ผู้สอนตอบได้ว่าใครลงเรียน ผลการเรียน/แบบฝึกหัดเป็นอย่างไร ก่อน–หลังเรียนพัฒนาตรงไหน และมีงานใดต้องทำ โดยเห็นเฉพาะคอร์สที่ตนรับผิดชอบ

ต่อยอด `/teach/analytics` และทางเข้าจากคอร์สเดิม เก็บหน้าวิเคราะห์แอดมินและหน้ารายละเอียดผู้เรียน/คอร์สเดิม ไม่ redesign Shell, หน้าบัญชี, editor หรือ landing

มี 5 มุมในหน้าเดียว: **ภาพรวม / ความสนใจคอร์ส / แบบฝึกหัด / ก่อน–หลังเรียน / ผู้เรียน** ใช้ชื่อไทยในแท็บและ URL สำหรับคอร์ส/แท็บ เปิดตรง refresh/back ได้

ผลคะแนน/ความคืบหน้าเป็นข้อมูลสะสมของคอร์ส ระบุว่า “ข้อมูลสะสมในต้นแบบ” ส่วนช่วงวันที่และกราฟทราฟฟิกอยู่ในแท็บความสนใจคอร์สและระบุข้อมูลจำลองแยกชัด ไม่ตัด Pre-test ที่อยู่นอกช่วงทราฟฟิกจนกลายเป็นจับคู่ไม่ครบโดยปริยาย

## 2. การมองเห็นและ permission

- Owner ID มาจากผู้ใช้ที่ sign-in ไม่รับ instructor ID จาก URL เพื่อขยายสิทธิ์
- Scope course ก่อน aggregate, lookup learner/quiz/comparison, chart และ export เสมอ instructorId ต้องตรงกับ currentUser.id
- URL course ที่ไม่มี/ไม่ใช่ของผู้สอน แสดงไม่พบ/ไม่มีสิทธิ์ ไม่ fallback ไปแสดงข้อมูลหรือชื่อคอร์สของคนอื่น
- ชุดเปรียบเทียบต้องอยู่ใน course เดียวกัน และ quiz ก่อน/หลังต้องอยู่ใน course นั้นจริง ห้ามค้น comparison ด้วย ID โดยไม่เช็ก course
- ผู้เรียนชื่อเดียวกันในหลายคอร์สต้องนับ unique user ให้ถูก ไม่เอาคะแนนหรือกิจกรรมจากคอร์สของผู้สอนคนอื่นมารวม
- `/admin/analytics` คงบทบาทและ behavior เดิม ผู้สอนไม่เข้ารายงานการเงิน/ภาพรวมธุรกิจของแอดมินผ่าน direct URL
- CSV รายบุคคล/ข้อสอบมีเฉพาะขอบเขตของผู้สอนและใช้ตัวกรองเดียวกับหน้าที่ส่งออก ห้าม export password หรือข้อมูลอื่นใน User object ทั้งก้อน
- Prototype เป็น client checks; production ต้องตรวจ principal, organization/course ownership และ export permissions ฝั่ง API ใหม่ทุกครั้ง ไม่ถือการซ่อนเมนูเป็น security

## 3. โครง UX/UI

### Header และตัวกรอง

ชื่อ “ภาพรวมคอร์สของฉัน” subtitle ว่าเฉพาะคอร์สที่รับผิดชอบ ตัวเลือกทุกคอร์ส/คอร์สเดียวอยู่บนสุด ไม่มีตัวเลือกผู้สอนทั้งหมดสำหรับ instructor

แท็บรองเลือกแบบฝึกหัด/ชุดเปรียบเทียบภายในขอบเขตเท่านั้น ไม่มี dropdown ที่ยาวจนชนหัวข้อ ใช้ Ant Design Select/Segmented/Table/Button/Drawer ตามกติกากลาง

### ภาพรวม

KPI ประมาณ 4 ตัว: ผู้เรียนไม่ซ้ำ, การลงทะเบียน, ผู้เรียนเรียนจบ (ระบุหน่วยคนต่อคอร์สถ้าเป็นจำนวนการจบคอร์ส), คำตอบรอตรวจ โดยไม่เรียก submitted attempts ว่า active learning ถ้าไม่มี engagement timestamp

แสดงรายการต้องจัดการและตารางรายคอร์ส: ผู้เรียน, การลงทะเบียน, completion, แบบฝึกหัดที่ส่งและรอตรวจ ปุ่มเข้าตรวจ/ดูผลต้องไปคอร์ส/attempt ที่อยู่ใน scope และเก็บ returnTo กลับหน้าเดิม

Unread inbox ใช้ได้เมื่อมี selector/action เดิมพร้อม หากไม่มีข้อมูล/ไม่มี route ใน isolated baseline ให้ไม่แสดงจำนวนที่เดาเอง ห้ามสร้าง ticket/team workflow ใหม่ในงานนี้

### ความสนใจคอร์ส

Reuse business report date helpers/chart/fixtures ที่เพิ่มแล้ว แต่ filter courses ด้วย owner ก่อนสร้าง demo และคำนวณทุก summary/chart/funnel/CSV จาก scoped courses เท่านั้น

มีกราฟ visitors / sessions / enrollments / purchases และ heatmap เวลาเรียน/ซื้อ จำนวน purchases เป็นรายการ ไม่ใช่รายได้ผู้สอน ไม่แสดงเงินส่วนแบ่ง กำไร หรือยอดโอน เพราะยังไม่มี policy ที่ยืนยัน

ใช้ความยาว 1/7/30/90 วัน/วันที่เอง มี coverage/no-data, date validation และ timezone เหมือน business spec ไม่แสดงเลขของแอดมินแล้วซ่อนบางคอลัมน์ภายหลัง

### แบบฝึกหัด

ตาราง: ชื่อ/ระยะก่อนเรียน-ฝึกระหว่างเรียน-หลังเรียน, ผู้ส่งไม่ซ้ำ, ผลคะแนนที่ตรวจแล้ว, คะแนนเฉลี่ย/มัธยฐาน, pass rate (บอก denominator), งานรอตรวจ และปุ่มดูผลรายข้อ/คำตอบ

Attempt policy สำหรับตารางสรุป: first submitted per learner/quiz เช่นเดียวกับ paired stage เพื่อลดการนับผู้ทำซ้ำเป็นหลายคน; label ระบุชัด ประวัติทุก attempt ยังคงเข้าดูได้ผ่านหน้ารายบุคคลเดิม/Drawer

คะแนนรอตรวจ/ไม่มีคะแนนไม่เข้าค่าเฉลี่ยและ pass-rate denominator ไม่เติม 0; มีคะแนนจริง 0 ต้องยังนับ valid score ไม่ใช้ truthiness; ไม่เปลี่ยน gradeAttempt หรือเกณฑ์ผ่านของ quiz

ผลรายข้อ:
- Choice: จำนวนคำตอบที่มี index ถูกต้อง, ตอบถูก/ผิด/ข้าม และอัตราตอบถูก เฉพาะ first submitted ต่อ learner/quiz ห้ามนับ draft หรือทั้งทุก attempt ปนกัน
- Essay/image: จำนวนส่งและรอตรวจ พร้อมทางเข้าดูคำตอบ ไม่สร้าง “เปอร์เซ็นต์ตอบถูก” หรือแจก essayScore ของ attempt ไปเป็นคะแนนรายข้อ เพราะยังไม่มี question-level rubric grades
- ไม่เทียบว่าข้อที่ต่างกันก่อน/หลังเป็นข้อเดียวกันอัตโนมัติ จับคู่ระดับ quiz ตาม ComparisonSet ก่อน หากต้องใช้ item mapping เป็น requirement อนาคต

### ก่อน–หลังเรียน

เลือกคอร์สเดียวก่อน แล้วเลือก ComparisonSet ของคอร์สนั้น แสดงชื่อแบบฝึกหัดก่อน/หลังอย่างชัดเจน ถ้าไม่กำหนดคู่ มี empty state อธิบาย ไม่เดาคู่จากชื่อ

สรุป 4 ค่า: คะแนนเฉลี่ยก่อน, คะแนนเฉลี่ยหลัง, Paired Gain หน่วย **จุดเปอร์เซ็นต์**, Coverage matched n / enrolled unique learners พร้อมจำนวนรอตรวจและกลุ่มไม่ครบ

กราฟ paired points เชื่อม pre→post ของคนเดียวกัน เฉพาะ matched ตัวเลขทั้งสองฝั่งมาจากกลุ่มเดียวกับ KPI ไม่ใช้ค่าเฉลี่ย pre จากทุกคนเทียบ post คนละกลุ่ม กราฟมีชื่อ/หน่วย/keyboard labels และตารางใช้เป็นช่องทางอ่านตัวเลขครบ ถ้ากลุ่มใหญ่ให้จำกัดกราฟพร้อมแจ้งจำนวน แต่ตาราง/CSV ต้องครบตาม scope

ตาราง: ผู้เรียน/avatar, คะแนนก่อน/หลัง, ส่วนต่างจุดเปอร์เซ็นต์, สถานะ matched/pending/pre-only/post-only/neither และปุ่มดูคำตอบ/ประวัติ/ตรวจงาน

กติกาคำนวณ:
1. เลือก first submitted ต่อ user/quiz/stage ตาม submittedAt ขึ้นก่อน; tie-break ID ให้ deterministic ไม่ใช้ attempt หลังที่ได้คะแนนดีกว่าแทน
2. Pending ไม่ใช่ 0 และไม่เข้า matched แม้มี percent ของ choice อยู่แล้ว
3. Paired Gain = average(postPercent − prePercent) เฉพาะ valid matched; round เมื่อแสดงผล โดยผลต้องสอดคล้อง canonical helper เดิม
4. ไม่มี matched: แสดง “— / ยังไม่มีผลที่จับคู่ครบ” ไม่แสดง improvement 0 และไม่สร้างกราฟปลอม
5. บอกชัดว่าเป็นการเปรียบเทียบเชิงพรรณนา ไม่ยืนยัน causal effect ของการเรียน ไม่เปลี่ยนสูตรเป็น relative gain หรือตัดงาน pending ทิ้งจากตาราง

### ผู้เรียน

เฉพาะ enrollment ใน scoped course(s), avatar neutral default/รูปจริงเมื่อมี, จำนวนคอร์สใน scope, ความคืบหน้าและผลล่าสุดที่มีจริง ปุ่ม drill-down ต้องเจาะคอร์สที่ผู้สอนรับผิดชอบ ไม่เปิดประวัติทั้งระบบของคนนี้

ใช้ Drawer/ลิงก์ที่มี route จริงใน checkout ห้าม link ไปหน้าที่ไม่มีเพราะ feature เดิมยังเป็นงานค้าง ถ้า baseline ไม่มี learner analytics ให้ Drawer read-only แสดงคะแนน/feedback/history ภายใน scope

## 4. Visual guidance สำหรับ Luna

- รักษา white + light sky blue, primary #0074e8, Anuphan และ token var(--ink/--ink-secondary/--line) ไม่เพิ่ม purple/orange/yellow เพื่อแยกเส้นกราฟ
- KPI เป็นแถวตัวเลข กระชับ ไม่ใช้หลายสิบการ์ดพร้อมกัน กราฟหลักพื้นที่กว้างและอ่านหน่วยได้
- Paired chart ใช้เส้น neutral เชื่อมและจุดฟ้าสองระดับ/marker ต่างกัน มี legend pre/post; ห้ามใช้แค่สีสื่อความหมายหรือกราฟที่จุดใหญ่ทับชื่อ
- Avatar ใช้ default บุคคลพื้น neutral และ src ถ้ามี/โหลดได้ ไม่สร้างวงกลมสีรุ้ง/ตัวอักษรสุ่ม หาก reuse UserAvatar เดิมใน main ให้ใช้ผ่าน adapter โดยไม่ดึง types ทั้ง migration เข้าสู่ isolated branch
- มือถือ 390px: toolbar wrap, tabs เลื่อนหรือ wrap ภายใน, KPI 2 คอลัมน์, paired chart readable, table เลื่อนเฉพาะ container; document ไม่ล้นแนวนอน
- ใช้ component library เดิม ไม่เพิ่ม chart library/dependency ใช้ responsive SVG พร้อมตาราง fallback ได้
- CSS namespace instructor-analytics- หรือ ia- ไม่ override global theme และไม่เปลี่ยนหน้าของแอดมิน/ผู้เรียนอื่น

## 5. Code plan และ single source of truth

งานใหม่อยู่ใน pure selectors/helper และ page components แยกหน้าที่ ไม่เพิ่ม global store หรือแก้ผลคะแนนจากหน้า analytics

เลือก structural interfaces ที่เข้ากันได้ทั้ง baseline JS และ main TS; new module ไม่ import global types ของ migration ทั้งหมดเพียงเพื่ออ่าน fields ไม่ใช้ any, @ts-ignore หรือ as unknown as เพื่อให้ผ่าน

สูตร first attempt / final percentage / paired rows ควร extract เป็น canonical pure helper (`src/api/assessmentComparison.ts` หรือชื่อที่สื่อหน้าที่) และให้หน้าใหม่รวมทั้ง getPrePostComparison เดิมเรียก helper นี้ผ่าน adapter ไม่ให้มีคนละสูตรใน 2 หน้า

Local integration ใน main อนุญาตเฉพาะ App route binding, adapter จาก store, canonical helper binding ใน analytics.ts และ label/unit/scoped comparison selection ของ PrePostComparisonPanel ถ้าจำเป็น ห้ามเปลี่ยน interface ของ getPrePostComparison เดิมจนหน้า admin/course analytics ใช้ไม่ได้

ปัญหาจาก source ที่ต้องปิดในขอบเขตนี้: getPrePostComparison เดิมเลือก comparisonSetId โดยไม่มี course check; คะแนน Paired Gain label ยังแสดง `%` แทนจุดเปอร์เซ็นต์ และ filter คอร์สบนหน้าสรุปเก่าไม่กรองทุก KPI พร้อมกัน

## 6. สิ่งที่ห้ามทำ

- ห้าม deploy, install dependency ใน reference, reset store/browser demo, เปลี่ยนราคา/คะแนน/เกณฑ์ผ่าน หรือ implement payment/refund/instructor payout
- ห้ามแก้ schema/storage/actions ของงานอื่นโดยไม่จำเป็น ห้ามย้าย JS→TS ทั้งระบบในงานนี้
- ห้ามบังคับว่าผู้สอนเห็นผู้เรียน/ยอดของทุกคนเพื่อให้ demo มีข้อมูล ไม่เติม mock ลง user state ของผู้ใช้
- ห้ามสร้าง route/CSV ที่รับ instructorId จาก query แล้วอ่านคนอื่นได้ ไม่ส่ง password/answer content ทั้งระบบเข้ากราฟหรือ telemetry
- ห้าม git add ., แตะ index/main HEAD หรือ commit/push งาน migration ที่ค้างของคนอื่น Luna ส่งรายการไฟล์และผลตรวจให้ parent; parent เป็นผู้ checkpoint/push

## 7. Fixtures และ empty states

ข้อมูลหลักจาก LMS browser state ปัจจุบัน ไม่ replace mock enrollments/attempts ของผู้ใช้

Isolated baseline อาจไม่มี ComparisonSet/fixtures analytics จากงานค้าง ให้ใช้ empty state พร้อม **ปุ่มดูตัวอย่าง read-only ที่ระบุข้อมูลจำลอง** ใช้ fixtures เฉพาะ scoped course และไม่ inject เข้า store; เมื่อ native comparison มีแล้วต้องใช้ native โดยปริยาย ห้ามนำ demo score มารวมกับผล native

เตรียมเคส matched gain บวก/ลบ/ศูนย์, pending essay, pre-only, post-only, neither, actual score 0, ไม่มี matched และ course ของคนอื่นใน tests อย่างน้อยตามความเสี่ยงนี้

## 8. Acceptance / ตรวจส่งมอบ

1. Instructor เห็นเฉพาะตนทุก tab/Select/summary/chart/table/Drawer/CSV; foreign course/compare set direct URL ไม่มีข้อมูลหลุด
2. ผู้เรียนเข้า `/teach/analytics` ไม่ได้ admin routes เดิมยังเปิดได้
3. คะแนน/ค่าเฉลี่ย/paired chart/table/CSV ตรงกันกับ helper; pending กับ 0 แยกได้ first attempt ไม่เปลี่ยนเมื่อทำซ้ำ
4. Filter course เปลี่ยนทุกองค์ประกอบที่ใช้ scope นั้น พร้อม refresh/back; business dates ไม่ไปเปลี่ยน paired attempt policy
5. มี drill-down ดู choice/essay/image/feedback/history และตรวจงานจาก own attempts; ไม่มี dead links ใน isolated checkout
6. Empty/no-matched/no-coverage/unknown filter เป็นข้อความจริง ไม่ fabricate data; compare ไม่มี causal claim
7. Strict typecheck และ build ผ่าน ทั้ง current TS integration และ isolated feature checkout (ใช้ temporary strict config ได้ แต่ห้ามลด strict ของ main)
8. Browser desktop/mobile, course/tab filter, before/after chart, pending→grade→updated analytics, direct denied route และ CSV scope เท่าที่ baseline รองรับ; บอกผลที่ไม่ได้ทดสอบตามจริง

ต้องรายงาน source paths และตรวจ content ของ staged commit แยกจากงานค้างก่อน push ตามกติกา checkpoint กลาง

อ้างอิงร่วม: [Business UI](BUSINESS_ANALYTICS_UI_SPEC.md), [Business data/API draft](BUSINESS_ANALYTICS_DATA_SPEC.md), [Admin gap audit](ADMIN_MANAGEMENT_GAP_AUDIT_TH.md) และ UI_SPEC/CODE_SPEC กลางใน main workspace
