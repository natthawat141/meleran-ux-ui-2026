# R4a — Contract Draft ละเอียด Flow A (Auth/Account) และ Flow B (Catalog/Enrollment)

วันที่ 8 ตุลาคม 2026 · สถานะ **Draft — ยังไม่มี Backend owner ยืนยัน** · ต่อจาก [R4a API Contract Draft](API_CONTRACT_R4A_DRAFT_TH.md) และใช้ขอบเขตจาก [MELEARN_V1_SCOPE.md](MELEARN_V1_SCOPE.md) บท 1.2, 2.1, 5.1, 5.3, 5.8, 6.2, 6.3 และ 9.1/9.3

เอกสารนี้ลงรายละเอียด request/response/error ของสอง flow แรกตามลำดับที่เสนอไว้ เพื่อให้ Backend owner ตอบทีละข้อและให้ Frontend ทำ mock adapter ที่รูปร่างตรงกัน **ไม่ใช่ contract ที่ frozen** และไม่ใช่การเลือก Backend stack

## 0. ข้อตกลงการอ่านเอกสาร

- **[ยืนยัน]** — มาจาก Final 1.6 โดยตรง
- **[ข้อเสนอ]** — ค่าเริ่มต้นที่ Frontend เสนอ Backend เปลี่ยนได้ แต่ต้องแจ้งเพื่อแก้ mock/test พร้อมกัน
- **[รอ Backend]** — ยังไม่มีข้อมูลพอ ห้ามเดา
- Path ในหัวข้อ Flow อ้างตาม scope บท 6 เป็นชื่ออ้างอิง Backend ปรับรูปแบบ URL ได้โดยรักษาสิทธิ์และพฤติกรรม
- DTO ด้านล่างเป็น TypeScript sketch เพื่อคุย **ไม่เพิ่มลง `packages/contracts`** จนกว่า flow จะผ่าน gate ใน [R4a Draft](API_CONTRACT_R4A_DRAFT_TH.md) และ [รายงาน R4b-prep](R4B_PREP_REPORT_TH.md); ห้ามสร้าง Query hooks จากเอกสารนี้
- ฟิลด์ใช้ `snake_case` ตามตัวอย่างใน scope (`course_id`, `email_verified`)
- รหัสกรณีตรวจรับ เช่น A01, C09, E01 หมายถึงตารางใน scope บท 9; รหัส operation ของเอกสารนี้ขึ้นต้นด้วย `FA` (Flow A) และ `FB` (Flow B) เพื่อไม่ให้ซ้ำกัน

## 1. Decision register ที่ต้องปิดก่อน freeze (ใช้กับทุก flow)

| ID | หัวข้อ | ข้อเสนอเริ่มต้น | ทางเลือก | ผลต่อ Frontend |
| --- | --- | --- | --- | --- |
| D1 | Session transport | [ข้อเสนอ] Cookie session แบบ `HttpOnly; Secure; SameSite=Lax` และ mutation ส่ง CSRF header | Bearer token อายุสั้น + refresh | ใช้ `credentials`/headers ที่แอป inject เข้า `createHttpClient` ต่อคำขอ ห้ามเก็บ password/token ใน localStorage หรือ query cache |
| D2 | Identity ข้าม Web/Admin | [ข้อเสนอ] บัญชีและกติกา server ชุดเดียว; Login ส่ง `audience` (`web` หรือ `admin`) และ audience `admin` ปฏิเสธบัญชีที่ไม่มีบทบาท Admin ตรงกับพฤติกรรมที่ prototype ทดสอบไว้ | Session แยกตามแอป หรือใช้ cookie ร่วม | ต้องรู้ว่า Admin เปิดด้วย session ของ Web ได้หรือไม่ และ CORS/cookie domain ของสอง origin |
| D3 | Base path/version | [รอ Backend] `/api/v1` เป็นตัวอย่าง | — | ใส่ใน `baseUrl` ของแอป ไม่ฝังใน client กลาง |
| D4 | ID | [ข้อเสนอ] string ทึบ (opaque) Frontend ไม่แยกส่วนประกอบ | — | ใช้เป็นคีย์ query/route ได้ |
| D5 | Success shape | [ข้อเสนอ] คืน resource ตรง ๆ ไม่ห่อ `data`; list คืน `{ items, next_cursor }` | ห่อ `data` | Decoder ต่อ endpoint ง่ายและไม่ซ้ำชั้น |
| D6 | Error shape | [ข้อเสนอ] `{ error: { code, message, request_id, details? } }`; validation ใส่ `details.fields[]` | RFC 9457 problem+json | แมป `code` → ข้อความไทย/พฤติกรรม UI ไม่พึ่ง HTTP status อย่างเดียว |
| D7 | Pagination | [ข้อเสนอ] cursor: `limit` (ค่าเริ่มต้น 20, สูงสุด 50) และ `cursor` | offset | Query key ต้องรวม filter + cursor |
| D8 | Enum/เวลา | [ข้อเสนอ] enum เป็นสตริงตัวพิมพ์เล็ก `snake_case`; เวลาเป็น ISO-8601 UTC | — | UI แปลงเวลาเอง |
| D9 | Idempotency | [ข้อเสนอ] คำสั่งที่ซ้ำได้ตามธรรมชาติ (เช่น Enroll) ใช้คีย์ (user, course); คำสั่งที่สร้างผลข้างเคียงรับ `Idempotency-Key` ถ้า Backend ต้องการ | — | ปุ่มกดซ้ำ/รีเฟรชไม่สร้างผลซ้ำ |
| D10 | ตอบแบบไม่เปิดเผยการมีอยู่ของบัญชี | [ข้อเสนอ] Forgot password และ Resend ตอบ `202` เหมือนเดิมไม่ว่าบัญชีมีอยู่หรือไม่ | แยกข้อความตามกรณี | หน้า UI ใช้ข้อความกลาง เช่น “ถ้าบัญชีนี้พร้อมรับอีเมล เราได้ส่งลิงก์แล้ว” พร้อมคำอธิบายเงื่อนไขอยู่บนหน้า |
| D11 | Rate limit | [ข้อเสนอ] `429` พร้อม `Retry-After` และ `code=rate_limited` | — | แสดงเวลารอ ไม่ retry อัตโนมัติ |
| D12 | ราคา | [ข้อเสนอ] `{ amount_minor: integer, currency: string }` ไม่ใช้ทศนิยม | จำนวนเต็มบาท | ต้องตกลงสกุลเงินกับ Stripe; prototype ใช้ `price: number` เท่านั้น |
| D13 | Capabilities ฝั่ง UX | [ข้อเสนอ] `GET /me` คืน `roles[]` และ `learning_eligible` เท่านั้น สิทธิ์ที่ผูกกับเจ้าของ/สถานะอ่านจากผลของแต่ละ resource | รายการ permission ทั้งหมด | Guard ใน UI เป็น UX เท่านั้น Backend ตรวจซ้ำทุก endpoint |

## 2. รหัส error กลาง (ข้อเสนอ)

HTTP status ที่ระบุเป็นข้อเสนอ ให้ Backend ยืนยัน

| `error.code` | HTTP | เมื่อใด | พฤติกรรม UI ที่คาด |
| --- | --- | --- | --- |
| `unauthenticated` | 401 | ไม่มี/หมดอายุ session | ไปหน้า Login พร้อมจำ return path ฝั่ง UI เท่านั้น |
| `forbidden` | 403 | มี session แต่สิทธิ์/บทบาท/ความเป็นเจ้าของไม่พอ | หน้าไม่มีสิทธิ์ ไม่เปิดเผยข้อมูลเพิ่ม |
| `not_found` | 404 | ไม่พบ หรือซ่อนเพราะไม่มีสิทธิ์รู้ว่ามี (เช่น คอร์ส Draft ต่อสาธารณะ) | หน้าไม่พบ |
| `validation_failed` | 422 | ข้อมูลไม่ผ่าน; `details.fields[]` ระบุ field/รหัส | แสดงที่ field |
| `invalid_state` | 409 | สถานะปัจจุบันไม่รองรับคำสั่ง (เช่น คอร์สไม่ฟรี) | ข้อความตามกรณี |
| `rate_limited` | 429 | เกินขีดจำกัด | แสดงเวลารอ |
| `dependency_unavailable` | 503 | บริการภายนอกขัดข้อง (อีเมล, Google) | แจ้งลองใหม่ ไม่แสดงว่าสำเร็จ |
| `credentials_invalid` | 401 | Username/อีเมลหรือรหัสผ่านไม่ถูกต้อง (ไม่แยกว่าบัญชีมีอยู่หรือไม่) | ข้อความกลาง |
| `audience_not_allowed` | 403 | Login สำเร็จด้วยรหัสผ่านแต่ไม่มีสิทธิ์เข้า audience นี้ [รอ Backend: อาจรวมกับ `credentials_invalid` เพื่อลดการรั่วไหล] | แจ้งไม่มีสิทธิ์เข้า Admin |
| `email_not_verified` | 403 | บัญชีสมัครอีเมลเองที่ `email_verified=false` พยายาม Enroll/ซื้อ/Redeem | ชวนยืนยันอีเมลและให้ Resend |
| `email_taken` / `username_taken` | 409 | ซ้ำ [รอ Backend: ผลต่อการระบุว่าอีเมลมีอยู่แล้ว] | แสดงที่ field |
| `verification_link_invalid` / `_expired` | 400 / 410 | ลิงก์ยืนยันไม่ถูกต้อง/หมดอายุ | หมดอายุให้ปุ่มขอลิงก์ใหม่ |
| `reset_link_invalid` / `_expired` / `_used` | 400 / 410 / 409 | ลิงก์ Reset ใช้ไม่ได้ | ให้ขอใหม่ |
| `google_link_required` | 409 | อีเมล Google ตรงบัญชีเดิมที่ยังไม่ได้เชื่อม | ให้ Login บัญชีเดิมก่อนแล้ว Link |
| `google_identity_linked_elsewhere` | 409 | ตัวตน Google ผูกกับ User อื่น | ไม่รวมบัญชี แจ้งผู้ใช้ |
| `enrollment_not_allowed` | 403 | Admin Enroll, หรือเจ้าของคอร์สพยายาม Enroll คอร์สตนเอง; `details.reason` เช่น `admin`, `own_course` | ข้อความตามกรณี |
| `course_not_free` | 409 | Enroll ฟรีกับคอร์สเสียเงิน | ชวนซื้อ/Redeem |

## 3. Flow A — Auth และ Account

### 3.1 DTO ร่วม

```ts
type Role = 'learner' | 'instructor' | 'admin';
type AccountOrigin = 'self_email' | 'google' | 'admin_created';
type AuthMethod = 'password' | 'google';

interface CurrentUser {
  id: string;
  display_name: string;
  username: string | null;       // บัญชี Admin สร้างมี Username เสมอ
  email: string | null;          // บัญชี Admin สร้างอาจไม่มีอีเมล
  email_verified: boolean;
  avatar_url: string | null;
  roles: Role[];                 // ผู้สอนมี 'learner' และ 'instructor' [ข้อเสนอ]
  origin: AccountOrigin;
  auth_methods: AuthMethod[];    // วิธี Login ที่เชื่อมไว้
  learning_eligible: boolean;    // ผ่านเงื่อนไขบัญชีสำหรับ Enroll/ซื้อ/Redeem (scope 2.1) — ใช้แสดง UX เท่านั้น
}
```

- **[ยืนยัน]** ไม่ส่งรหัสผ่านหรือ hash กลับ และ Role/User ID ที่ Client ส่งมาไม่ใช้เพิ่มสิทธิ์
- `learning_eligible` เป็นค่าที่ Server คำนวณ: จริงเมื่อ `origin` เป็น `google` หรือ `admin_created` หรือ `email_verified=true` ส่วนการบังคับใช้จริงอยู่ที่ endpoint ที่เกี่ยวข้อง
- ชื่อ field ที่แก้ได้ใน `PATCH /me` และรูปแบบรูปโปรไฟล์ **[รอ Backend]** (prototype มี `name`, `bio`, `avatar`; การอัปโหลดรูปเป็นขอบเขตแยก)

### 3.2 รายการ operation

| Op | Method/Path | ผู้เรียก | Success | Error หลัก | Scope |
| --- | --- | --- | --- | --- | --- |
| FA1 | `POST /auth/register` | Guest | `201` | `validation_failed`, `email_taken`, `rate_limited` | A01, A17 |
| FA2 | `POST /auth/verify-email` | ผู้มีลิงก์ | `200` | `verification_link_invalid`, `verification_link_expired` | A17–A19 |
| FA3 | `POST /auth/resend-verification-email` | บัญชีที่ยังไม่ยืนยัน | `202` | `rate_limited`, `unauthenticated` | A20 |
| FA4 | `POST /auth/login` | Guest | `200` | `credentials_invalid`, `audience_not_allowed`, `rate_limited` | A07, A15 |
| FA5 | Google sign-in/callback | Guest | redirect | `google_link_required`, `dependency_unavailable` | A02, A16 |
| FA6 | `POST /me/auth-identities/google` และ callback | ผู้ Login แล้ว | redirect/`200` | `google_identity_linked_elsewhere` | A09, A10, A16 |
| FA7 | `POST /auth/password-reset/request` | Guest | `202` | `rate_limited`, `dependency_unavailable` | A11, A13, A14 |
| FA8 | `POST /auth/password-reset/confirm` | ผู้มีลิงก์ | `200` | `reset_link_*`, `validation_failed` | A11, A12 |
| FA9 | `POST /auth/logout` | ผู้ Login แล้ว | `204` | — | — |
| FA10 | `GET /me` | ผู้ Login แล้ว | `200` | `unauthenticated` | — |
| FA11 | `PATCH /me` | ผู้ Login แล้ว | `200` | `validation_failed` | A03 |
| FA12 | `POST /admin/users` | Admin | `201` | `forbidden`, `username_taken`, `validation_failed` | A07, A08 |
| FA13 | `POST /admin/users/{id}/instructor` | Admin | `200` | `forbidden`, `not_found` | A04 |

### 3.3 รายละเอียดที่ต้องตกลง

**FA1 สมัครด้วยอีเมล** — Request `{ display_name, email, password }` คืน `{ user: CurrentUser, verification_email: 'queued' | 'failed' }` โดย `user.roles=['learner']`, `email_verified=false`. **[ยืนยัน]** ได้บัญชี Learner เดิมที่ยังไม่ยืนยัน และส่งลิงก์ผ่าน Resend; ส่งอีเมลไม่สำเร็จห้ามถือว่ายืนยันแล้ว (A14). **[รอ Backend]** สมัครแล้วสร้าง session ทันทีหรือไม่ (scope ระบุว่า Login ได้ แต่ยังทำธุรกรรมไม่ได้), นโยบายรหัสผ่าน, และ `email_taken` จะเปิดเผยว่าอีเมลมีอยู่หรือไม่

**FA2 ยืนยันอีเมล** — Request `{ token }` คืน `{ status: 'verified' | 'already_verified', user?: CurrentUser }`. **[ยืนยัน]** ลิงก์อายุ 24 ชั่วโมง ใช้ครั้งเดียว ตรวจเวลาที่ server; เปิดลิงก์ที่ใช้แล้วต้องไม่ยืนยันซ้ำและไม่สร้าง User ใหม่; เปิดพร้อมกันหลายครั้งต้องบันทึก `used_at` และ `email_verified` สอดคล้องกัน (A19) **[รอ Backend]** ลิงก์ใช้แล้วคืน `200 already_verified` หรือ `409`; ผู้เปิดไม่จำเป็นต้อง Login อยู่

**FA3 ส่งลิงก์ยืนยันใหม่** — คืน `202 { status: 'accepted', retry_after_seconds }` ตาม D10/D11 **[ยืนยัน]** จำกัดความถี่ที่ server **[รอ Backend]** ต้องมี session หรือรับ `{ email }` เมื่อผู้ใช้ออกจากระบบแล้ว

**FA4 Login** — Request `{ identifier, password, audience }` โดย `identifier` คือ Username หรืออีเมล **[ยืนยัน]** ใช้ได้ทั้งสองแบบ Response `{ user: CurrentUser }` พร้อม session ตาม D1 **[รอ Backend]** lockout/rate limit, และ `audience_not_allowed` ต่างจาก `credentials_invalid` หรือไม่

**FA5 Google sign-in** — เป็น browser redirect ไม่ใช่ JSON: `start` → Google → callback ที่ server → redirect กลับแอปพร้อมผลเป็นรหัสสั้นเท่านั้น เช่น `?auth_result=signed_in|google_link_required|failed` โดยไม่ใส่ token หรือข้อมูลบัญชีบน URL. **[ยืนยัน]** อีเมล Google ตรงบัญชีเดิมที่ยังไม่เชื่อมต้องให้ Login บัญชีเดิมก่อน Link ห้าม auto-merge หรือสร้าง User ซ้ำ **[รอ Backend]** allowlist ของ return URL, และ Admin audience ใช้ Google ได้หรือไม่

**FA6 เชื่อม Google** — ผู้ใช้ต้อง Login ก่อน; `POST` คืน `{ redirect_url }` แล้ว callback redirect กลับพร้อม `?link_result=linked|google_identity_linked_elsewhere|failed` **[ยืนยัน]** ตัวตน Google หนึ่งรายการผูกได้กับ User เดียว ผลเรียนเดิมไม่เปลี่ยน

**FA7–FA8 ลืม/ตั้งรหัสผ่านใหม่** — `request` รับ `{ identifier }` ตอบ `202` ตาม D10; ส่งลิงก์เฉพาะอีเมลที่ยืนยันแล้ว; บัญชี Admin สร้างที่ไม่มีอีเมลยืนยันไม่ได้รับลิงก์ (กรณี A13) `confirm` รับ `{ token, new_password }` คืน `{ status: 'password_changed' }` **[ยืนยัน]** ลิงก์ใช้ครั้งเดียว มีอายุ รหัสเดิมใช้ Login ไม่ได้หลังเปลี่ยน **[รอ Backend]** อายุลิงก์ Reset, ยกเลิก session อื่นหลังเปลี่ยนรหัสหรือไม่

**FA10–FA11 โปรไฟล์** — `GET /me` คืน `CurrentUser`; `401` ถือเป็น Guest ไม่ใช่ error ทั่วจอ. `PATCH /me` รับเฉพาะ field ที่อนุญาต **[ยืนยัน]** ไม่เปลี่ยน Role หรือ `email_verified` (A03); การเพิ่ม/เปลี่ยนอีเมลต้องยืนยันก่อนใช้กู้รหัส **[รอ Backend]** flow เพิ่มอีเมลของบัญชีที่ Admin สร้าง

**FA12 Admin สร้างบัญชี** — Request `{ username, password, display_name, email? }` Response `201 { user: CurrentUser, created_by, created_at }` โดย `origin='admin_created'`, `roles=['learner']`, `learning_eligible=true` **[ยืนยัน]** Username ไม่ซ้ำ ไม่ต้องมีอีเมล บันทึก Admin ผู้สร้างและเวลา เก็บรหัสเป็น hash และไม่คืนรหัสกลับ **[รอ Backend]** นโยบายรหัสเริ่มต้น และบังคับเปลี่ยนรหัสครั้งแรกหรือไม่ (scope ไม่ได้ระบุ ห้ามเพิ่มเอง)

**FA13 เพิ่ม Instructor** — ไม่มี body; `200 { user: CurrentUser, added_by, added_at }` และเรียกซ้ำสำหรับผู้ที่เป็น Instructor อยู่แล้วต้องไม่สร้างประวัติซ้ำ **[ยืนยัน]** เฉพาะ Admin, ไม่มีคำขอจากผู้เรียน, ไม่ลบประวัติการเรียนเดิม

### 3.4 ช่องว่างใน scope ที่ Backend ต้องตัดสิน

scope บท 6.2 ไม่มี endpoint สำหรับ **ค้นหา/แสดงรายชื่อผู้ใช้เพื่อเลือกเพิ่มเป็น Instructor** (`GET /admin/users` พร้อม search/pagination) และ **รายชื่อ Instructor สำหรับเลือกเป็นเจ้าของคอร์สตอน Admin สร้างคอร์สแทน** (scope 2.2: หนึ่งคอร์สมี Instructor คนเดียว) หน้า Admin ที่เก็บไว้ต้องใช้สองอย่างนี้ **[รอ Backend/เจ้าของผลิตภัณฑ์]** ยืนยันว่าเพิ่มเป็น operation ของ Flow A/E และกำหนด field ที่ Admin เห็นได้ (PII ขั้นต่ำ)

### 3.5 ตัวอย่างประกอบ (illustrative เท่านั้น)

```json
{
  "id": "usr_example_01",
  "display_name": "สมชาย ใจดี",
  "username": null,
  "email": "somchai@example.com",
  "email_verified": false,
  "avatar_url": null,
  "roles": ["learner"],
  "origin": "self_email",
  "auth_methods": ["password"],
  "learning_eligible": false
}
```

```json
{
  "error": {
    "code": "email_not_verified",
    "message": "กรุณายืนยันอีเมลก่อนลงเรียน",
    "request_id": "example-request-id"
  }
}
```

## 4. Flow B — Catalog และ Enrollment

ใช้คู่กับ Redeem/Admin codes ใน Flow F; เอกสารนี้ครอบคลุมเฉพาะ Catalog สาธารณะ, Enroll ฟรี และรายการ Enrollment

### 4.1 DTO

```ts
interface Money { amount_minor: number; currency: string } // D12

interface InstructorSummary { id: string; display_name: string; avatar_url: string | null }

interface CourseSummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  cover_url: string | null;
  category: string;
  level: string;
  price: Money | null;           // null = คอร์สฟรี
  instructor: InstructorSummary;
  published_at: string;
}

interface OutlineItem { id: string; type: 'video' | 'article' | 'quiz'; title: string }
interface OutlineChapter { id: string; title: string; items: OutlineItem[] }

interface CourseDetail extends CourseSummary {
  description: string | null;
  outcomes: string[];
  outline: OutlineChapter[];     // ชื่อบท/รายการเท่านั้น
}

interface Enrollment {
  id: string;
  course_id: string;
  source: 'free' | 'payment' | 'redeem';
  access: 'lifetime';
  granted_at: string;
}

interface EnrollmentListItem {
  enrollment: Enrollment;
  course: CourseSummary;
  progress: { completed_items: number; total_items: number; completed_at: string | null }; // ปิดรายละเอียดใน Flow C
}
```

- **[ยืนยัน]** Guest เห็นเฉพาะ Published; ข้อมูลสาธารณะต้องไม่มี Draft, เนื้อหาบทเรียนที่จำกัดสิทธิ์, ลิงก์วิดีโอ, คำถาม/เฉลย
- **[รอ Backend]** ชื่อ item ใน `outline` เปิดสาธารณะได้หรือไม่ (ข้อเสนอ: เฉพาะ `type` และ `title`)
- `Enrollment.access` ใช้ค่า `lifetime` ตามตัวอย่าง scope บท 6.3 เพราะสิทธิ์ไม่หมดอายุ

### 4.2 รายการ operation

| Op | Method/Path | ผู้เรียก | Success | Error หลัก | Scope |
| --- | --- | --- | --- | --- | --- |
| FB1 | `GET /courses` | ทุกคน | `200 { items: CourseSummary[], next_cursor }` | `validation_failed` | C09 |
| FB2 | `GET /courses/{id}` | ทุกคน | `200 CourseDetail` | `not_found` | C09 |
| FB3 | `POST /courses/{id}/enroll` | Learner/Instructor ที่ผ่านเงื่อนไขบัญชี | `201` ใหม่ หรือ `200` เดิม → `Enrollment` | `unauthenticated`, `email_not_verified`, `not_found`, `course_not_free`, `enrollment_not_allowed` | E01, E02, A01 |
| FB4 | `GET /me/enrollments` | เจ้าของ | `200 { items: EnrollmentListItem[], next_cursor }` | `unauthenticated` | A06 |

### 4.3 รายละเอียดที่ต้องตกลง

**FB1 รายการคอร์ส** — Query ที่เสนอ: `q`, `category`, `level`, `price_type=free|paid`, `sort`, `limit`, `cursor`. ผลมีเฉพาะ Published. **[รอ Backend]** allowlist ของ filter/sort, ค่าที่ UI แสดงเป็นหมวด/ระดับ (อิสระหรือชุดตายตัว), cache header สาธารณะ

**FB2 รายละเอียดคอร์ส** — **[รอ Backend]** path ใช้ `id` หรือ `slug` (prototype มีทั้งสอง) Draft/Pending/Approved ที่ยังไม่ Published ต้องตอบ `not_found` ต่อสาธารณะ ส่วนเจ้าของ/Admin ดูเพื่อจัดการผ่านชุด authoring (Flow E) ไม่ใช้ Catalog

**FB3 Enroll ฟรี** — ไม่มี body: server ตัดสินว่าฟรีหรือไม่จากข้อมูลคอร์ส ห้ามรับ `price`/`free` จาก Client **[ยืนยัน]** คอร์สเสียเงินปฏิเสธ (`course_not_free`), ซ้ำคืนรายการเดิมโดยมี Enrollment เดียว (E01), Instructor Enroll คอร์สคนอื่นได้ และ `enrollment.create_self` จำกัดที่คอร์สของผู้อื่น จึงปฏิเสธเจ้าของคอร์สที่ Enroll คอร์สตนเอง (`enrollment_not_allowed`, `details.reason=own_course`), บัญชีสมัครอีเมลเองที่ยังไม่ยืนยัน Enroll ไม่ได้ (`email_not_verified`; บัญชี Admin สร้าง/Google เป็นข้อยกเว้นตามเงื่อนไขบัญชี) **[รอ Backend]** Admin Enroll ฟรีได้หรือไม่ (ตาราง permission ใน scope 1.2 ไม่ระบุ Admin ใน `enrollment.create_self` ข้อเสนอคือปฏิเสธด้วย `details.reason=admin`), และใช้ `201`/`200` แยก หรือคืน `200` พร้อม `already_enrolled`

**FB4 คอร์สของฉัน** — คืนเฉพาะ Enrollment ของ session ปัจจุบัน ไม่รับ `user_id` จาก Client **[รอ Backend]** นิยามของ `progress` และการเรียงลำดับ (ล่าสุดที่เรียน) ปิดใน Flow C

### 4.4 ตัวเลือกเพิ่มเติม (ข้อเสนอ ไม่อยู่ใน scope บท 6.3)

เพื่อให้หน้า Catalog/รายละเอียดแสดงปุ่มถูกต้อง โดยยังเก็บ FB1–FB2 เป็นข้อมูลสาธารณะที่ cache ได้ อาจเพิ่ม `GET /me/course-access/{course_id}` คืน `{ enrollment: Enrollment | null, can_enroll_free: boolean, block_reason: string | null }` เป็นคำแนะนำ UX เท่านั้น ถ้า Backend ไม่เพิ่ม Frontend ใช้ `GET /me/enrollments` ร่วมกับ `price` จาก FB2 และปล่อยให้ FB3 ตัดสินผลจริง

### 4.5 ตัวอย่างประกอบ (illustrative เท่านั้น)

FB3 สำเร็จ (ตาม D5 คืน `Enrollment` ตรง ๆ):

```json
{
  "id": "enr_example_01",
  "course_id": "course_example_01",
  "source": "free",
  "access": "lifetime",
  "granted_at": "2026-10-08T09:00:00Z"
}
```

FB3 ถูกปฏิเสธเพราะคอร์สไม่ฟรี:

```json
{
  "error": {
    "code": "course_not_free",
    "message": "คอร์สนี้ไม่ใช่คอร์สฟรี",
    "request_id": "example-request-id"
  }
}
```

## 5. ผลต่อ Frontend ที่รู้ล่วงหน้า (ไม่ใช่ contract)

- เมื่อเปิดแอป เรียก `GET /me` ครั้งเดียว: `401` = Guest, สำเร็จ = มี user; Logout หรือเปลี่ยนบัญชีต้องล้าง cache ที่ผูกกับบัญชีเดิม ตามกติกา query key ในแผน refactor
- Guard ใน UI ใช้ `roles` และ `learning_eligible` เพื่อ UX เท่านั้น เช่น แสดงแบนเนอร์ชวนยืนยันอีเมล ไม่ใช้ปิดสิทธิ์จริง
- Web และ Admin ไม่แชร์ memory cache แม้ใช้ identity ร่วมกัน
- `return path` (`next`) เป็นค่า UI เท่านั้น ไม่ใช่ claim และ Backend ต้องไม่เชื่อเป็นปลายทาง redirect โดยไม่ตรวจ allowlist
- Mock adapter ที่จะทำต่อต้องติดป้าย mock ชัดเจน มีรูปร่างตรงกับ DTO ข้างบน และอยู่หลัง interface เดียวต่อ flow เพื่อสลับเป็น API จริงโดยไม่แก้หน้า; localStorage ของ Web และ Admin ไม่แชร์กัน จึงใช้พิสูจน์พฤติกรรม cross-app ไม่ได้

## 6. คำถามสำหรับ Backend owner (ตอบทีละข้อได้)

1. D1/D2: ใช้ cookie session หรือ bearer? Web กับ Admin ใช้ session ร่วมกันได้หรือไม่ และ origin/cookie domain เป็นอย่างไร?
2. D3–D8: base path, รูปแบบ ID, success/error envelope, pagination, casing ตามข้อเสนอหรือไม่?
3. สมัครอีเมลแล้วสร้าง session ทันทีหรือไม่? `email_taken` เปิดเผยการมีอยู่ของอีเมลหรือไม่?
4. ลิงก์ Verification/Reset ที่ใช้แล้วคืนผลอะไร และอายุลิงก์ Reset เป็นเท่าไร?
5. Resend Verification ต้อง Login อยู่หรือรับ `{ email }` ได้?
6. `audience_not_allowed` แยกจาก `credentials_invalid` หรือไม่? Admin ใช้ Google ได้หรือไม่?
7. Google callback ใช้ allowlist ของ return URL ที่ใด และผล redirect ส่งกลับแบบใด?
8. ต้องเพิ่ม `GET /admin/users` และรายชื่อ Instructor สำหรับ Admin หรือไม่ และเห็น field ใดได้?
9. `outline` ของคอร์สเปิดสาธารณะถึงระดับไหน? path ใช้ `id` หรือ `slug`?
10. Enroll ซ้ำคืน `200` หรือ `201` พร้อม flag? สกุลเงินและรูปแบบ `price` เป็นอะไร?
11. นิยาม `progress` ใน `GET /me/enrollments` (ร่วมกับ Flow C)?

## 7. เกณฑ์ปิด Flow A/B เป็น frozen

ใช้ gate เดียวกับ [R4a Draft](API_CONTRACT_R4A_DRAFT_TH.md): Backend owner และ revision ที่ระบุได้ พร้อม DTO/OpenAPI ตัวอย่าง success/error ที่รันกับ server ได้, ผลตรวจ permission/field visibility/state, validation/pagination/idempotency และ fixtures ที่ผูกกับ revision จากนั้นจึงย้าย DTO ที่ยืนยันแล้วเข้า `packages/contracts` ทีละ flow และเริ่ม R4b-flow (Query hooks) โดยไม่เปลี่ยนตามเอกสารนี้ล่วงหน้า

เอกสารนี้ไม่ยืนยัน Backend, session, Stripe, Resend หรือ Google OAuth ที่ใช้งานได้จริง และไม่ใช้เป็นหลักฐานปิด R10/R13
