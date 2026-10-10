# Melearn V1 — API Contract แยกตามฟีเจอร์

อัปเดต 10 ตุลาคม 2026 · **Frontend Draft — ยังไม่ freeze กับ Backend** · อิง Final 1.6

เอกสารนี้ใช้ส่งให้ผู้เขียน Backend อ่านว่าหน้าจอต้องการ API และ JSON แบบใด สร้างจาก [OpenAPI ต้นทาง](openapi.json) โดยตรง ไม่คัดลอก prototype types เป็น contract. ตัวอย่างเป็นข้อมูลสังเคราะห์จาก mock ไม่ใช่ข้อมูลจริงหรือคำรับรองว่า Backend/provider พร้อม.

## 1. จำนวนฟีเจอร์และ API

มี **14 กลุ่มฟีเจอร์สำหรับ handoff** ครอบคลุม **86 HTTP operations ที่กำหนด schema แล้ว** และ **5 provider operations ที่ยังรอกำหนด protocol** รวม inventory 91 operations. จำนวนนี้นับคู่ method + path ไม่ใช่จำนวนหน้าจอหรือจำนวน path ไม่ซ้ำ. OpenAPI เดิมมี 9 tags; เอกสารแยก Profile/Enrollment/Certificate/Approval/Redeem ให้อ่านเป็นงานได้ชัดขึ้น ไม่เพิ่ม scope ธุรกิจ.

| ฟีเจอร์ | Defined operations | Provider pending |
| --- | ---: | ---: |
| [สมัครบัญชี / Login / ยืนยันอีเมล / กู้รหัสผ่าน](#feature-auth) | 7 | 4 |
| [โปรไฟล์และข้อมูลบัญชีตนเอง](#feature-account) | 2 | 0 |
| [Catalog / รายละเอียดคอร์ส / หน้าผู้สอนสาธารณะ](#feature-catalog) | 4 | 0 |
| [สมัครคอร์สฟรี / รายการคอร์สที่มีสิทธิ์](#feature-enrollment) | 2 | 0 |
| [บทเรียน / Progress / Resume](#feature-learning) | 5 | 0 |
| [แบบฝึกหัด / ส่งคำตอบ / ผลคะแนน / ตรวจงาน](#feature-assessment) | 7 | 0 |
| [ใบรับรอง](#feature-certificate) | 3 | 0 |
| [สร้างและแก้คอร์ส / บท / Quiz / Preview](#feature-authoring) | 9 | 0 |
| [คิวตรวจคอร์ส / อนุมัติ / ส่งกลับ / Publish](#feature-approval) | 5 | 0 |
| [Stripe Checkout / สถานะจ่ายเงิน](#feature-payment) | 3 | 1 |
| [รหัสแลกคอร์ส](#feature-redeem) | 4 | 0 |
| [AI Chat / Transcript / ประวัติ / Quota / AIPractice](#feature-ai) | 11 | 0 |
| [บทความสาธารณะ / Blog Editor](#feature-blog) | 9 | 0 |
| [จัดการผู้ใช้ / Instructor / ผู้เรียน / ผลเรียน / Dashboard](#feature-management) | 15 | 0 |


Methods ที่มี schema แล้ว: `GET` 45, `POST` 29, `PUT` 5, `PATCH` 5, `DELETE` 2. อัปโหลดรูปโปรไฟล์เป็นงานเพิ่มที่ยังไม่มี endpoint/schema/mock จึง **ไม่รวมใน 86 หรือ 91**.

## 2. กติกาอ่านและสร้าง Backend

- Base URL ระบบจริงที่เสนอ: `/api/v1`; dev mock ใช้ `/mock-api/v1`. เปลี่ยน origin/base URL ตาม environment.
- JSON ใช้ field names ตาม schema ด้านล่าง; GET ส่ง query/path ไม่ส่ง JSON body. POST/PATCH/PUT/DELETE ส่ง body ตามที่ operation ระบุเท่านั้น.
- `required` หมายถึงต้องส่ง field; `optional` หมายถึงละได้. `null` ใช้ได้เฉพาะ schema อนุญาต. optional ไม่เท่ากับ null.
- `PATCH` ใช้แก้บางส่วน แต่ nested course content replacement ต้องอ่าน schema/lifecycle ห้ามเดาว่า merge nested lists อัตโนมัติ. `PUT` ใช้บันทึก resource/subresource ตาม endpoint.
- เวลาใช้ค่าจาก server ตามรูปแบบ schema; IDs เป็น opaque strings; ตัวอย่าง ID/เวลา/URL ไม่ใช่ค่าบังคับ.
- Backend ตรวจ authentication, role, ownership, enrollment, lifecycle, progress, score, payment, quota และ concurrency ทุกครั้ง; route guard และ audience ไม่มีอำนาจให้สิทธิ์.
- `Money.amount_minor` เป็น integer หน่วยย่อย, 100 = 1 บาท; Draft/mock ปัจจุบันรองรับ `THB`. Free course ใช้ price `null` ตาม schema.
- แต่ละ schema มีตาราง fields ในภาคผนวก; คลิกชื่อ schema เพื่อดู nested schema/enum/required/validation.

### Login/session แยก Web และ Admin

บัญชีใช้ identity ชุดเดียวกันได้ แต่ Login/logout/session แยกตาม app ที่ผู้ใช้ยืนยันแล้ว. ชื่อ cookie `melearn_web_session` / `melearn_admin_session` เป็นข้อเสนอใน Draft; HttpOnly/Secure/domain/path/CORS/CSRF/TTL/origins ยังต้องตกลงก่อนใช้จริง. Security schemes หลายรายการใน operation เป็นทางเลือก OR ไม่ใช่การอนุญาต role ทั้งหมด; ต้องอ่าน permission คู่กัน.

### Error JSON กลาง

```json
{
  "error": {
    "code": "validation_failed",
    "message": "ข้อมูลที่ส่งไม่ถูกต้อง",
    "request_id": "example-request-id",
    "details": {
      "fields": [
        {
          "field": "display_name",
          "code": "invalid"
        }
      ]
    }
  }
}
```

`error.code`, `message`, `request_id` required; `details` optional ตาม [ErrorEnvelope](#schema-errorenvelope). HTTP: 400 request ไม่ถูกต้อง, 401 ไม่ได้ login, 403 ไม่มีสิทธิ์, 404 ไม่พบหรือซ่อน resource, 409 conflict, 410 หมดอายุ, 422 validation, 429 quota/rate, 500 server, 503 ฟังก์ชัน/บริการไม่พร้อม. OpenAPI ใส่ common error statuses หลายรายการทุก operation; **ไม่ใช่หลักฐานว่าทุก endpoint เกิด error ทุกแบบได้จริง**. ตาราง error ที่มีตัวอย่างด้านล่างระบุ code ที่สังเกตจาก mock; applicability ที่ไม่พบตัวอย่างต้องยืนยันกับ Backend.

## 3. รายละเอียดแต่ละฟีเจอร์

<a id="feature-auth"></a>

### สมัครบัญชี / Login / ยืนยันอีเมล / กู้รหัสผ่าน

Web และ Admin Login แยก session กัน; audience ไม่ใช่หลักฐานสิทธิ์. Google protocol จริงยังรอกำหนด.

| Method | Endpoint | หน้าที่ |
| --- | --- | --- |
| `POST` | `/auth/login` | เข้าสู่ระบบ Web/Admin |
| `POST` | `/auth/logout` | ออกจาก app session ปัจจุบัน |
| `POST` | `/auth/password-reset/confirm` | ตั้งรหัสผ่านใหม่ |
| `POST` | `/auth/password-reset/request` | ขอลิงก์กู้รหัสผ่าน |
| `POST` | `/auth/register` | สมัครด้วยอีเมล |
| `POST` | `/auth/resend-verification-email` | ส่งอีเมลยืนยันใหม่ |
| `POST` | `/auth/verify-email` | ยืนยันอีเมลด้วย token |

#### POST /auth/login

เข้าสู่ระบบ Web/Admin

สิทธิ์: `public`. Session: public ไม่ต้องมี session. สถานะ: draft.

Issue session for selected app only. audience is a selector, never permission evidence. Server validates role/audience. Cookie/session transport remains proposed.

**Request body:** required, `application/json`, schema [LoginRequest](#schema-loginrequest).

ตัวอย่าง JSON:

```json
{
  "identifier": "admin",
  "password": "mock-password-1",
  "audience": "admin"
}
```

**Response 200:** `application/json`, schema [LoginResponse](#schema-loginresponse).

ตัวอย่าง JSON:

```json
{
  "user": {
    "id": "usr_admin",
    "display_name": "ผู้ดูแลตัวอย่าง",
    "username": "admin",
    "email": null,
    "email_verified": false,
    "avatar_url": null,
    "roles": [
      "admin"
    ],
    "origin": "admin_created",
    "auth_methods": [
      "password"
    ],
    "learning_eligible": true,
    "profile": {}
  }
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 401 | `credentials_invalid` | ข้อมูลเข้าสู่ระบบไม่ถูกต้อง |
| 403 | `audience_not_allowed` | บัญชีนี้เข้าส่วนผู้ดูแลไม่ได้ |
| 422 | `validation_failed` | ข้อมูลที่ส่งไม่ถูกต้อง |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries unless operation semantics explicitly permit replay.

#### POST /auth/logout

ออกจาก app session ปัจจุบัน

สิทธิ์: `current app session`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Revoke/clear current app session only. Other app remains signed in. Session expiry and account-wide revocation are separate policies.

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 204:** ไม่มี body.

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries unless operation semantics explicitly permit replay.

#### POST /auth/password-reset/confirm

ตั้งรหัสผ่านใหม่

สิทธิ์: `public`. Session: public ไม่ต้องมี session. สถานะ: draft.

Reset token single use. Current mock revokes all account sessions; global revocation policy separate from per-app logout and pending Backend.

**Request body:** required, `application/json`, schema [PasswordResetConfirmRequest](#schema-passwordresetconfirmrequest).

ตัวอย่าง JSON:

```json
{
  "token": "reset-token-0001",
  "new_password": "new-password-1"
}
```

**Response 200:** `application/json`, schema [PasswordChangedResponse](#schema-passwordchangedresponse).

ตัวอย่าง JSON:

```json
{
  "status": "password_changed"
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 400 | `reset_link_invalid` | ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง |
| 409 | `reset_link_used` | ลิงก์ตั้งรหัสผ่านถูกใช้แล้ว |
| 410 | `reset_link_expired` | ลิงก์ตั้งรหัสผ่านหมดอายุ |
| 422 | `validation_failed` | ข้อมูลที่ส่งไม่ถูกต้อง |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries unless operation semantics explicitly permit replay.

#### POST /auth/password-reset/request

ขอลิงก์กู้รหัสผ่าน

สิทธิ์: `public`. Session: public ไม่ต้องมี session. สถานะ: draft.

Generic202 avoids account discovery. Actual delivery/token TTL/rate limits pending Backend.

**Request body:** required, `application/json`, schema [PasswordResetRequest](#schema-passwordresetrequest).

ตัวอย่าง JSON:

```json
{
  "identifier": "learner-admin"
}
```

**Response 202:** `application/json`, schema [AcceptedResponse](#schema-acceptedresponse).

ตัวอย่าง JSON:

```json
{
  "status": "accepted",
  "retry_after_seconds": 60
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 429 | `rate_limited` | ขอบ่อยเกินไป กรุณารอสักครู่ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries unless operation semantics explicitly permit replay.

#### POST /auth/register

สมัครด้วยอีเมล

สิทธิ์: `public`. Session: public ไม่ต้องมี session. สถานะ: draft.

No login session created. Self-email user remains unverified. Password limits8..128 are Draft, not a frozen Production password policy.

**Request body:** required, `application/json`, schema [RegisterRequest](#schema-registerrequest).

ตัวอย่าง JSON:

```json
{
  "display_name": "สมชาย ใจดี",
  "email": "somchai@example.test",
  "password": "password-123"
}
```

**Response 201:** `application/json`, schema [RegisterResponse](#schema-registerresponse).

ตัวอย่าง JSON:

```json
{
  "user": {
    "id": "usr_0001",
    "display_name": "สมชาย ใจดี",
    "username": null,
    "email": "somchai@example.test",
    "email_verified": false,
    "avatar_url": null,
    "roles": [
      "learner"
    ],
    "origin": "self_email",
    "auth_methods": [
      "password"
    ],
    "learning_eligible": false,
    "profile": {}
  },
  "verification_email": "queued"
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 409 | `email_taken` | อีเมลนี้ถูกใช้แล้ว |
| 422 | `validation_failed` | ข้อมูลที่ส่งไม่ถูกต้อง |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries unless operation semantics explicitly permit replay.

#### POST /auth/resend-verification-email

ส่งอีเมลยืนยันใหม่

สิทธิ์: `public`. Session: public ไม่ต้องมี session. สถานะ: draft.

Session or email identifier; generic202 whether account exists. Rate limiting429 and Retry-After;60s cooldown is Draft.

**Request body:** optional, `application/json`, schema [ResendVerificationRequest](#schema-resendverificationrequest).

ตัวอย่าง JSON:

```json
{
  "email": "nobody@example.test"
}
```

**Response 202:** `application/json`, schema [AcceptedResponse](#schema-acceptedresponse).

ตัวอย่าง JSON:

```json
{
  "status": "accepted",
  "retry_after_seconds": 60
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 401 | `unauthenticated` | กรุณาเข้าสู่ระบบ |
| 429 | `rate_limited` | ขอบ่อยเกินไป กรุณารอสักครู่ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries unless operation semantics explicitly permit replay.

#### POST /auth/verify-email

ยืนยันอีเมลด้วย token

สิทธิ์: `public`. Session: public ไม่ต้องมี session. สถานะ: draft.

Single-use24h link; already-used returns already_verified in current Draft; expired410. Never return raw token in user data.

**Request body:** required, `application/json`, schema [VerifyEmailRequest](#schema-verifyemailrequest).

ตัวอย่าง JSON:

```json
{
  "token": "verify-token-0001"
}
```

**Response 200:** `application/json`, schema [VerifyEmailResponse](#schema-verifyemailresponse).

ตัวอย่าง JSON:

```json
{
  "status": "verified"
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 400 | `verification_link_invalid` | ลิงก์ยืนยันอีเมลไม่ถูกต้อง |
| 410 | `verification_link_expired` | ลิงก์ยืนยันอีเมลหมดอายุ |
| 422 | `validation_failed` | ข้อมูลที่ส่งไม่ถูกต้อง |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries unless operation semantics explicitly permit replay.

<a id="feature-account"></a>

### โปรไฟล์และข้อมูลบัญชีตนเอง

อ่าน/แก้บัญชีตนเอง ห้ามเปลี่ยน role หรือสถานะยืนยันอีเมลผ่าน profile. avatar_url รับ URL; API อัปโหลดไฟล์ยังไม่มี.

| Method | Endpoint | หน้าที่ |
| --- | --- | --- |
| `GET` | `/me` | ข้อมูลบัญชีปัจจุบัน / แก้ข้อมูลตนเอง |
| `PATCH` | `/me` | ข้อมูลบัญชีปัจจุบัน / แก้ข้อมูลตนเอง |

#### GET /me

ข้อมูลบัญชีปัจจุบัน / แก้ข้อมูลตนเอง

สิทธิ์: `user.profile_self`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Server validates authentication, permission and current principal resource scope.

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [CurrentUser](#schema-currentuser).

ตัวอย่าง JSON:

```json
{
  "id": "usr_admin",
  "display_name": "ผู้ดูแลตัวอย่าง",
  "username": "admin",
  "email": null,
  "email_verified": false,
  "avatar_url": null,
  "roles": [
    "admin"
  ],
  "origin": "admin_created",
  "auth_methods": [
    "password"
  ],
  "learning_eligible": true,
  "profile": {}
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 401 | `unauthenticated` | กรุณาเข้าสู่ระบบ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries unless operation semantics explicitly permit replay.

#### PATCH /me

ข้อมูลบัญชีปัจจุบัน / แก้ข้อมูลตนเอง

สิทธิ์: `user.profile_self`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Merge supplied fields, leave omitted unchanged. profile text null clears to empty string; root avatar null clears. Server-owned roles/identity/verification cannot be written. CamelCase profile naming is compatibility Draft requiring explicit migration before rename.

**Request body:** required, `application/json`, schema [UpdateProfileRequest](#schema-updateprofilerequest).

ตัวอย่าง JSON:

```json
{
  "username": "shared.name"
}
```

**Response 200:** `application/json`, schema [CurrentUser](#schema-currentuser).

ตัวอย่าง JSON:

```json
{
  "id": "usr_learner",
  "display_name": "ชื่อใหม่",
  "username": null,
  "email": "learner@example.test",
  "email_verified": true,
  "avatar_url": null,
  "roles": [
    "learner"
  ],
  "origin": "self_email",
  "auth_methods": [
    "password"
  ],
  "learning_eligible": true,
  "profile": {}
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 401 | `unauthenticated` | กรุณาเข้าสู่ระบบ |
| 409 | `username_taken` | ชื่อผู้ใช้นี้ถูกใช้แล้ว |
| 422 | `validation_failed` | ข้อมูลที่ส่งไม่ถูกต้อง |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries unless operation semantics explicitly permit replay.

<a id="feature-catalog"></a>

### Catalog / รายละเอียดคอร์ส / หน้าผู้สอนสาธารณะ

แสดงคอร์ส published เท่านั้น; public outline ไม่เปิดเนื้อหาบทเรียนหรือเฉลย. API ใช้ course ID แม้ UI บาง route ใช้ slug.

| Method | Endpoint | หน้าที่ |
| --- | --- | --- |
| `GET` | `/courses` | รายการคอร์สสาธารณะ |
| `GET` | `/courses/{id}` | รายละเอียด public / แก้โครงสร้างและเนื้อหาคอร์ส |
| `GET` | `/instructors/{id}` | โปรไฟล์ผู้สอน public |
| `GET` | `/instructors/{id}/courses` | คอร์ส published ของผู้สอน |

#### GET /courses

รายการคอร์สสาธารณะ

สิทธิ์: `course.read_public`. Session: public ไม่ต้องมี session. สถานะ: draft.

Published only; sort published_at descending then ID ascending in current Draft. Free price null; paid money uses integer minor units. No lesson content, answer keys, transcript or private review notes.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `q` | query | string | optional | — |
| `category` | query | string | optional | — |
| `level` | query | string | optional | — |
| `price_type` | query | string | optional | enum: ["free","paid"] |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [CoursePage](#schema-coursepage).

ตัวอย่าง JSON:

```json
{
  "items": [
    {
      "id": "crs_mock_003",
      "slug": "mock-data-storytelling",
      "title": "เล่าเรื่องด้วยข้อมูล (ตัวอย่าง)",
      "subtitle": "จากตารางสู่ข้อสรุป",
      "cover_url": null,
      "category": "การสื่อสาร",
      "level": "ขั้นสูง",
      "price": {
        "amount_minor": 249000,
        "currency": "THB"
      },
      "instructor": {
        "id": "usr_instructor_a",
        "display_name": "ผู้สอนตัวอย่าง ก",
        "avatar_url": null
      },
      "published_at": "2026-10-05T03:00:00Z"
    },
    {
      "id": "crs_mock_002",
      "slug": "mock-presentation-skills",
      "title": "ทักษะการนำเสนอ (ตัวอย่าง)",
      "subtitle": null,
      "cover_url": null,
      "category": "การสื่อสาร",
      "level": "กลาง",
      "price": {
        "amount_minor": 99000,
        "currency": "THB"
      },
      "instructor": {
        "id": "usr_instructor_b",
        "display_name": "ผู้สอนตัวอย่าง ข",
        "avatar_url": null
      },
      "published_at": "2026-10-01T03:00:00Z"
    },
    {
      "id": "crs_mock_001",
      "slug": "mock-online-course-basics",
      "title": "พื้นฐานการออกแบบคอร์สออนไลน์ (ตัวอย่าง)",
      "subtitle": "วางโครงคอร์สให้ผู้เรียนเรียนต่อเนื่อง",
      "cover_url": null,
      "category": "การสอนออนไลน์",
      "level": "เริ่มต้น",
      "price": null,
      "instructor": {
        "id": "usr_instructor_a",
        "display_name": "ผู้สอนตัวอย่าง ก",
        "avatar_url": null
      },
      "published_at": "2026-09-20T03:00:00Z"
    }
  ],
  "next_cursor": null
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries unless operation semantics explicitly permit replay.

#### GET /courses/{id}

รายละเอียด public / แก้โครงสร้างและเนื้อหาคอร์ส

สิทธิ์: `course.read_public`. Session: public ไม่ต้องมี session. สถานะ: draft.

ID lookup only. Draft/private/missing course all404. Public outline metadata excludes lesson content and answer keys.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [CourseDetail](#schema-coursedetail).

ตัวอย่าง JSON:

```json
{
  "id": "crs_0001",
  "slug": "course-crs_0001",
  "title": "คอร์สทดสอบ",
  "subtitle": null,
  "cover_url": null,
  "category": "เทคโนโลยี",
  "level": "เริ่มต้น",
  "price": null,
  "instructor": {
    "id": "usr_instructor_a",
    "display_name": "ผู้สอนตัวอย่าง ก",
    "avatar_url": null
  },
  "published_at": "2026-10-08T09:00:00Z",
  "description": null,
  "outcomes": [],
  "outline": [
    {
      "id": "chp_0001",
      "title": "บทแรก",
      "items": [
        {
          "id": "itm_0001",
          "type": "video",
          "title": "วิดีโอ"
        },
        {
          "id": "itm_0002",
          "type": "article",
          "title": "บทอ่าน"
        }
      ]
    }
  ]
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 404 | `not_found` | ไม่พบข้อมูลที่ขอ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries unless operation semantics explicitly permit replay.

#### GET /instructors/{id}

โปรไฟล์ผู้สอน public

สิทธิ์: `course.read_public`. Session: public ไม่ต้องมี session. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [PublicInstructorDto](#schema-publicinstructordto).

ตัวอย่าง JSON:

```json
{
  "id": "usr_instructor_a",
  "display_name": "ผู้สอนตัวอย่าง ก",
  "avatar_url": null,
  "bio": null
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /instructors/{id}/courses

คอร์ส published ของผู้สอน

สิทธิ์: `course.read_public`. Session: public ไม่ต้องมี session. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [PublicInstructorCoursePage](#schema-publicinstructorcoursepage).

ตัวอย่าง JSON:

```json
{
  "items": [
    {
      "id": "crs_mock_001",
      "slug": "mock-online-course-basics",
      "title": "พื้นฐานการออกแบบคอร์สออนไลน์ (ตัวอย่าง)",
      "subtitle": "วางโครงคอร์สให้ผู้เรียนเรียนต่อเนื่อง",
      "cover_url": null,
      "category": "การสอนออนไลน์",
      "level": "เริ่มต้น",
      "price": null,
      "instructor": {
        "id": "usr_instructor_a",
        "display_name": "ผู้สอนตัวอย่าง ก",
        "avatar_url": null
      },
      "published_at": "2026-09-20T03:00:00Z",
      "description": "คำอธิบายตัวอย่างสำหรับทดสอบหน้ารายละเอียดคอร์ส",
      "outcomes": [
        "วางโครงบทเรียนได้",
        "เลือกรูปแบบเนื้อหาให้เหมาะกับผู้เรียน"
      ],
      "outline": [
        {
          "id": "chp_mock_001_1",
          "title": "เริ่มต้นออกแบบ",
          "items": [
            {
              "id": "itm_mock_001_1",
              "type": "video",
              "title": "ภาพรวมคอร์ส"
            },
            {
              "id": "itm_mock_001_2",
              "type": "article",
              "title": "เช็กลิสต์ก่อนสร้างคอร์ส"
            },
            {
              "id": "itm_mock_001_3",
              "type": "quiz",
              "title": "ทบทวนบทที่ 1"
            }
          ]
        }
      ]
    },
    {
      "id": "crs_mock_003",
      "slug": "mock-data-storytelling",
      "title": "เล่าเรื่องด้วยข้อมูล (ตัวอย่าง)",
      "subtitle": "จากตารางสู่ข้อสรุป",
      "cover_url": null,
      "category": "การสื่อสาร",
      "level": "ขั้นสูง",
      "price": {
        "amount_minor": 249000,
        "currency": "THB"
      },
      "instructor": {
        "id": "usr_instructor_a",
        "display_name": "ผู้สอนตัวอย่าง ก",
        "avatar_url": null
      },
      "published_at": "2026-10-05T03:00:00Z",
      "description": "คอร์สตัวอย่างราคาสูงกว่าเพื่อทดสอบการกรองและเรียงลำดับ",
      "outcomes": [],
      "outline": []
    }
  ],
  "next_cursor": null
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

<a id="feature-enrollment"></a>

### สมัครคอร์สฟรี / รายการคอร์สที่มีสิทธิ์

สิทธิ์เรียนสร้างโดย server; Instructor เรียนคอร์สคนอื่นได้; ห้าม Admin ซื้อหรือสมัครผ่าน learner flow.

| Method | Endpoint | หน้าที่ |
| --- | --- | --- |
| `POST` | `/courses/{id}/enroll` | ลงคอร์สฟรี |
| `GET` | `/me/enrollments` | รายการคอร์สที่มีสิทธิ์ |

#### POST /courses/{id}/enroll

ลงคอร์สฟรี

สิทธิ์: `enrollment.create_self`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Server checks verified/exempt user and course. Reject Admin and own course. Paid course without existing enrollment409 course_not_free. Atomic uniqueness user/course; duplicate returns same enrollment200, initial grant201. Browser cannot supply user/price/source.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** optional, `application/json`, schema [EmptyRequest](#schema-emptyrequest).

ตัวอย่าง JSON:

```json
{}
```

**Response 200:** `application/json`, schema [EnrollmentDto](#schema-enrollmentdto).

ตัวอย่าง JSON:

```json
{
  "id": "enr_0001",
  "course_id": "crs_mock_001",
  "source": "free",
  "access": "lifetime",
  "granted_at": "2026-10-08T09:00:00Z"
}
```

**Response 201:** `application/json`, schema [EnrollmentDto](#schema-enrollmentdto).

ตัวอย่าง JSON:

```json
{
  "id": "enr_0001",
  "course_id": "crs_0001",
  "source": "free",
  "access": "lifetime",
  "granted_at": "2026-10-08T09:00:00Z"
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 401 | `unauthenticated` | กรุณาเข้าสู่ระบบ |
| 403 | `email_not_verified` | กรุณายืนยันอีเมลก่อนลงเรียน |
| 404 | `not_found` | ไม่พบข้อมูลที่ขอ |
| 409 | `course_not_free` | คอร์สนี้ไม่ใช่คอร์สฟรี |
| 422 | `validation_failed` | ข้อมูลที่ส่งไม่ถูกต้อง |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries unless operation semantics explicitly permit replay.

#### GET /me/enrollments

รายการคอร์สที่มีสิทธิ์

สิทธิ์: `enrollment.read_self`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Only current principal. Server projects course/progress; client cannot choose user_id.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [EnrollmentPage](#schema-enrollmentpage).

ตัวอย่าง JSON:

```json
{
  "items": [
    {
      "enrollment": {
        "id": "enr_0002",
        "course_id": "crs_mock_002",
        "source": "free",
        "access": "lifetime",
        "granted_at": "2026-10-08T09:00:01Z"
      },
      "course": {
        "id": "crs_mock_002",
        "slug": "mock-presentation-skills",
        "title": "ทักษะการนำเสนอ (ตัวอย่าง)",
        "subtitle": null,
        "cover_url": null,
        "category": "การสื่อสาร",
        "level": "กลาง",
        "price": null,
        "instructor": {
          "id": "usr_instructor_b",
          "display_name": "ผู้สอนตัวอย่าง ข",
          "avatar_url": null
        },
        "published_at": "2026-10-01T03:00:00Z"
      },
      "progress": {
        "completed_items": 0,
        "total_items": 1,
        "completed_at": null
      }
    }
  ],
  "next_cursor": "o:1"
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 401 | `unauthenticated` | กรุณาเข้าสู่ระบบ |
| 422 | `validation_failed` | ข้อมูลที่ส่งไม่ถูกต้อง |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries unless operation semantics explicitly permit replay.

<a id="feature-learning"></a>

### บทเรียน / Progress / Resume

ต้องมีสิทธิ์เรียน; เปิดหน้าอย่างเดียวไม่ถือว่าเรียนจบ; server บันทึก progress/resume.

| Method | Endpoint | หน้าที่ |
| --- | --- | --- |
| `GET` | `/learn/courses/{id}` | โครงสร้างคอร์สสำหรับเรียน |
| `GET` | `/learn/courses/{id}/items/{item_id}` | เปิดเนื้อหาเรียน |
| `POST` | `/learn/items/{id}/complete` | ยืนยันจบเนื้อหา |
| `PUT` | `/learn/items/{id}/resume` | บันทึกตำแหน่งวิดีโอ |
| `GET` | `/me/progress` | ความคืบหน้าตนเอง |

#### GET /learn/courses/{id}

โครงสร้างคอร์สสำหรับเรียน

สิทธิ์: `learning.read_self: effective enrollment`. Session: WebSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [WireLearningCourse](#schema-wirelearningcourse).

ตัวอย่าง JSON:

```json
{
  "id": "crs_mock_002",
  "slug": "mock-presentation-skills",
  "title": "ทักษะการนำเสนอ (ตัวอย่าง)",
  "subtitle": null,
  "cover_url": null,
  "category": "การสื่อสาร",
  "level": "กลาง",
  "price": {
    "amount_minor": 99000,
    "currency": "THB"
  },
  "instructor": {
    "id": "usr_instructor_b",
    "display_name": "ผู้สอนตัวอย่าง ข",
    "avatar_url": null
  },
  "published_at": "2026-10-01T03:00:00Z",
  "access": {
    "mode": "enrolled",
    "enrollment": {
      "id": "enr_0001",
      "course_id": "crs_mock_002",
      "source": "stripe",
      "access": "lifetime",
      "granted_at": "2026-10-08T09:00:00Z"
    }
  },
  "outline": [
    {
      "id": "chp_mock_002_1",
      "title": "โครงเรื่อง",
      "items": [
        {
          "id": "itm_mock_002_1",
          "type": "video",
          "title": "เปิดเรื่อง",
          "completed_at": null,
          "resume": null
        }
      ]
    },
    {
      "id": "chp_mock_002_2",
      "title": "บทว่าง (ยังไม่มีเนื้อหา)",
      "items": []
    }
  ],
  "progress": {
    "completed_items": 0,
    "total_items": 1,
    "completed_at": null
  },
  "resume_item_id": "itm_mock_002_1",
  "certificate_id": null
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 401 | `unauthenticated` | กรุณาเข้าสู่ระบบ |
| 403 | `forbidden` | ไม่มีสิทธิ์ใช้งานส่วนนี้ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /learn/courses/{id}/items/{item_id}

เปิดเนื้อหาเรียน

สิทธิ์: `course.read_content: effective enrollment`. Session: WebSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |
| `item_id` | path | string | required | minLength: 1 |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [WireLearningItemContent](#schema-wirelearningitemcontent).

ตัวอย่าง JSON:

```json
{
  "id": "itm_mock_001_3",
  "type": "quiz",
  "title": "ทบทวนบทที่ 1",
  "quiz": {
    "question_count": 3,
    "max_score": 4
  }
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### POST /learn/items/{id}/complete

ยืนยันจบเนื้อหา

สิทธิ์: `progress.update_self`. Session: WebSession. สถานะ: draft.

Explicit video/article completion only. Quiz completion derives from graded attempt. Repeated completion must preserve original timestamp and completion/certificate snapshot.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** optional, `application/json`, schema [EmptyRequest](#schema-emptyrequest).

ตัวอย่าง JSON:

```json
{}
```

**Response 200:** `application/json`, schema [CompleteResponse](#schema-completeresponse).

ตัวอย่าง JSON:

```json
{
  "item_id": "itm_mock_001_1",
  "completed_at": "2026-10-08T09:00:00Z",
  "progress": {
    "completed_items": 1,
    "total_items": 3,
    "completed_at": null
  },
  "course_completed_at": null,
  "certificate_id": null
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 404 | `not_found` | ไม่พบข้อมูลที่ขอ |
| 409 | `invalid_state` | แบบฝึกหัดต้องส่งคำตอบก่อน |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### PUT /learn/items/{id}/resume

บันทึกตำแหน่งวิดีโอ

สิทธิ์: `progress.update_self`. Session: WebSession. สถานะ: draft.

Video requires finite nonnegative seconds; article/quiz accept absent/null only. Server owns timestamp.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** required, `application/json`, schema [ResumeRequest](#schema-resumerequest).

ตัวอย่าง JSON:

```json
{
  "position_seconds": 12
}
```

**Response 200:** `application/json`, schema [ResumeResponse](#schema-resumeresponse).

ตัวอย่าง JSON:

```json
{
  "item_id": "itm_extra_video",
  "resume": {
    "position_seconds": 12,
    "updated_at": "2026-10-08T09:00:00Z"
  }
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /me/progress

ความคืบหน้าตนเอง

สิทธิ์: `learning.read_self`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [ProgressPage](#schema-progresspage).

ตัวอย่าง JSON:

```json
{
  "items": [
    {
      "course_id": "crs_mock_001",
      "enrollment_id": "enr_0001",
      "progress": {
        "completed_items": 0,
        "total_items": 3,
        "completed_at": null
      },
      "resume_item_id": "itm_mock_001_1",
      "completed_at": null
    }
  ],
  "next_cursor": null
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

<a id="feature-assessment"></a>

### แบบฝึกหัด / ส่งคำตอบ / ผลคะแนน / ตรวจงาน

ผ่านเมื่อคะแนนมากกว่า 70%; ข้อเขียน/ภาพรอ Instructor เจ้าของคอร์สตรวจ; Admin อ่านเพื่อจัดการได้แต่ไม่ให้คะแนน.

| Method | Endpoint | หน้าที่ |
| --- | --- | --- |
| `PUT` | `/instructor/attempts/{id}/questions/{question_id}/grade` | บันทึกคะแนนและ feedback |
| `GET` | `/instructor/grading-queue` | คิวข้อเขียน/ภาพรอตรวจ |
| `GET` | `/learn/attempts/{id}` | อ่าน attempt ตนเอง |
| `PUT` | `/learn/attempts/{id}/answers` | บันทึกคำตอบ |
| `POST` | `/learn/attempts/{id}/submit` | ส่ง attempt |
| `POST` | `/learn/items/{id}/attempts` | เริ่มหรือรับ attempt |
| `GET` | `/learn/items/{id}/results` | อ่านผลเรียนของแบบฝึกหัด |

#### PUT /instructor/attempts/{id}/questions/{question_id}/grade

บันทึกคะแนนและ feedback

สิทธิ์: `quiz.grade: owner Instructor; Admin forbidden`. Session: WebSession. สถานะ: draft.

Score0..snapshot question.points in half-point increments (Draft granularity). Server calculates total/pass/completion; repeat final grade requires idempotency policy.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |
| `question_id` | path | string | required | minLength: 1 |

**Request body:** required, `application/json`, schema [QuestionGradeRequest](#schema-questiongraderequest).

ตัวอย่าง JSON:

```json
{
  "score": 2,
  "comment": null
}
```

**Response 200:** `application/json`, schema [WireAttemptView](#schema-wireattemptview).

ตัวอย่าง JSON:

```json
{
  "id": "att_0001",
  "item_id": "itm_mock_001_3",
  "course_id": "crs_mock_001",
  "number": 1,
  "status": "graded",
  "started_at": "2026-10-08T09:00:00Z",
  "submitted_at": "2026-10-08T09:00:00Z",
  "graded_at": "2026-10-08T09:00:00Z",
  "questions": [
    {
      "id": "qst_mock_001_1",
      "type": "single_choice",
      "prompt": "ข้อใดคือจุดเริ่มต้นของการออกแบบคอร์ส",
      "points": 1,
      "prompt_doc": null,
      "options": [
        {
          "id": "opt_001_1_a",
          "text": "เขียนเนื้อหาทันที"
        },
        {
          "id": "opt_001_1_b",
          "text": "กำหนดผลลัพธ์การเรียนรู้"
        }
      ]
    },
    {
      "id": "qst_mock_001_2",
      "type": "multiple_choice",
      "prompt": "เลือกรูปแบบเนื้อหาที่ใช้ได้ทั้งหมด",
      "points": 1,
      "prompt_doc": null,
      "options": [
        {
          "id": "opt_001_2_a",
          "text": "วิดีโอ"
        },
        {
          "id": "opt_001_2_b",
          "text": "ตัวอักษรสีขาวบนพื้นขาว"
        },
        {
          "id": "opt_001_2_c",
          "text": "บทอ่าน"
        }
      ]
    },
    {
      "id": "qst_mock_001_3",
      "type": "essay",
      "prompt": "อธิบายแผนบทเรียนของคุณสั้น ๆ",
      "points": 2,
      "prompt_doc": null,
      "options": []
    }
  ],
  "answers": {
    "qst_mock_001_1": {
      "option_ids": [
        "opt_001_1_b"
      ]
    },
    "qst_mock_001_2": {
      "option_ids": [
        "opt_001_2_a",
        "opt_001_2_c"
      ]
    },
    "qst_mock_001_3": {
      "text": "คำตอบ"
    }
  },
  "max": 4,
  "earned": 4,
  "percent": 100,
  "passed": true,
  "question_results": [
    {
      "question_id": "qst_mock_001_1",
      "score": 1,
      "max": 1,
      "comment": null
    },
    {
      "question_id": "qst_mock_001_2",
      "score": 1,
      "max": 1,
      "comment": null
    },
    {
      "question_id": "qst_mock_001_3",
      "score": 2,
      "max": 2,
      "comment": "ดี"
    }
  ]
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 403 | `forbidden` | ไม่มีสิทธิ์ตรวจคะแนน |
| 404 | `not_found` | ไม่พบข้อมูลที่ขอ |
| 422 | `validation_failed` | ข้อมูลที่ส่งไม่ถูกต้อง |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /instructor/grading-queue

คิวข้อเขียน/ภาพรอตรวจ

สิทธิ์: `quiz.grade: owner Instructor; Admin forbidden`. Session: WebSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [GradingQueuePage](#schema-gradingqueuepage).

ตัวอย่าง JSON:

```json
{
  "items": [],
  "next_cursor": null
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /learn/attempts/{id}

อ่าน attempt ตนเอง

สิทธิ์: `learning.read_self`. Session: WebSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [WireAttemptView](#schema-wireattemptview).

ตัวอย่าง JSON:

```json
{
  "id": "att_0001",
  "item_id": "itm_mock_001_3",
  "course_id": "crs_mock_001",
  "number": 1,
  "status": "in_progress",
  "started_at": "2026-10-08T09:00:00Z",
  "submitted_at": null,
  "graded_at": null,
  "questions": [
    {
      "id": "qst_mock_001_1",
      "type": "single_choice",
      "prompt": "ข้อใดคือจุดเริ่มต้นของการออกแบบคอร์ส",
      "points": 1,
      "prompt_doc": null,
      "options": [
        {
          "id": "opt_001_1_a",
          "text": "เขียนเนื้อหาทันที"
        },
        {
          "id": "opt_001_1_b",
          "text": "กำหนดผลลัพธ์การเรียนรู้"
        }
      ]
    },
    {
      "id": "qst_mock_001_2",
      "type": "multiple_choice",
      "prompt": "เลือกรูปแบบเนื้อหาที่ใช้ได้ทั้งหมด",
      "points": 1,
      "prompt_doc": null,
      "options": [
        {
          "id": "opt_001_2_a",
          "text": "วิดีโอ"
        },
        {
          "id": "opt_001_2_b",
          "text": "ตัวอักษรสีขาวบนพื้นขาว"
        },
        {
          "id": "opt_001_2_c",
          "text": "บทอ่าน"
        }
      ]
    }
  ],
  "answers": {},
  "max": 2,
  "earned": null,
  "percent": null,
  "passed": null,
  "question_results": null
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### PUT /learn/attempts/{id}/answers

บันทึกคำตอบ

สิทธิ์: `quiz.attempt_self`. Session: WebSession. สถานะ: draft.

Merge answers by question ID in immutable snapshot, in_progress only; verify option IDs/type/completeness server-side. Save/submit race needs atomic server check.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** required, `application/json`, schema [SaveAnswersRequest](#schema-saveanswersrequest).

ตัวอย่าง JSON:

```json
{
  "answers": {
    "qst_mock_001_1": {
      "option_ids": [
        "opt_001_1_a"
      ]
    },
    "qst_mock_001_2": {
      "option_ids": [
        "opt_001_2_b"
      ]
    }
  }
}
```

**Response 200:** `application/json`, schema [WireAttemptView](#schema-wireattemptview).

ตัวอย่าง JSON:

```json
{
  "id": "att_0002",
  "item_id": "itm_mock_001_3",
  "course_id": "crs_mock_001",
  "number": 2,
  "status": "in_progress",
  "started_at": "2026-10-08T09:00:00Z",
  "submitted_at": null,
  "graded_at": null,
  "questions": [
    {
      "id": "qst_mock_001_1",
      "type": "single_choice",
      "prompt": "ข้อใดคือจุดเริ่มต้นของการออกแบบคอร์ส",
      "points": 1,
      "prompt_doc": null,
      "options": [
        {
          "id": "opt_001_1_a",
          "text": "เขียนเนื้อหาทันที"
        },
        {
          "id": "opt_001_1_b",
          "text": "กำหนดผลลัพธ์การเรียนรู้"
        }
      ]
    },
    {
      "id": "qst_mock_001_2",
      "type": "multiple_choice",
      "prompt": "เลือกรูปแบบเนื้อหาที่ใช้ได้ทั้งหมด",
      "points": 1,
      "prompt_doc": null,
      "options": [
        {
          "id": "opt_001_2_a",
          "text": "วิดีโอ"
        },
        {
          "id": "opt_001_2_b",
          "text": "ตัวอักษรสีขาวบนพื้นขาว"
        },
        {
          "id": "opt_001_2_c",
          "text": "บทอ่าน"
        }
      ]
    }
  ],
  "answers": {
    "qst_mock_001_1": {
      "option_ids": [
        "opt_001_1_a"
      ]
    },
    "qst_mock_001_2": {
      "option_ids": [
        "opt_001_2_b"
      ]
    }
  },
  "max": 2,
  "earned": null,
  "percent": null,
  "passed": null,
  "question_results": null
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 409 | `invalid_state` | แก้คำตอบไม่ได้ในสถานะนี้ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### POST /learn/attempts/{id}/submit

ส่ง attempt

สิทธิ์: `quiz.attempt_self`. Session: WebSession. สถานะ: draft.

Repeat submit returns current state. Server grades choices; written/image wait for owner Instructor. Raw earned/max must be greater than70%; exactly70 fails.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** optional, `application/json`, schema [EmptyRequest](#schema-emptyrequest).

ตัวอย่าง JSON:

```json
{}
```

**Response 200:** `application/json`, schema [WireAttemptView](#schema-wireattemptview).

ตัวอย่าง JSON:

```json
{
  "id": "att_0002",
  "item_id": "itm_mock_001_3",
  "course_id": "crs_mock_001",
  "number": 2,
  "status": "graded",
  "started_at": "2026-10-08T09:00:00Z",
  "submitted_at": "2026-10-08T09:00:00Z",
  "graded_at": "2026-10-08T09:00:00Z",
  "questions": [
    {
      "id": "qst_mock_001_1",
      "type": "single_choice",
      "prompt": "ข้อใดคือจุดเริ่มต้นของการออกแบบคอร์ส",
      "points": 1,
      "prompt_doc": null,
      "options": [
        {
          "id": "opt_001_1_a",
          "text": "เขียนเนื้อหาทันที"
        },
        {
          "id": "opt_001_1_b",
          "text": "กำหนดผลลัพธ์การเรียนรู้"
        }
      ]
    },
    {
      "id": "qst_mock_001_2",
      "type": "multiple_choice",
      "prompt": "เลือกรูปแบบเนื้อหาที่ใช้ได้ทั้งหมด",
      "points": 1,
      "prompt_doc": null,
      "options": [
        {
          "id": "opt_001_2_a",
          "text": "วิดีโอ"
        },
        {
          "id": "opt_001_2_b",
          "text": "ตัวอักษรสีขาวบนพื้นขาว"
        },
        {
          "id": "opt_001_2_c",
          "text": "บทอ่าน"
        }
      ]
    }
  ],
  "answers": {
    "qst_mock_001_1": {
      "option_ids": [
        "opt_001_1_a"
      ]
    },
    "qst_mock_001_2": {
      "option_ids": [
        "opt_001_2_b"
      ]
    }
  },
  "max": 2,
  "earned": 0,
  "percent": 0,
  "passed": false,
  "question_results": [
    {
      "question_id": "qst_mock_001_1",
      "score": 0,
      "max": 1,
      "comment": null
    },
    {
      "question_id": "qst_mock_001_2",
      "score": 0,
      "max": 1,
      "comment": null
    }
  ]
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### POST /learn/items/{id}/attempts

เริ่มหรือรับ attempt

สิทธิ์: `quiz.attempt_self`. Session: WebSession. สถานะ: draft.

Snapshot on start; resume existing in-progress attempt; never disclose answer key.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** optional, `application/json`, schema [EmptyRequest](#schema-emptyrequest).

ตัวอย่าง JSON:

```json
{}
```

**Response 200:** `application/json`, schema [WireAttemptView](#schema-wireattemptview).

ยังไม่มีตัวอย่าง response ที่เก็บไว้; ใช้ schema ที่ลิงก์.

**Response 201:** `application/json`, schema [WireAttemptView](#schema-wireattemptview).

ตัวอย่าง JSON:

```json
{
  "id": "att_0001",
  "item_id": "itm_mock_001_3",
  "course_id": "crs_mock_001",
  "number": 1,
  "status": "in_progress",
  "started_at": "2026-10-08T09:00:00Z",
  "submitted_at": null,
  "graded_at": null,
  "questions": [
    {
      "id": "qst_mock_001_1",
      "type": "single_choice",
      "prompt": "ข้อใดคือจุดเริ่มต้นของการออกแบบคอร์ส",
      "points": 1,
      "prompt_doc": null,
      "options": [
        {
          "id": "opt_001_1_a",
          "text": "เขียนเนื้อหาทันที"
        },
        {
          "id": "opt_001_1_b",
          "text": "กำหนดผลลัพธ์การเรียนรู้"
        }
      ]
    },
    {
      "id": "qst_mock_001_2",
      "type": "multiple_choice",
      "prompt": "เลือกรูปแบบเนื้อหาที่ใช้ได้ทั้งหมด",
      "points": 1,
      "prompt_doc": null,
      "options": [
        {
          "id": "opt_001_2_a",
          "text": "วิดีโอ"
        },
        {
          "id": "opt_001_2_b",
          "text": "ตัวอักษรสีขาวบนพื้นขาว"
        },
        {
          "id": "opt_001_2_c",
          "text": "บทอ่าน"
        }
      ]
    }
  ],
  "answers": {},
  "max": 2,
  "earned": null,
  "percent": null,
  "passed": null,
  "question_results": null
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /learn/items/{id}/results

อ่านผลเรียนของแบบฝึกหัด

สิทธิ์: `learning.read_self`. Session: WebSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [QuizResults](#schema-quizresults).

ตัวอย่าง JSON:

```json
{
  "attempts": [
    {
      "attempt_id": "att_0001",
      "number": 1,
      "status": "in_progress",
      "submitted_at": null,
      "graded_at": null,
      "earned": null,
      "max": 4,
      "percent": null,
      "passed": null
    }
  ],
  "best": null,
  "completed": false
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

<a id="feature-certificate"></a>

### ใบรับรอง

อ่าน/ดาวน์โหลดเฉพาะเจ้าของ; ออกครั้งเดียวจาก completion snapshot. download ปัจจุบันเป็น mock text ไม่ใช่ PDF contract ที่พร้อมจริง.

| Method | Endpoint | หน้าที่ |
| --- | --- | --- |
| `GET` | `/me/certificates` | รายการใบรับรอง |
| `GET` | `/me/certificates/{id}` | รายละเอียดใบรับรอง |
| `GET` | `/me/certificates/{id}/download` | ดาวน์โหลดใบรับรอง (mock text) |

#### GET /me/certificates

รายการใบรับรอง

สิทธิ์: `certificate.read_self`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [CertificatePage](#schema-certificatepage).

ตัวอย่าง JSON:

```json
{
  "items": [],
  "next_cursor": null
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /me/certificates/{id}

รายละเอียดใบรับรอง

สิทธิ์: `certificate.read_self`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [WireServerCertificate](#schema-wireservercertificate).

ตัวอย่าง JSON:

```json
{
  "id": "cert_0001",
  "code": "MLN-0001",
  "course_id": "crs_0001",
  "course_title": "Contract sample course",
  "learner_name": "ผู้เรียนตัวอย่าง",
  "issued_at": "2026-10-08T09:00:00Z",
  "enrollment_id": "enr_0001"
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 404 | `not_found` | ไม่พบข้อมูลที่ขอ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /me/certificates/{id}/download

ดาวน์โหลดใบรับรอง (mock text)

สิทธิ์: `certificate.read_self`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Current text JSON is mock compatibility only; real downloadable format/storage/signing pending. Do not freeze as a PDF service.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [CertificateDownload](#schema-certificatedownload).

ตัวอย่าง JSON:

```json
{
  "filename": "MLN-0001.txt",
  "content_type": "text/plain",
  "content": "ใบรับรอง MLN-0001\nชื่อผู้เรียน: ผู้เรียนตัวอย่าง\nคอร์ส: พื้นฐานการออกแบบคอร์สออนไลน์ (ตัวอย่าง)\nวันที่ออก: 2026-10-08T09:00:00Z"
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

<a id="feature-authoring"></a>

### สร้างและแก้คอร์ส / บท / Quiz / Preview

Instructor เจ้าของคอร์สหรือ Admin แก้คอร์สได้; submit-review เฉพาะ Instructor เจ้าของ. วิดีโอใช้ YouTube; upload video ยังไม่พร้อม.

| Method | Endpoint | หน้าที่ |
| --- | --- | --- |
| `GET` | `/admin/courses` | สร้าง/รายการคอร์ส Admin |
| `POST` | `/admin/courses` | สร้าง/รายการคอร์ส Admin |
| `PATCH` | `/courses/{id}` | รายละเอียด public / แก้โครงสร้างและเนื้อหาคอร์ส |
| `GET` | `/courses/{id}/authoring` | อ่านข้อมูล editor รวม quiz/เฉลยสำหรับผู้มีสิทธิ์ |
| `GET` | `/courses/{id}/authoring-preview` | ตัวอย่างคอร์สสำหรับผู้จัดการ |
| `POST` | `/courses/{id}/submit-review` | เจ้าของ Instructor ส่งคอร์สตรวจ |
| `POST` | `/courses/{id}/videos/uploads` | Upload Video: ยังไม่พร้อม |
| `GET` | `/instructor/courses` | สร้าง/รายการคอร์สผู้สอน |
| `POST` | `/instructor/courses` | สร้าง/รายการคอร์สผู้สอน |

#### GET /admin/courses

สร้าง/รายการคอร์ส Admin

สิทธิ์: `course.update: admin scope`. Session: AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `status` | query | string | optional | enum: ["draft","pending_review","approved","published","archived"] |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [ManagedCoursePage](#schema-managedcoursepage).

ตัวอย่าง JSON:

```json
{
  "items": [
    {
      "id": "crs_mock_003",
      "slug": "mock-data-storytelling",
      "title": "เล่าเรื่องด้วยข้อมูล (ตัวอย่าง)",
      "subtitle": "จากตารางสู่ข้อสรุป",
      "description": "คอร์สตัวอย่างราคาสูงกว่าเพื่อทดสอบการกรองและเรียงลำดับ",
      "cover_url": null,
      "category": "การสื่อสาร",
      "level": "ขั้นสูง",
      "price": {
        "amount_minor": 249000,
        "currency": "THB"
      },
      "outcomes": [],
      "instructor": {
        "id": "usr_instructor_a",
        "display_name": "ผู้สอนตัวอย่าง ก",
        "avatar_url": null
      },
      "chapters": [],
      "status": "published",
      "revision": 1,
      "published_at": "2026-10-05T03:00:00Z",
      "published_by": null,
      "created_by": "usr_instructor_a",
      "created_at": "2026-09-01T00:00:00Z",
      "updated_at": "2026-10-05T03:00:00Z",
      "enrollment_count": 0,
      "latest_review": null,
      "ai_enabled": false
    },
    {
      "id": "crs_mock_002",
      "slug": "mock-presentation-skills",
      "title": "ทักษะการนำเสนอ (ตัวอย่าง)",
      "subtitle": null,
      "description": null,
      "cover_url": null,
      "category": "การสื่อสาร",
      "level": "กลาง",
      "price": {
        "amount_minor": 99000,
        "currency": "THB"
      },
      "outcomes": [
        "เล่าเรื่องให้ชัดเจน"
      ],
      "instructor": {
        "id": "usr_instructor_b",
        "display_name": "ผู้สอนตัวอย่าง ข",
        "avatar_url": null
      },
      "chapters": [
        {
          "id": "chp_mock_002_1",
          "title": "โครงเรื่อง",
          "items": [
            {
              "id": "itm_mock_002_1",
              "title": "เปิดเรื่อง",
              "type": "video",
              "has_history": false
            }
          ]
        },
        {
          "id": "chp_mock_002_2",
          "title": "บทว่าง (ยังไม่มีเนื้อหา)",
          "items": []
        }
      ],
      "status": "published",
      "revision": 1,
      "published_at": "2026-10-01T03:00:00Z",
      "published_by": null,
      "created_by": "usr_instructor_b",
      "created_at": "2026-09-01T00:00:00Z",
      "updated_at": "2026-10-01T03:00:00Z",
      "enrollment_count": 0,
      "latest_review": null,
      "ai_enabled": false
    },
    {
      "id": "crs_mock_001",
      "slug": "mock-online-course-basics",
      "title": "พื้นฐานการออกแบบคอร์สออนไลน์ (ตัวอย่าง)",
      "subtitle": "วางโครงคอร์สให้ผู้เรียนเรียนต่อเนื่อง",
      "description": "คำอธิบายตัวอย่างสำหรับทดสอบหน้ารายละเอียดคอร์ส",
      "cover_url": null,
      "category": "การสอนออนไลน์",
      "level": "เริ่มต้น",
      "price": null,
      "outcomes": [
        "วางโครงบทเรียนได้",
        "เลือกรูปแบบเนื้อหาให้เหมาะกับผู้เรียน"
      ],
      "instructor": {
        "id": "usr_instructor_a",
        "display_name": "ผู้สอนตัวอย่าง ก",
        "avatar_url": null
      },
      "chapters": [
        {
          "id": "chp_mock_001_1",
          "title": "เริ่มต้นออกแบบ",
          "items": [
            {
              "id": "itm_mock_001_1",
              "title": "ภาพรวมคอร์ส",
              "type": "video",
              "has_history": false
            },
            {
              "id": "itm_mock_001_2",
              "title": "เช็กลิสต์ก่อนสร้างคอร์ส",
              "type": "article",
              "has_history": false
            },
            {
              "id": "itm_mock_001_3",
              "title": "ทบทวนบทที่ 1",
              "type": "quiz",
              "has_history": false,
              "quiz": {
                "question_count": 3,
                "pass_percent": 70,
                "attempt_count": 0
              }
            }
          ]
        }
      ],
      "status": "published",
      "revision": 1,
      "published_at": "2026-09-20T03:00:00Z",
      "published_by": null,
      "created_by": "usr_instructor_a",
      "created_at": "2026-09-01T00:00:00Z",
      "updated_at": "2026-09-20T03:00:00Z",
      "enrollment_count": 0,
      "latest_review": null,
      "ai_enabled": false
    },
    {
      "id": "crs_mock_approved",
      "slug": "mock-secret-approved",
      "title": "SECRET approved but unpublished course title",
      "subtitle": null,
      "description": null,
      "cover_url": null,
      "category": "SECRET category",
      "level": "SECRET level",
      "price": {
        "amount_minor": 10000,
        "currency": "THB"
      },
      "outcomes": [],
      "instructor": {
        "id": "usr_instructor_b",
        "display_name": "ผู้สอนตัวอย่าง ข",
        "avatar_url": null
      },
      "chapters": [],
      "status": "approved",
      "revision": 1,
      "published_at": null,
      "published_by": null,
      "created_by": "usr_instructor_b",
      "created_at": "2026-09-01T00:00:00Z",
      "updated_at": "2026-09-01T00:00:00Z",
      "enrollment_count": 0,
      "latest_review": null,
      "ai_enabled": false
    },
    {
      "id": "crs_mock_draft",
      "slug": "mock-secret-draft",
      "title": "SECRET draft course title",
      "subtitle": "SECRET draft subtitle",
      "description": "SECRET draft description",
      "cover_url": null,
      "category": "SECRET category",
      "level": "SECRET level",
      "price": null,
      "outcomes": [
        "SECRET outcome"
      ],
      "instructor": {
        "id": "usr_instructor_a",
        "display_name": "ผู้สอนตัวอย่าง ก",
        "avatar_url": null
      },
      "chapters": [
        {
          "id": "chp_mock_draft_1",
          "title": "SECRET chapter",
          "items": [
            {
              "id": "itm_mock_draft_1",
              "title": "SECRET item",
              "type": "article",
              "has_history": false
            }
          ]
        }
      ],
      "status": "draft",
      "revision": 1,
      "published_at": null,
      "published_by": null,
      "created_by": "usr_instructor_a",
      "created_at": "2026-09-01T00:00:00Z",
      "updated_at": "2026-09-01T00:00:00Z",
      "enrollment_count": 0,
      "latest_review": null,
      "ai_enabled": false
    },
    {
      "id": "crs_mock_pending",
      "slug": "mock-secret-pending",
      "title": "SECRET pending review course title",
      "subtitle": null,
      "description": null,
      "cover_url": null,
      "category": "SECRET category",
      "level": "SECRET level",
      "price": null,
      "outcomes": [],
      "instructor": {
        "id": "usr_instructor_b",
        "display_name": "ผู้สอนตัวอย่าง ข",
        "avatar_url": null
      },
      "chapters": [
        {
          "id": "chp_mock_pending_1",
          "title": "SECRET pending chapter",
          "items": [
            {
              "id": "itm_mock_pending_1",
              "title": "SECRET pending item",
              "type": "article",
              "has_history": false
            }
          ]
        }
      ],
      "status": "pending_review",
      "revision": 1,
      "published_at": null,
      "published_by": null,
      "created_by": "usr_instructor_b",
      "created_at": "2026-09-01T00:00:00Z",
      "updated_at": "2026-09-01T00:00:00Z",
      "enrollment_count": 0,
      "latest_review": null,
      "ai_enabled": false
    }
  ],
  "next_cursor": null
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### POST /admin/courses

สร้าง/รายการคอร์ส Admin

สิทธิ์: `course.create: admin`. Session: AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

**Request body:** required, `application/json`, schema [AdminCourseCreateRequest](#schema-admincoursecreaterequest).

ตัวอย่าง JSON:

```json
{
  "instructor_id": "usr_instructor_b",
  "title": "แทนผู้สอน",
  "category": "หมวด",
  "level": "เริ่มต้น"
}
```

**Response 201:** `application/json`, schema [AuthoringCourseDto](#schema-authoringcoursedto).

ตัวอย่าง JSON:

```json
{
  "id": "crs_0001",
  "slug": "course-crs_0001",
  "title": "แทนผู้สอน",
  "subtitle": null,
  "description": null,
  "cover_url": null,
  "category": "หมวด",
  "level": "เริ่มต้น",
  "price": null,
  "outcomes": [],
  "instructor": {
    "id": "usr_instructor_b",
    "display_name": "ผู้สอนตัวอย่าง ข",
    "avatar_url": null
  },
  "chapters": [],
  "status": "draft",
  "revision": 1,
  "published_at": null,
  "published_by": null,
  "created_by": "usr_admin",
  "created_at": "2026-10-08T09:00:00Z",
  "updated_at": "2026-10-08T09:00:00Z",
  "enrollment_count": 0,
  "latest_review": null,
  "ai_enabled": false
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 422 | `validation_failed` | ข้อมูลที่ส่งไม่ถูกต้อง |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### PATCH /courses/{id}

รายละเอียด public / แก้โครงสร้างและเนื้อหาคอร์ส

สิทธิ์: `course.update: owner Instructor or Admin`. Session: WebSession หรือ AdminSession. สถานะ: draft.

expected_revision and atomic update. Chapters replace curriculum; keep retained server IDs/order/history. Existing history prohibits destructive changes. Approved/pending edit returns draft/stale; published edit immediate. AI/transcript fields forbidden; Admin alone may change instructor_id.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** required, `application/json`, schema [CoursePatchRequest](#schema-coursepatchrequest).

ตัวอย่าง JSON:

```json
{
  "expected_revision": 1,
  "title": "ฉบับใหม่"
}
```

**Response 200:** `application/json`, schema [AuthoringCourseDto](#schema-authoringcoursedto).

ตัวอย่าง JSON:

```json
{
  "id": "crs_0001",
  "slug": "course-crs_0001",
  "title": "Prices",
  "subtitle": null,
  "description": null,
  "cover_url": null,
  "category": "",
  "level": "",
  "price": null,
  "outcomes": [],
  "instructor": {
    "id": "usr_instructor_a",
    "display_name": "ผู้สอนตัวอย่าง ก",
    "avatar_url": null
  },
  "chapters": [],
  "status": "draft",
  "revision": 3,
  "published_at": null,
  "published_by": null,
  "created_by": "usr_instructor_a",
  "created_at": "2026-10-08T09:00:00Z",
  "updated_at": "2026-10-08T09:00:00Z",
  "enrollment_count": 0,
  "latest_review": null,
  "ai_enabled": false
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 404 | `not_found` | ไม่พบข้อมูลที่ขอ |
| 409 | `learning_history_conflict` | แบบฝึกหัดมีประวัติคำตอบแล้ว |
| 422 | `validation_failed` | ข้อมูลที่ส่งไม่ถูกต้อง |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

วิดีโอใน chapters/items ส่ง `video_url` เป็น YouTube URL canonical. UI แปลง short/Shorts เป็น watch URL ก่อนบันทึก. แก้ content เป็นชุด atomic และต้องรักษา ID/revision/history rules; เฉลยไม่ส่งออก public/learner projection.

#### GET /courses/{id}/authoring

อ่านข้อมูล editor รวม quiz/เฉลยสำหรับผู้มีสิทธิ์

สิทธิ์: `course.update: owner Instructor or Admin`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Authoring answer keys allowed only for authorized manager; do not reuse this response on public/learner routes.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [AuthoringCourseDto](#schema-authoringcoursedto).

ตัวอย่าง JSON:

```json
{
  "id": "crs_0001",
  "slug": "course-crs_0001",
  "title": "ของฉัน",
  "subtitle": null,
  "description": null,
  "cover_url": null,
  "category": "",
  "level": "",
  "price": null,
  "outcomes": [],
  "instructor": {
    "id": "usr_instructor_a",
    "display_name": "ผู้สอนตัวอย่าง ก",
    "avatar_url": null
  },
  "chapters": [],
  "status": "draft",
  "revision": 1,
  "published_at": null,
  "published_by": null,
  "created_by": "usr_instructor_a",
  "created_at": "2026-10-08T09:00:00Z",
  "updated_at": "2026-10-08T09:00:00Z",
  "enrollment_count": 0,
  "latest_review": null,
  "ai_enabled": false
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 404 | `not_found` | ไม่พบข้อมูลที่ขอ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /courses/{id}/authoring-preview

ตัวอย่างคอร์สสำหรับผู้จัดการ

สิทธิ์: `course.preview`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Owner Instructor/Admin only; no answer keys, raw transcript, enrollment or progress effects.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [AuthoringPreview](#schema-authoringpreview).

ตัวอย่าง JSON:

```json
{
  "id": "crs_0001",
  "title": "คอร์สทดสอบ",
  "revision": 2,
  "chapters": [
    {
      "id": "chp_0001",
      "title": "บทแรก",
      "items": [
        {
          "id": "itm_0001",
          "type": "video",
          "title": "วิดีโอ",
          "has_history": false,
          "description": "",
          "duration": "",
          "reading_minutes": 2,
          "video_url": "https://youtu.be/ABCDEFGHIJK"
        },
        {
          "id": "itm_0002",
          "type": "article",
          "title": "บทอ่าน",
          "has_history": false,
          "description": "",
          "duration": "",
          "reading_minutes": 2,
          "body": "เนื้อหา",
          "body_doc": null
        }
      ]
    }
  ]
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### POST /courses/{id}/submit-review

เจ้าของ Instructor ส่งคอร์สตรวจ

สิทธิ์: `course.submit_review: owner Instructor`. Session: WebSession. สถานะ: draft.

Only the owner Instructor can submit a draft at the current revision. Admin cannot submit on behalf of the Instructor.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** required, `application/json`, schema [CourseReviewRequest](#schema-coursereviewrequest).

ตัวอย่าง JSON:

```json
{
  "expected_revision": 2
}
```

**Response 201:** `application/json`, schema [CourseReviewDto](#schema-coursereviewdto).

ตัวอย่าง JSON:

```json
{
  "id": "rev_0001",
  "revision": 2,
  "status": "pending",
  "submitted_by": "usr_instructor_a",
  "submitted_at": "2026-10-08T09:00:00Z",
  "decided_by": null,
  "decided_at": null,
  "reason": null
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 401 | `unauthenticated` | กรุณาเข้าสู่ระบบ |
| 403 | `forbidden` | ไม่มีสิทธิ์ใช้งานส่วนนี้ |
| 404 | `not_found` | ไม่พบข้อมูลที่ขอ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### POST /courses/{id}/videos/uploads

Upload Video: ยังไม่พร้อม

สิทธิ์: `course.update`. Session: WebSession หรือ AdminSession. สถานะ: draft.

V1 unavailable:503 video_upload_not_available; no file or upload record.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Success response:** ไม่มีใน V1 สำหรับ operation นี้; video upload ตอบ 503 และไม่รับไฟล์/สร้าง upload record.

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 503 | `video_upload_not_available` | ขออภัย ระบบนี้ยังไม่พร้อมใช้งาน |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /instructor/courses

สร้าง/รายการคอร์สผู้สอน

สิทธิ์: `course.update: instructor scope`. Session: WebSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `status` | query | string | optional | enum: ["draft","pending_review","approved","published","archived"] |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [ManagedCoursePage](#schema-managedcoursepage).

ตัวอย่าง JSON:

```json
{
  "items": [
    {
      "id": "crs_mock_003",
      "slug": "mock-data-storytelling",
      "title": "เล่าเรื่องด้วยข้อมูล (ตัวอย่าง)",
      "subtitle": "จากตารางสู่ข้อสรุป",
      "description": "คอร์สตัวอย่างราคาสูงกว่าเพื่อทดสอบการกรองและเรียงลำดับ",
      "cover_url": null,
      "category": "การสื่อสาร",
      "level": "ขั้นสูง",
      "price": {
        "amount_minor": 249000,
        "currency": "THB"
      },
      "outcomes": [],
      "instructor": {
        "id": "usr_instructor_a",
        "display_name": "ผู้สอนตัวอย่าง ก",
        "avatar_url": null
      },
      "chapters": [],
      "status": "published",
      "revision": 1,
      "published_at": "2026-10-05T03:00:00Z",
      "published_by": null,
      "created_by": "usr_instructor_a",
      "created_at": "2026-09-01T00:00:00Z",
      "updated_at": "2026-10-05T03:00:00Z",
      "enrollment_count": 0,
      "latest_review": null,
      "ai_enabled": false
    },
    {
      "id": "crs_mock_001",
      "slug": "mock-online-course-basics",
      "title": "พื้นฐานการออกแบบคอร์สออนไลน์ (ตัวอย่าง)",
      "subtitle": "วางโครงคอร์สให้ผู้เรียนเรียนต่อเนื่อง",
      "description": "คำอธิบายตัวอย่างสำหรับทดสอบหน้ารายละเอียดคอร์ส",
      "cover_url": null,
      "category": "การสอนออนไลน์",
      "level": "เริ่มต้น",
      "price": null,
      "outcomes": [
        "วางโครงบทเรียนได้",
        "เลือกรูปแบบเนื้อหาให้เหมาะกับผู้เรียน"
      ],
      "instructor": {
        "id": "usr_instructor_a",
        "display_name": "ผู้สอนตัวอย่าง ก",
        "avatar_url": null
      },
      "chapters": [
        {
          "id": "chp_mock_001_1",
          "title": "เริ่มต้นออกแบบ",
          "items": [
            {
              "id": "itm_mock_001_1",
              "title": "ภาพรวมคอร์ส",
              "type": "video",
              "has_history": false
            },
            {
              "id": "itm_mock_001_2",
              "title": "เช็กลิสต์ก่อนสร้างคอร์ส",
              "type": "article",
              "has_history": false
            },
            {
              "id": "itm_mock_001_3",
              "title": "ทบทวนบทที่ 1",
              "type": "quiz",
              "has_history": false,
              "quiz": {
                "question_count": 3,
                "pass_percent": 70,
                "attempt_count": 0
              }
            }
          ]
        }
      ],
      "status": "published",
      "revision": 1,
      "published_at": "2026-09-20T03:00:00Z",
      "published_by": null,
      "created_by": "usr_instructor_a",
      "created_at": "2026-09-01T00:00:00Z",
      "updated_at": "2026-09-20T03:00:00Z",
      "enrollment_count": 0,
      "latest_review": null,
      "ai_enabled": false
    },
    {
      "id": "crs_mock_draft",
      "slug": "mock-secret-draft",
      "title": "SECRET draft course title",
      "subtitle": "SECRET draft subtitle",
      "description": "SECRET draft description",
      "cover_url": null,
      "category": "SECRET category",
      "level": "SECRET level",
      "price": null,
      "outcomes": [
        "SECRET outcome"
      ],
      "instructor": {
        "id": "usr_instructor_a",
        "display_name": "ผู้สอนตัวอย่าง ก",
        "avatar_url": null
      },
      "chapters": [
        {
          "id": "chp_mock_draft_1",
          "title": "SECRET chapter",
          "items": [
            {
              "id": "itm_mock_draft_1",
              "title": "SECRET item",
              "type": "article",
              "has_history": false
            }
          ]
        }
      ],
      "status": "draft",
      "revision": 1,
      "published_at": null,
      "published_by": null,
      "created_by": "usr_instructor_a",
      "created_at": "2026-09-01T00:00:00Z",
      "updated_at": "2026-09-01T00:00:00Z",
      "enrollment_count": 0,
      "latest_review": null,
      "ai_enabled": false
    }
  ],
  "next_cursor": null
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### POST /instructor/courses

สร้าง/รายการคอร์สผู้สอน

สิทธิ์: `course.create: instructor`. Session: WebSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

**Request body:** required, `application/json`, schema [CourseMetadataRequest](#schema-coursemetadatarequest).

ตัวอย่าง JSON:

```json
{
  "title": "ของฉัน"
}
```

**Response 201:** `application/json`, schema [AuthoringCourseDto](#schema-authoringcoursedto).

ตัวอย่าง JSON:

```json
{
  "id": "crs_0001",
  "slug": "course-crs_0001",
  "title": "ของฉัน",
  "subtitle": null,
  "description": null,
  "cover_url": null,
  "category": "",
  "level": "",
  "price": null,
  "outcomes": [],
  "instructor": {
    "id": "usr_instructor_a",
    "display_name": "ผู้สอนตัวอย่าง ก",
    "avatar_url": null
  },
  "chapters": [],
  "status": "draft",
  "revision": 1,
  "published_at": null,
  "published_by": null,
  "created_by": "usr_instructor_a",
  "created_at": "2026-10-08T09:00:00Z",
  "updated_at": "2026-10-08T09:00:00Z",
  "enrollment_count": 0,
  "latest_review": null,
  "ai_enabled": false
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 422 | `validation_failed` | ข้อมูลที่ส่งไม่ถูกต้อง |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

<a id="feature-approval"></a>

### คิวตรวจคอร์ส / อนุมัติ / ส่งกลับ / Publish

Admin ตรวจอนุมัติ/ส่งกลับ; publish ตรวจ review และ current revision ที่ server. กลยุทธ์ expected_revision ของ return/publish ยังรอตกลง.

| Method | Endpoint | หน้าที่ |
| --- | --- | --- |
| `GET` | `/admin/course-reviews` | คิวตรวจคอร์ส |
| `GET` | `/admin/course-reviews/{id}` | รายละเอียด review |
| `POST` | `/admin/course-reviews/{id}/approve` | อนุมัติ review |
| `POST` | `/admin/course-reviews/{id}/return` | ส่งกลับพร้อมเหตุผล |
| `POST` | `/courses/{id}/publish` | เผยแพร่คอร์ส |

#### GET /admin/course-reviews

คิวตรวจคอร์ส

สิทธิ์: `course.review`. Session: AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `status` | query | string | optional | enum: ["pending","approved","returned","stale"] |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [ReviewPage](#schema-reviewpage).

ตัวอย่าง JSON:

```json
{
  "items": [
    {
      "id": "rev_0001",
      "revision": 2,
      "status": "pending",
      "submitted_by": "usr_instructor_a",
      "submitted_at": "2026-10-08T09:00:00Z",
      "decided_by": null,
      "decided_at": null,
      "reason": null,
      "course": {
        "id": "crs_0001",
        "slug": "course-crs_0001",
        "title": "Contract sample course",
        "subtitle": null,
        "description": null,
        "cover_url": null,
        "category": "General",
        "level": "beginner",
        "price": null,
        "outcomes": [],
        "instructor": {
          "id": "usr_instructor_a",
          "display_name": "ผู้สอนตัวอย่าง ก",
          "avatar_url": null
        },
        "chapters": [
          {
            "id": "chp_0001",
            "title": "Sample chapter",
            "items": [
              {
                "id": "itm_0001",
                "title": "Sample article",
                "type": "article",
                "has_history": false
              }
            ]
          }
        ],
        "status": "pending_review",
        "revision": 2,
        "published_at": null,
        "published_by": null,
        "created_by": "usr_instructor_a",
        "created_at": "2026-10-08T09:00:00Z",
        "updated_at": "2026-10-08T09:00:00Z",
        "enrollment_count": 0,
        "latest_review": {
          "id": "rev_0001",
          "revision": 2,
          "status": "pending",
          "submitted_by": "usr_instructor_a",
          "submitted_at": "2026-10-08T09:00:00Z",
          "decided_by": null,
          "decided_at": null,
          "reason": null
        },
        "ai_enabled": false
      }
    }
  ],
  "next_cursor": null
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /admin/course-reviews/{id}

รายละเอียด review

สิทธิ์: `course.review`. Session: AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [ReviewDetail](#schema-reviewdetail).

ตัวอย่าง JSON:

```json
{
  "id": "rev_0001",
  "revision": 2,
  "status": "pending",
  "submitted_by": "usr_instructor_a",
  "submitted_at": "2026-10-08T09:00:00Z",
  "decided_by": null,
  "decided_at": null,
  "reason": null,
  "course": {
    "id": "crs_0001",
    "slug": "course-crs_0001",
    "title": "Contract sample course",
    "subtitle": null,
    "description": null,
    "cover_url": null,
    "category": "General",
    "level": "beginner",
    "price": null,
    "outcomes": [],
    "instructor": {
      "id": "usr_instructor_a",
      "display_name": "ผู้สอนตัวอย่าง ก",
      "avatar_url": null
    },
    "chapters": [
      {
        "id": "chp_0001",
        "title": "Sample chapter",
        "description": "",
        "items": [
          {
            "id": "itm_0001",
            "type": "article",
            "title": "Sample article",
            "has_history": false,
            "description": "",
            "duration": "",
            "reading_minutes": 2,
            "body": "Lesson body",
            "body_doc": null
          }
        ]
      }
    ],
    "status": "pending_review",
    "revision": 2,
    "published_at": null,
    "published_by": null,
    "created_by": "usr_instructor_a",
    "created_at": "2026-10-08T09:00:00Z",
    "updated_at": "2026-10-08T09:00:00Z",
    "enrollment_count": 0,
    "latest_review": {
      "id": "rev_0001",
      "revision": 2,
      "status": "pending",
      "submitted_by": "usr_instructor_a",
      "submitted_at": "2026-10-08T09:00:00Z",
      "decided_by": null,
      "decided_at": null,
      "reason": null
    },
    "ai_enabled": false
  }
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### POST /admin/course-reviews/{id}/approve

อนุมัติ review

สิทธิ์: `course.review`. Session: AdminSession. สถานะ: draft.

Only pending review of exact current revision; stale409 revision_conflict.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** required, `application/json`, schema [CourseReviewRequest](#schema-coursereviewrequest).

ตัวอย่าง JSON:

```json
{
  "expected_revision": 3
}
```

**Response 200:** `application/json`, schema [CourseReviewDto](#schema-coursereviewdto).

ตัวอย่าง JSON:

```json
{
  "id": "rev_0003",
  "revision": 3,
  "status": "approved",
  "submitted_by": "usr_instructor_a",
  "submitted_at": "2026-10-08T09:00:00Z",
  "decided_by": "usr_admin",
  "decided_at": "2026-10-08T09:00:00Z",
  "reason": null
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 403 | `forbidden` | ไม่มีสิทธิ์ใช้งานส่วนนี้ |
| 409 | `revision_conflict` | ข้อมูลมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลล่าสุดแล้วตรวจอีกครั้ง |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### POST /admin/course-reviews/{id}/return

ส่งกลับพร้อมเหตุผล

สิทธิ์: `course.review`. Session: AdminSession. สถานะ: draft.

Pending review + nonempty reason. Current mock does not require expected_revision on return; stale-return guard is an open Backend contract decision.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** required, `application/json`, schema [CourseReturnRequest](#schema-coursereturnrequest).

ตัวอย่าง JSON:

```json
{
  "reason": "ขอปรับคำอธิบาย"
}
```

**Response 200:** `application/json`, schema [CourseReviewDto](#schema-coursereviewdto).

ตัวอย่าง JSON:

```json
{
  "id": "rev_0002",
  "revision": 3,
  "status": "returned",
  "submitted_by": "usr_instructor_a",
  "submitted_at": "2026-10-08T09:00:00Z",
  "decided_by": "usr_admin",
  "decided_at": "2026-10-08T09:00:00Z",
  "reason": "ขอปรับคำอธิบาย"
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### POST /courses/{id}/publish

เผยแพร่คอร์ส

สิทธิ์: `course.publish: owner Instructor or Admin`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Require current-revision Admin approval before first publish; repeated published command harmless.
Current wire request is an empty object. Publication checks an approved review matching the current course revision server-side. An explicit client revision precondition is a pending Backend decision.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** required, `application/json`, schema [EmptyRequest](#schema-emptyrequest).

ตัวอย่าง JSON:

```json
{}
```

**Response 200:** `application/json`, schema [AuthoringCourseDto](#schema-authoringcoursedto).

ตัวอย่าง JSON:

```json
{
  "id": "crs_0001",
  "slug": "course-crs_0001",
  "title": "Contract sample course",
  "subtitle": null,
  "description": null,
  "cover_url": null,
  "category": "General",
  "level": "beginner",
  "price": null,
  "outcomes": [],
  "instructor": {
    "id": "usr_instructor_a",
    "display_name": "ผู้สอนตัวอย่าง ก",
    "avatar_url": null
  },
  "chapters": [
    {
      "id": "chp_0001",
      "title": "Sample chapter",
      "description": "",
      "items": [
        {
          "id": "itm_0001",
          "type": "article",
          "title": "Sample article",
          "has_history": false,
          "description": "",
          "duration": "",
          "reading_minutes": 2,
          "body": "Lesson body",
          "body_doc": null
        }
      ]
    }
  ],
  "status": "published",
  "revision": 2,
  "published_at": "2026-10-08T09:00:00Z",
  "published_by": "usr_instructor_a",
  "created_by": "usr_instructor_a",
  "created_at": "2026-10-08T09:00:00Z",
  "updated_at": "2026-10-08T09:00:00Z",
  "enrollment_count": 0,
  "latest_review": {
    "id": "rev_0001",
    "revision": 2,
    "status": "approved",
    "submitted_by": "usr_instructor_a",
    "submitted_at": "2026-10-08T09:00:00Z",
    "decided_by": "usr_admin",
    "decided_at": "2026-10-08T09:00:00Z",
    "reason": null
  },
  "ai_enabled": false
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 404 | `not_found` | ไม่พบข้อมูลที่ขอ |
| 409 | `invalid_state` | สถานะคอร์สไม่รองรับคำสั่งนี้ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

<a id="feature-payment"></a>

### Stripe Checkout / สถานะจ่ายเงิน

ให้สิทธิ์จาก webhook ที่ server ตรวจแล้วเท่านั้น; ห้ามให้สิทธิ์จากหน้า success หรือ GET payment. ไม่มี cart/orders/finance dashboard.

| Method | Endpoint | หน้าที่ |
| --- | --- | --- |
| `GET` | `/admin/payments/{id}` | Admin ตรวจ payment รายกรณี |
| `POST` | `/me/payments/checkout` | เริ่ม Stripe Checkout / คืน entitlement เดิม |
| `GET` | `/me/payments/{id}` | ติดตามสถานะ payment ตนเอง |

#### GET /admin/payments/{id}

Admin ตรวจ payment รายกรณี

สิทธิ์: `payment.read_admin: individual abnormal-payment lookup only`. Session: AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [WireAdminPayment](#schema-wireadminpayment).

ตัวอย่าง JSON:

```json
{
  "payment_id": "pay_0001",
  "course_id": "crs_mock_002",
  "status": "succeeded",
  "fulfillment_status": "granted",
  "enrollment": {
    "id": "enr_0001",
    "course_id": "crs_mock_002",
    "source": "stripe",
    "access": "lifetime",
    "granted_at": "2026-10-08T09:00:00Z"
  },
  "amount": {
    "amount_minor": 99000,
    "currency": "THB"
  },
  "user_id": "usr_learner",
  "request_id": "dev-simulator",
  "checkout_session_id": "cs_0001",
  "created_at": "2026-10-08T09:00:00Z",
  "events": [
    {
      "event_id": "evt_mock_1",
      "type": "checkout.session.completed",
      "received_at": "2026-10-08T09:00:00Z",
      "processed_at": "2026-10-08T09:00:00Z",
      "outcome": "fulfilled"
    }
  ]
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### POST /me/payments/checkout

เริ่ม Stripe Checkout / คืน entitlement เดิม

สิทธิ์: `payment.checkout_self`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Server owns price; reject Admin/own course/unverified self account. request_id deduplicates. No grant from checkout/success URL; verified Stripe webhook only. Already-enrolled response is current mock compatibility pending Backend review.

**Request body:** required, `application/json`, schema [CheckoutRequest](#schema-checkoutrequest).

ตัวอย่าง JSON:

```json
{
  "course_id": "crs_mock_002",
  "request_id": "r-1"
}
```

**Response 200:** `application/json`, schema [CheckoutResponse](#schema-checkoutresponse).

ตัวอย่าง JSON:

```json
{
  "payment_id": "pay_0001",
  "checkout_url": "https://checkout.stripe.invalid/session/cs_0001",
  "already_enrolled": false
}
```

**Response 201:** `application/json`, schema [CheckoutResponse](#schema-checkoutresponse).

ตัวอย่าง JSON:

```json
{
  "payment_id": "pay_0001",
  "checkout_url": "https://checkout.stripe.invalid/session/cs_0001",
  "already_enrolled": false
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 409 | `invalid_state` | คอร์สนี้เป็นคอร์สฟรี |
| 422 | `validation_failed` | ข้อมูลที่ส่งไม่ถูกต้อง |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

**ต้องรองรับทั้งสอง branch:** `already_enrolled: false` คืน payment/checkout URL; `already_enrolled: true` คืน `course_id` และ full `enrollment`. ตัวอย่างข้างบนเป็นเพียงหนึ่ง branch; request_id ยาว 1–64 ตาม Draft. ไม่สร้างสิทธิ์จาก client.

#### GET /me/payments/{id}

ติดตามสถานะ payment ตนเอง

สิทธิ์: `payment.read_self`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [WirePaymentView](#schema-wirepaymentview).

ตัวอย่าง JSON:

```json
{
  "payment_id": "pay_0001",
  "course_id": "crs_mock_002",
  "status": "pending",
  "fulfillment_status": "pending",
  "enrollment": null
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

<a id="feature-redeem"></a>

### รหัสแลกคอร์ส

หนึ่ง code ต่อหนึ่ง course ใช้ครั้งเดียว ไม่มีวันหมดอายุ; revoke เฉพาะยังไม่ใช้; ไม่ใช่คูปองส่วนลดและไม่สร้าง Order.

| Method | Endpoint | หน้าที่ |
| --- | --- | --- |
| `GET` | `/admin/redeem-codes` | สร้าง/รายการรหัสแลกคอร์ส |
| `POST` | `/admin/redeem-codes` | สร้าง/รายการรหัสแลกคอร์ส |
| `POST` | `/admin/redeem-codes/{id}/revoke` | ยกเลิกรหัสที่ยังไม่ใช้ |
| `POST` | `/me/redeem` | แลกรหัสรับสิทธิ์เรียน |

#### GET /admin/redeem-codes

สร้าง/รายการรหัสแลกคอร์ส

สิทธิ์: `redeem_code.read`. Session: AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `course_id` | query | string | optional | minLength: 1 |
| `status` | query | string | optional | enum: ["unused","used","revoked"] |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [RedeemCodePage](#schema-redeemcodepage).

ตัวอย่าง JSON:

```json
{
  "items": [
    {
      "id": "rdm_seed_revoked",
      "code_masked": "MOCK-****-0001",
      "course_id": "crs_mock_002",
      "status": "revoked",
      "created_at": "2026-09-01T00:00:00Z",
      "used_by": null,
      "used_at": null,
      "revoked_at": "2026-09-02T00:00:00Z"
    },
    {
      "id": "rdm_seed_unused",
      "code_masked": "MOCK-****-0001",
      "course_id": "crs_mock_002",
      "status": "used",
      "created_at": "2026-09-01T00:00:00Z",
      "used_by": "usr_learner",
      "used_at": "2026-10-08T09:00:00Z",
      "revoked_at": null
    }
  ],
  "next_cursor": null
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### POST /admin/redeem-codes

สร้าง/รายการรหัสแลกคอร์ส

สิทธิ์: `redeem_code.create`. Session: AdminSession. สถานะ: draft.

Paid published course only. Full codes returned only on issue; list masks. Count1..50 is Draft limit.

**Request body:** required, `application/json`, schema [IssueCodesRequest](#schema-issuecodesrequest).

ตัวอย่าง JSON:

```json
{
  "course_id": "crs_mock_002",
  "count": 1
}
```

**Response 201:** `application/json`, schema [IssuedCodesResponse](#schema-issuedcodesresponse).

ตัวอย่าง JSON:

```json
{
  "items": [
    {
      "id": "rdm_0001",
      "code": "MLN-0001-7919",
      "course_id": "crs_mock_002",
      "status": "unused",
      "created_at": "2026-10-08T09:00:00Z"
    }
  ]
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 409 | `invalid_state` | คอร์สฟรีไม่สามารถออกโค้ดขายได้ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### POST /admin/redeem-codes/{id}/revoke

ยกเลิกรหัสที่ยังไม่ใช้

สิทธิ์: `redeem_code.revoke: unused only`. Session: AdminSession. สถานะ: draft.

Used409; already revoked repeat harmless.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** optional, `application/json`, schema [EmptyRequest](#schema-emptyrequest).

ตัวอย่าง JSON:

```json
{}
```

**Response 200:** `application/json`, schema [RevokeCodeResponse](#schema-revokecoderesponse).

ตัวอย่าง JSON:

```json
{
  "id": "rdm_0001",
  "status": "revoked",
  "revoked_at": "2026-10-08T09:00:00Z"
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 409 | `invalid_state` | รหัสถูกใช้แล้ว |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### POST /me/redeem

แลกรหัสรับสิทธิ์เรียน

สิทธิ์: `redeem_code.redeem_self`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Atomic one-use consumption + grant. Existing enrollment does not consume unused code. No expiration in V1. No Admin/own course/unverified self account.

**Request body:** required, `application/json`, schema [RedeemRequest](#schema-redeemrequest).

ตัวอย่าง JSON:

```json
{
  "code": "mock-unused-0001"
}
```

**Response 200:** `application/json`, schema [WireRedeemResult](#schema-wireredeemresult).

ยังไม่มีตัวอย่าง response ที่เก็บไว้; ใช้ schema ที่ลิงก์.

**Response 201:** `application/json`, schema [WireRedeemResult](#schema-wireredeemresult).

ตัวอย่าง JSON:

```json
{
  "already_enrolled": false,
  "enrollment": {
    "id": "enr_0001",
    "course_id": "crs_mock_002",
    "source": "redeem",
    "access": "lifetime",
    "granted_at": "2026-10-08T09:00:00Z"
  }
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 403 | `email_not_verified` | กรุณายืนยันอีเมลก่อนดำเนินการ |
| 404 | `redeem_code_unavailable` | ไม่พบรหัสแลกสิทธิ์ที่ใช้งานได้ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

<a id="feature-ai"></a>

### AI Chat / Transcript / ประวัติ / Quota / AIPractice

Transcript/การเปิด AI ของคอร์สเป็น Admin; ประวัติเป็นเจ้าของบัญชี; 20 prompts สำเร็จต่อวันเวลาไทย; AIPractice ไม่เปลี่ยน Quiz/progress.

| Method | Endpoint | หน้าที่ |
| --- | --- | --- |
| `PATCH` | `/admin/courses/{id}/ai-support` | Admin เปิด/ปิด AI คอร์ส |
| `GET` | `/admin/courses/{id}/videos/{itemId}/ai-transcript` | Admin อ่าน/บันทึก Transcript |
| `PUT` | `/admin/courses/{id}/videos/{itemId}/ai-transcript` | Admin อ่าน/บันทึก Transcript |
| `GET` | `/me/ai/conversations` | สร้าง/ค้นหารายการแชตตนเอง |
| `POST` | `/me/ai/conversations` | สร้าง/ค้นหารายการแชตตนเอง |
| `PATCH` | `/me/ai/conversations/{id}` | เปลี่ยนชื่อ/ลบแชต |
| `DELETE` | `/me/ai/conversations/{id}` | เปลี่ยนชื่อ/ลบแชต |
| `GET` | `/me/ai/conversations/{id}/messages` | ประวัติข้อความ / ส่ง prompt |
| `POST` | `/me/ai/conversations/{id}/messages` | ประวัติข้อความ / ส่ง prompt |
| `PUT` | `/me/ai/conversations/{id}/messages/{messageId}/practice/answers` | ตอบ AIPractice และอ่านผล |
| `GET` | `/me/ai/usage` | โควตา prompt ประจำวัน |

#### PATCH /admin/courses/{id}/ai-support

Admin เปิด/ปิด AI คอร์ส

สิทธิ์: `ai.configure_course`. Session: AdminSession. สถานะ: draft.

Admin only, separate from course review revision.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** required, `application/json`, schema [AiSupportRequest](#schema-aisupportrequest).

ตัวอย่าง JSON:

```json
{
  "ai_enabled": true
}
```

**Response 200:** `application/json`, schema [AiSupportResponse](#schema-aisupportresponse).

ตัวอย่าง JSON:

```json
{
  "course_id": "crs_mock_001",
  "ai_enabled": true
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 403 | `forbidden` | ไม่มีสิทธิ์ใช้งานส่วนนี้ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /admin/courses/{id}/videos/{itemId}/ai-transcript

Admin อ่าน/บันทึก Transcript

สิทธิ์: `ai.manage_knowledge: Admin only`. Session: AdminSession. สถานะ: draft.

Plain text preserving lines/timestamps; <=200000 chars Draft limit. Never exposed to public/learner responses.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |
| `itemId` | path | string | required | minLength: 1 |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [WireAdminTranscript](#schema-wireadmintranscript).

ตัวอย่าง JSON:

```json
{
  "item_id": "itm_mock_002_1",
  "text": "",
  "edited_by": null,
  "edited_at": null
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 404 | `not_found` | ไม่พบข้อมูลที่ขอ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### PUT /admin/courses/{id}/videos/{itemId}/ai-transcript

Admin อ่าน/บันทึก Transcript

สิทธิ์: `ai.manage_knowledge: Admin only`. Session: AdminSession. สถานะ: draft.

Plain text preserving lines/timestamps; <=200000 chars Draft limit. Never exposed to public/learner responses.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |
| `itemId` | path | string | required | minLength: 1 |

**Request body:** required, `application/json`, schema [TranscriptRequest](#schema-transcriptrequest).

ตัวอย่าง JSON:

```json
{
  "text": "SECRET transcript text"
}
```

**Response 200:** `application/json`, schema [WireAdminTranscript](#schema-wireadmintranscript).

ตัวอย่าง JSON:

```json
{
  "item_id": "itm_mock_001_1",
  "text": "SECRET transcript text",
  "edited_by": "usr_admin",
  "edited_at": "2026-10-08T09:00:00Z"
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 403 | `forbidden` | ไม่มีสิทธิ์ใช้งานส่วนนี้ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /me/ai/conversations

สร้าง/ค้นหารายการแชตตนเอง

สิทธิ์: `ai.history_self`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `q` | query | string | optional | — |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [AiConversationPage](#schema-aiconversationpage).

ตัวอย่าง JSON:

```json
{
  "items": [],
  "next_cursor": null
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### POST /me/ai/conversations

สร้าง/ค้นหารายการแชตตนเอง

สิทธิ์: `ai.history_self`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

**Request body:** optional, `application/json`, schema [AiConversationCreateRequest](#schema-aiconversationcreaterequest).

ตัวอย่าง JSON:

```json
{
  "title": "Sample chat"
}
```

**Response 200:** `application/json`, schema [WireAiConversation](#schema-wireaiconversation).

ตัวอย่าง JSON:

```json
{
  "id": "aic_0001",
  "title": "แชตใหม่",
  "course_id": null,
  "created_at": "2026-10-08T09:00:00Z",
  "updated_at": "2026-10-08T09:00:00Z"
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 403 | `forbidden` | ไม่มีสิทธิ์ใช้งานคอร์สนี้ |
| 404 | `not_found` | ไม่พบข้อมูลที่ขอ |
| 409 | `invalid_state` | คอร์สนี้ยังไม่เปิด AI |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### PATCH /me/ai/conversations/{id}

เปลี่ยนชื่อ/ลบแชต

สิทธิ์: `ai.history_self`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** required, `application/json`, schema [AiConversationPatchRequest](#schema-aiconversationpatchrequest).

ตัวอย่าง JSON:

```json
{
  "title": "Renamed sample chat"
}
```

**Response 200:** `application/json`, schema [WireAiConversation](#schema-wireaiconversation).

ตัวอย่าง JSON:

```json
{
  "id": "aic_0001",
  "title": "Renamed sample chat",
  "course_id": null,
  "created_at": "2026-10-08T09:00:00Z",
  "updated_at": "2026-10-08T09:00:00Z"
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 422 | `validation_failed` | ข้อมูลที่ส่งไม่ถูกต้อง |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### DELETE /me/ai/conversations/{id}

เปลี่ยนชื่อ/ลบแชต

สิทธิ์: `ai.history_self`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Own conversation only; production audit/retention pending.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 204:** ไม่มี body.

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /me/ai/conversations/{id}/messages

ประวัติข้อความ / ส่ง prompt

สิทธิ์: `ai.history_self`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [AiMessagePage](#schema-aimessagepage).

ตัวอย่าง JSON:

```json
{
  "items": [
    {
      "id": "aim_0001",
      "role": "user",
      "kind": "text",
      "content": "ช่วยตอบ",
      "status": "succeeded",
      "request_id": "request-secret-1",
      "created_at": "2026-10-08T09:00:00Z",
      "completed_at": "2026-10-08T09:00:00Z",
      "error_code": null,
      "practice": null
    },
    {
      "id": "aim_0002",
      "role": "assistant",
      "kind": "text",
      "content": "[จำลอง] คำตอบจาก AI (ใช้แหล่งความรู้ 3 แหล่ง)",
      "status": "succeeded",
      "request_id": "request-secret-1",
      "created_at": "2026-10-08T09:00:00Z",
      "completed_at": "2026-10-08T09:00:00Z",
      "error_code": null,
      "practice": null
    }
  ],
  "next_cursor": null
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 404 | `not_found` | ไม่พบข้อมูลที่ขอ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### POST /me/ai/conversations/{id}/messages

ประวัติข้อความ / ส่ง prompt

สิทธิ์: `ai.history_self + course access/ai_enabled for context`. Session: WebSession หรือ AdminSession. สถานะ: draft.

20 succeeded prompts/day Asia/Bangkok; pending reserves and failed releases quota. Same request_id cannot double count. Production streaming/async retry/cancellation remain pending; synchronous mock is not provider architecture.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** required, `application/json`, schema [AiMessageRequest](#schema-aimessagerequest).

ตัวอย่าง JSON:

```json
{
  "content": "one",
  "request_id": "request-good-1"
}
```

**Response 200:** `application/json`, schema [AiMessageResponse](#schema-aimessageresponse).

ตัวอย่าง JSON:

```json
{
  "message": {
    "id": "aim_0002",
    "role": "assistant",
    "kind": "text",
    "content": "",
    "status": "failed",
    "request_id": "request-failed-1",
    "created_at": "2026-10-08T09:00:00Z",
    "completed_at": null,
    "error_code": "ai_provider_error",
    "practice": null
  },
  "usage": {
    "limit": 2,
    "used": 0,
    "remaining": 2,
    "reset_at": "2026-10-09T17:00:00Z"
  }
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 409 | `invalid_state` | คอร์สนี้ยังไม่เปิด AI |
| 429 | `ai_quota_exceeded` | โควตา AI วันนี้ครบแล้ว |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### PUT /me/ai/conversations/{id}/messages/{messageId}/practice/answers

ตอบ AIPractice และอ่านผล

สิทธิ์: `ai.practice_self`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Saved snapshot question/option IDs validated server-side. Reveal explanation/result only after answer. No extra quota/Attempt/progress/certificate.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |
| `messageId` | path | string | required | minLength: 1 |

**Request body:** required, `application/json`, schema [AiPracticeAnswerRequest](#schema-aipracticeanswerrequest).

ตัวอย่าง JSON:

```json
{
  "question_id": "practice_aim_0004_1",
  "option_id": "opt_aim_0004_1_1"
}
```

**Response 200:** `application/json`, schema [WireAiPracticeAnswer](#schema-wireaipracticeanswer).

ตัวอย่าง JSON:

```json
{
  "question_id": "practice_aim_0004_1",
  "correct": false,
  "explanation": "คำอธิบายของข้อที่ 1",
  "summary": null
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /me/ai/usage

โควตา prompt ประจำวัน

สิทธิ์: `ai.usage_self`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [WireAiUsage](#schema-wireaiusage).

ตัวอย่าง JSON:

```json
{
  "limit": 2,
  "used": 2,
  "remaining": 0,
  "reset_at": "2026-10-09T17:00:00Z"
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

<a id="feature-blog"></a>

### บทความสาธารณะ / Blog Editor

Admin สร้าง/แก้/publish; public เห็นเฉพาะ published; PATCH/publish/unpublish/delete ต้องส่ง expected_revision.

| Method | Endpoint | หน้าที่ |
| --- | --- | --- |
| `GET` | `/admin/blog` | รายการ/สร้างบทความ Admin |
| `POST` | `/admin/blog` | รายการ/สร้างบทความ Admin |
| `PATCH` | `/admin/blog/{id}` | แก้/ลบบทความ |
| `DELETE` | `/admin/blog/{id}` | แก้/ลบบทความ |
| `GET` | `/admin/blog/{id}/preview` | preview บทความ draft |
| `POST` | `/admin/blog/{id}/publish` | เผยแพร่บทความ |
| `POST` | `/admin/blog/{id}/unpublish` | ถอนเผยแพร่บทความ |
| `GET` | `/blog` | รายการบทความ published |
| `GET` | `/blog/{slug}` | อ่านบทความ public |

#### GET /admin/blog

รายการ/สร้างบทความ Admin

สิทธิ์: `blog.update`. Session: AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `q` | query | string | optional | — |
| `status` | query | string | optional | enum: ["draft","published"] |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [AdminBlogPage](#schema-adminblogpage).

ตัวอย่าง JSON:

```json
{
  "items": [
    {
      "id": "blg_mock_002",
      "slug": "mock-second-post",
      "title": "บทความตัวอย่างที่สอง",
      "cover_url": null,
      "excerpt": null,
      "published_at": "2026-09-25T00:00:00Z",
      "category": "บทความ",
      "reading_minutes": 2,
      "author": {
        "id": "usr_admin",
        "display_name": "Melearn"
      },
      "content": "เนื้อหาบทความตัวอย่างที่สอง",
      "content_doc": null,
      "revision": 1,
      "status": "published",
      "author_id": "usr_admin",
      "editor_id": "usr_admin",
      "created_at": "2026-09-01T00:00:00Z",
      "updated_at": "2026-09-25T00:00:00Z"
    },
    {
      "id": "blg_mock_001",
      "slug": "mock-first-post",
      "title": "บทความตัวอย่างแรก",
      "cover_url": null,
      "excerpt": "คำเกริ่นตัวอย่าง",
      "published_at": "2026-09-10T00:00:00Z",
      "category": "บทความ",
      "reading_minutes": 2,
      "author": {
        "id": "usr_admin",
        "display_name": "Melearn"
      },
      "content": "เนื้อหาบทความตัวอย่างที่เปิดสาธารณะ",
      "content_doc": null,
      "revision": 1,
      "status": "published",
      "author_id": "usr_admin",
      "editor_id": "usr_admin",
      "created_at": "2026-09-01T00:00:00Z",
      "updated_at": "2026-09-10T00:00:00Z"
    },
    {
      "id": "blg_mock_draft",
      "slug": "mock-secret-draft-post",
      "title": "SECRET draft blog title",
      "cover_url": null,
      "excerpt": "SECRET draft excerpt",
      "published_at": null,
      "category": "บทความ",
      "reading_minutes": 2,
      "author": {
        "id": "usr_admin",
        "display_name": "Melearn"
      },
      "content": "SECRET draft blog content",
      "content_doc": null,
      "revision": 1,
      "status": "draft",
      "author_id": "usr_admin",
      "editor_id": "usr_admin",
      "created_at": "2026-09-01T00:00:00Z",
      "updated_at": "2026-09-01T00:00:00Z"
    }
  ],
  "next_cursor": null
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 403 | `forbidden` | ไม่มีสิทธิ์ใช้งานส่วนนี้ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### POST /admin/blog

รายการ/สร้างบทความ Admin

สิทธิ์: `blog.create`. Session: AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

**Request body:** required, `application/json`, schema [BlogCreateRequest](#schema-blogcreaterequest).

ตัวอย่าง JSON:

```json
{
  "title": "บทความ",
  "slug": "draft-post",
  "content": "ลับ"
}
```

**Response 201:** `application/json`, schema [AdminBlogDto](#schema-adminblogdto).

ตัวอย่าง JSON:

```json
{
  "id": "blg_0001",
  "slug": "draft-post",
  "title": "บทความ",
  "cover_url": null,
  "excerpt": null,
  "published_at": null,
  "category": "บทความ",
  "reading_minutes": 2,
  "author": {
    "id": "usr_admin",
    "display_name": "ผู้ดูแลตัวอย่าง"
  },
  "content": "ลับ",
  "content_doc": null,
  "revision": 1,
  "status": "draft",
  "author_id": "usr_admin",
  "editor_id": "usr_admin",
  "created_at": "2026-10-08T09:00:00Z",
  "updated_at": "2026-10-08T09:00:00Z"
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 403 | `forbidden` | ไม่มีสิทธิ์ใช้งานส่วนนี้ |
| 409 | `slug_taken` | Slug นี้ถูกใช้แล้ว |
| 422 | `validation_failed` | ข้อมูลที่ส่งไม่ถูกต้อง |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### PATCH /admin/blog/{id}

แก้/ลบบทความ

สิทธิ์: `blog.update`. Session: AdminSession. สถานะ: draft.

Revision guard; published slug stable. Mock and clients require a positive integer expected_revision; missing/invalid returns 422 and stale returns 409. Save/publish are two commands: preserve saved ID/revision if publish fails after successful save.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** required, `application/json`, schema [BlogPatchRequest](#schema-blogpatchrequest).

ตัวอย่าง JSON:

```json
{
  "expected_revision": 2,
  "content": "แก้แล้ว"
}
```

**Response 200:** `application/json`, schema [AdminBlogDto](#schema-adminblogdto).

ตัวอย่าง JSON:

```json
{
  "id": "blg_0001",
  "slug": "revision-regression",
  "title": "Saved",
  "cover_url": null,
  "excerpt": null,
  "published_at": null,
  "category": "บทความ",
  "reading_minutes": 2,
  "author": {
    "id": "usr_admin",
    "display_name": "ผู้ดูแลตัวอย่าง"
  },
  "content": "Saved body",
  "content_doc": null,
  "revision": 2,
  "status": "draft",
  "author_id": "usr_admin",
  "editor_id": "usr_admin",
  "created_at": "2026-10-08T09:00:00Z",
  "updated_at": "2026-10-08T09:00:00Z"
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 409 | `invalid_state` | บทความที่เผยแพร่แล้วเปลี่ยน Slug ไม่ได้ |
| 422 | `validation_failed` | ข้อมูลที่ส่งไม่ถูกต้อง |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

Blog mutation ต้องส่ง `expected_revision`: missing/invalid → 422, stale → 409; DELETE ปัจจุบันส่ง JSON body กลยุทธ์ If-Match/retention ยังรอยืนยัน.

#### DELETE /admin/blog/{id}

แก้/ลบบทความ

สิทธิ์: `Admin Blog management`. Session: AdminSession. สถานะ: draft.

Existing Draft deletion extension. DELETE JSON vs If-Match and audit/retention pending; not approval of Production hard deletion.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** required, `application/json`, schema [BlogRevisionRequest](#schema-blogrevisionrequest).

ตัวอย่าง JSON:

```json
{
  "expected_revision": 3
}
```

**Response 200:** `application/json`, schema [DeletedBlogResponse](#schema-deletedblogresponse).

ตัวอย่าง JSON:

```json
{
  "id": "blg_0001",
  "deleted": true
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 403 | `forbidden` | ไม่มีสิทธิ์ใช้งานส่วนนี้ |
| 409 | `revision_conflict` | บทความเปลี่ยนแปลงแล้ว กรุณาโหลดล่าสุด |
| 422 | `validation_failed` | ข้อมูลที่ส่งไม่ถูกต้อง |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

Blog mutation ต้องส่ง `expected_revision`: missing/invalid → 422, stale → 409; DELETE ปัจจุบันส่ง JSON body กลยุทธ์ If-Match/retention ยังรอยืนยัน.

#### GET /admin/blog/{id}/preview

preview บทความ draft

สิทธิ์: `blog.update`. Session: AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [AdminBlogDto](#schema-adminblogdto).

ตัวอย่าง JSON:

```json
{
  "id": "blg_0001",
  "slug": "revision-regression",
  "title": "Saved",
  "cover_url": null,
  "excerpt": null,
  "published_at": null,
  "category": "บทความ",
  "reading_minutes": 2,
  "author": {
    "id": "usr_admin",
    "display_name": "ผู้ดูแลตัวอย่าง"
  },
  "content": "Saved body",
  "content_doc": null,
  "revision": 2,
  "status": "draft",
  "author_id": "usr_admin",
  "editor_id": "usr_admin",
  "created_at": "2026-10-08T09:00:00Z",
  "updated_at": "2026-10-08T09:00:00Z"
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 404 | `not_found` | ไม่พบข้อมูลที่ขอ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### POST /admin/blog/{id}/publish

เผยแพร่บทความ

สิทธิ์: `blog.publish`. Session: AdminSession. สถานะ: draft.

Revision guard. Unpublish is current UI extension, retention policy pending.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** required, `application/json`, schema [BlogRevisionRequest](#schema-blogrevisionrequest).

ตัวอย่าง JSON:

```json
{
  "expected_revision": 1
}
```

**Response 200:** `application/json`, schema [AdminBlogDto](#schema-adminblogdto).

ตัวอย่าง JSON:

```json
{
  "id": "blg_0001",
  "slug": "draft-post",
  "title": "บทความ",
  "cover_url": null,
  "excerpt": null,
  "published_at": "2026-10-08T09:00:00Z",
  "category": "บทความ",
  "reading_minutes": 2,
  "author": {
    "id": "usr_admin",
    "display_name": "ผู้ดูแลตัวอย่าง"
  },
  "content": "ลับ",
  "content_doc": null,
  "revision": 2,
  "status": "published",
  "author_id": "usr_admin",
  "editor_id": "usr_admin",
  "created_at": "2026-10-08T09:00:00Z",
  "updated_at": "2026-10-08T09:00:00Z"
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 409 | `revision_conflict` | บทความเปลี่ยนแปลงแล้ว กรุณาโหลดล่าสุด |
| 422 | `validation_failed` | ข้อมูลที่ส่งไม่ถูกต้อง |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

Blog mutation ต้องส่ง `expected_revision`: missing/invalid → 422, stale → 409; DELETE ปัจจุบันส่ง JSON body กลยุทธ์ If-Match/retention ยังรอยืนยัน.

#### POST /admin/blog/{id}/unpublish

ถอนเผยแพร่บทความ

สิทธิ์: `blog.publish`. Session: AdminSession. สถานะ: draft.

Revision guard. Unpublish is current UI extension, retention policy pending.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** required, `application/json`, schema [BlogRevisionRequest](#schema-blogrevisionrequest).

ตัวอย่าง JSON:

```json
{
  "expected_revision": 2
}
```

**Response 200:** `application/json`, schema [AdminBlogDto](#schema-adminblogdto).

ตัวอย่าง JSON:

```json
{
  "id": "blg_0001",
  "slug": "revision-regression",
  "title": "Saved",
  "cover_url": null,
  "excerpt": null,
  "published_at": "2026-10-08T09:00:00Z",
  "category": "บทความ",
  "reading_minutes": 2,
  "author": {
    "id": "usr_admin",
    "display_name": "ผู้ดูแลตัวอย่าง"
  },
  "content": "Saved body",
  "content_doc": null,
  "revision": 4,
  "status": "draft",
  "author_id": "usr_admin",
  "editor_id": "usr_admin",
  "created_at": "2026-10-08T09:00:00Z",
  "updated_at": "2026-10-08T09:00:00Z"
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 409 | `revision_conflict` | บทความเปลี่ยนแปลงแล้ว กรุณาโหลดล่าสุด |
| 422 | `validation_failed` | ข้อมูลที่ส่งไม่ถูกต้อง |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

Blog mutation ต้องส่ง `expected_revision`: missing/invalid → 422, stale → 409; DELETE ปัจจุบันส่ง JSON body กลยุทธ์ If-Match/retention ยังรอยืนยัน.

#### GET /blog

รายการบทความ published

สิทธิ์: `blog.read_public`. Session: public ไม่ต้องมี session. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `q` | query | string | optional | — |
| `category` | query | string | optional | — |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [PublicBlogPage](#schema-publicblogpage).

ตัวอย่าง JSON:

```json
{
  "items": [
    {
      "id": "blg_mock_002",
      "slug": "mock-second-post",
      "title": "บทความตัวอย่างที่สอง",
      "cover_url": null,
      "excerpt": null,
      "published_at": "2026-09-25T00:00:00Z",
      "category": "บทความ",
      "reading_minutes": 2,
      "author": {
        "id": "usr_admin",
        "display_name": "Melearn"
      }
    },
    {
      "id": "blg_mock_001",
      "slug": "mock-first-post",
      "title": "บทความตัวอย่างแรก",
      "cover_url": null,
      "excerpt": "คำเกริ่นตัวอย่าง",
      "published_at": "2026-09-10T00:00:00Z",
      "category": "บทความ",
      "reading_minutes": 2,
      "author": {
        "id": "usr_admin",
        "display_name": "Melearn"
      }
    }
  ],
  "next_cursor": null
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /blog/{slug}

อ่านบทความ public

สิทธิ์: `blog.read_public`. Session: public ไม่ต้องมี session. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `slug` | path | string | required | minLength: 1 |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [PublicBlogDetail](#schema-publicblogdetail).

ตัวอย่าง JSON:

```json
{
  "id": "blg_0001",
  "slug": "draft-post",
  "title": "บทความ",
  "cover_url": null,
  "excerpt": null,
  "published_at": "2026-10-08T09:00:00Z",
  "category": "บทความ",
  "reading_minutes": 2,
  "author": {
    "id": "usr_admin",
    "display_name": "ผู้ดูแลตัวอย่าง"
  },
  "content": "ลับ",
  "content_doc": null
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 404 | `not_found` | ไม่พบข้อมูลที่ขอ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

<a id="feature-management"></a>

### จัดการผู้ใช้ / Instructor / ผู้เรียน / ผลเรียน / Dashboard

Admin จัดการบัญชีและแต่งตั้ง Instructor; Instructor เห็นข้อมูลในคอร์สตนเอง. Dashboard เป็น scoped summary ตาม V1.

| Method | Endpoint | หน้าที่ |
| --- | --- | --- |
| `GET` | `/admin/instructors` | รายชื่อ Instructor เพื่อเลือกเจ้าของคอร์ส |
| `GET` | `/admin/learners` | รายการผู้เรียนเพื่อจัดการ |
| `GET` | `/admin/summary` | summary Admin |
| `GET` | `/admin/users` | Admin สร้าง/รายการบัญชี |
| `POST` | `/admin/users` | Admin สร้าง/รายการบัญชี |
| `GET` | `/admin/users/{id}` | รายละเอียดบัญชี |
| `GET` | `/admin/users/{id}/attempts` | ผลแบบฝึกหัดของบัญชี |
| `GET` | `/admin/users/{id}/enrollments` | คอร์สที่บัญชีมีสิทธิ์ |
| `POST` | `/admin/users/{id}/instructor` | แต่งตั้ง Instructor |
| `GET` | `/courses/{id}/attempts` | ผลแบบฝึกหัดในคอร์ส |
| `GET` | `/courses/{id}/learners` | ผู้เรียนในคอร์ส |
| `GET` | `/instructor/attempts/{id}` | รายละเอียดงานตรวจของเจ้าของ Instructor |
| `GET` | `/instructor/learners` | ผู้เรียนเฉพาะคอร์สผู้สอน |
| `GET` | `/instructor/summary` | summary Instructor |
| `GET` | `/managed-quizzes/{id}` | อ่าน quiz สำหรับผู้จัดการคอร์ส |

#### GET /admin/instructors

รายชื่อ Instructor เพื่อเลือกเจ้าของคอร์ส

สิทธิ์: `Admin course owner selection`. Session: AdminSession. สถานะ: draft.

Server validates authentication, permission and current principal resource scope.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [InstructorPage](#schema-instructorpage).

ตัวอย่าง JSON:

```json
{
  "items": [
    {
      "id": "usr_instructor_a",
      "display_name": "ผู้สอนตัวอย่าง ก",
      "avatar_url": null
    },
    {
      "id": "usr_instructor_b",
      "display_name": "ผู้สอนตัวอย่าง ข",
      "avatar_url": null
    }
  ],
  "next_cursor": null
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 403 | `forbidden` | ไม่มีสิทธิ์ใช้งานส่วนนี้ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries unless operation semantics explicitly permit replay.

#### GET /admin/learners

รายการผู้เรียนเพื่อจัดการ

สิทธิ์: `Admin course management`. Session: AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [RosterPage](#schema-rosterpage).

ตัวอย่าง JSON:

```json
{
  "items": [
    {
      "id": "enr_0001",
      "course_id": "crs_0001",
      "user_id": "usr_learner",
      "learner_display_name": "ผู้เรียนตัวอย่าง",
      "granted_at": "2026-10-08T09:00:00Z",
      "completed_items": 1,
      "total_items": 1,
      "completed_at": "2026-10-08T09:00:00Z",
      "percent": 100,
      "certificate": {
        "id": "cert_0001",
        "code": "MLN-0001",
        "learner_name": "ผู้เรียนตัวอย่าง",
        "issued_at": "2026-10-08T09:00:00Z"
      }
    }
  ],
  "next_cursor": null
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /admin/summary

summary Admin

สิทธิ์: `admin scoped dashboard counts`. Session: AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [DashboardDto](#schema-dashboarddto).

ตัวอย่าง JSON:

```json
{
  "course_count": 6,
  "enrollment_count": 0,
  "learner_count": 0,
  "pending_grading_count": 0,
  "user_count": 7,
  "pending_course_count": 1
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /admin/users

Admin สร้าง/รายการบัญชี

สิทธิ์: `Admin account management`. Session: AdminSession. สถานะ: draft.

Server validates authentication, permission and current principal resource scope.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `q` | query | string | optional | — |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [AdminUserPage](#schema-adminuserpage).

ตัวอย่าง JSON:

```json
{
  "items": [
    {
      "id": "usr_admin",
      "display_name": "ผู้ดูแลตัวอย่าง",
      "username": "admin",
      "email": null,
      "email_verified": false,
      "roles": [
        "admin"
      ],
      "origin": "admin_created",
      "avatar_url": null,
      "created_at": "2026-09-01T00:00:00Z",
      "status": "active"
    }
  ],
  "next_cursor": "o:1"
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 403 | `forbidden` | ไม่มีสิทธิ์ใช้งานส่วนนี้ |
| 422 | `validation_failed` | ข้อมูลที่ส่งไม่ถูกต้อง |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries unless operation semantics explicitly permit replay.

#### POST /admin/users

Admin สร้าง/รายการบัญชี

สิทธิ์: `user.create`. Session: AdminSession. สถานะ: draft.

Admin only. Username/email uniqueness server-side. Do not return password/hash. Username pattern differs from profile update in current mock; unification is an open decision.

**Request body:** required, `application/json`, schema [AdminCreateUserRequest](#schema-admincreateuserrequest).

ตัวอย่าง JSON:

```json
{
  "username": "new.learner",
  "password": "password-123",
  "display_name": "ผู้เรียนใหม่"
}
```

**Response 201:** `application/json`, schema [AdminCreateUserResponse](#schema-admincreateuserresponse).

ตัวอย่าง JSON:

```json
{
  "user": {
    "id": "usr_0001",
    "display_name": "ผู้เรียนใหม่",
    "username": "new.learner",
    "email": null,
    "email_verified": false,
    "avatar_url": null,
    "roles": [
      "learner"
    ],
    "origin": "admin_created",
    "auth_methods": [
      "password"
    ],
    "learning_eligible": true,
    "profile": {}
  },
  "created_by": "usr_admin",
  "created_at": "2026-10-08T09:00:00Z"
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 401 | `unauthenticated` | กรุณาเข้าสู่ระบบ |
| 403 | `forbidden` | ไม่มีสิทธิ์ใช้งานส่วนนี้ |
| 409 | `email_taken` | อีเมลนี้ถูกใช้แล้ว |
| 422 | `validation_failed` | ข้อมูลที่ส่งไม่ถูกต้อง |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries unless operation semantics explicitly permit replay.

#### GET /admin/users/{id}

รายละเอียดบัญชี

สิทธิ์: `Admin account management`. Session: AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [AdminUserDetailDto](#schema-adminuserdetaildto).

ตัวอย่าง JSON:

```json
{
  "id": "usr_admin",
  "display_name": "ผู้ดูแลตัวอย่าง",
  "username": "admin",
  "email": null,
  "email_verified": false,
  "avatar_url": null,
  "roles": [
    "admin"
  ],
  "origin": "admin_created",
  "created_at": "2026-09-01T00:00:00Z",
  "status": "active",
  "profile": {},
  "auth_methods": [
    "password"
  ]
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 403 | `forbidden` | ไม่มีสิทธิ์ใช้งานส่วนนี้ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /admin/users/{id}/attempts

ผลแบบฝึกหัดของบัญชี

สิทธิ์: `Admin scoped read; no grading`. Session: AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [ManagedAttemptPage](#schema-managedattemptpage).

ตัวอย่าง JSON:

```json
{
  "items": [],
  "next_cursor": null
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /admin/users/{id}/enrollments

คอร์สที่บัญชีมีสิทธิ์

สิทธิ์: `Admin scoped account course-management read`. Session: AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [RosterPage](#schema-rosterpage).

ตัวอย่าง JSON:

```json
{
  "items": [],
  "next_cursor": null
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### POST /admin/users/{id}/instructor

แต่งตั้ง Instructor

สิทธิ์: `user.assign_instructor`. Session: AdminSession. สถานะ: draft.

Admin only. Add Instructor while retaining Learner; repeat returns existing grant; cannot elevate to Admin.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** optional, `application/json`, schema [EmptyRequest](#schema-emptyrequest).

ตัวอย่าง JSON:

```json
{}
```

**Response 200:** `application/json`, schema [AssignInstructorResponse](#schema-assigninstructorresponse).

ตัวอย่าง JSON:

```json
{
  "user": {
    "id": "usr_0001",
    "display_name": "ผู้เรียนใหม่",
    "username": "new.learner",
    "email": null,
    "email_verified": false,
    "avatar_url": null,
    "roles": [
      "learner",
      "instructor"
    ],
    "origin": "admin_created",
    "auth_methods": [
      "password"
    ],
    "learning_eligible": true,
    "profile": {}
  },
  "added_by": "usr_admin",
  "added_at": "2026-10-08T09:00:00Z"
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 403 | `forbidden` | ไม่มีสิทธิ์ใช้งานส่วนนี้ |
| 404 | `not_found` | ไม่พบข้อมูลที่ขอ |
| 409 | `invalid_state` | บัญชี Admin เป็น Instructor ไม่ได้ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries unless operation semantics explicitly permit replay.

#### GET /courses/{id}/attempts

ผลแบบฝึกหัดในคอร์ส

สิทธิ์: `course.learners_read: owner Instructor/Admin`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [ManagedAttemptPage](#schema-managedattemptpage).

ตัวอย่าง JSON:

```json
{
  "items": [],
  "next_cursor": null
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /courses/{id}/learners

ผู้เรียนในคอร์ส

สิทธิ์: `course.learners_read: owner Instructor/Admin`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [RosterPage](#schema-rosterpage).

ตัวอย่าง JSON:

```json
{
  "items": [],
  "next_cursor": null
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 404 | `not_found` | ไม่พบข้อมูลที่ขอ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /instructor/attempts/{id}

รายละเอียดงานตรวจของเจ้าของ Instructor

สิทธิ์: `quiz.grade: owner Instructor; Admin forbidden`. Session: WebSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [ManagedAttemptDto](#schema-managedattemptdto).

ตัวอย่าง JSON:

```json
{
  "id": "att_0001",
  "course_id": "crs_mock_001",
  "item_id": "itm_mock_001_3",
  "user_id": "usr_learner",
  "learner_display_name": "ผู้เรียนตัวอย่าง",
  "status": "pending_review",
  "started_at": "2026-10-08T09:00:00Z",
  "submitted_at": "2026-10-08T09:00:00Z",
  "graded_at": null,
  "earned": null,
  "max": 4,
  "passed": null,
  "choice_earned": 2,
  "choice_max": 2,
  "questions": [
    {
      "id": "qst_mock_001_1",
      "type": "single_choice",
      "prompt": "ข้อใดคือจุดเริ่มต้นของการออกแบบคอร์ส",
      "points": 1,
      "prompt_doc": null,
      "rubric": null,
      "response_mode": "either",
      "options": [
        {
          "id": "opt_001_1_a",
          "text": "เขียนเนื้อหาทันที"
        },
        {
          "id": "opt_001_1_b",
          "text": "กำหนดผลลัพธ์การเรียนรู้"
        }
      ]
    },
    {
      "id": "qst_mock_001_2",
      "type": "multiple_choice",
      "prompt": "เลือกรูปแบบเนื้อหาที่ใช้ได้ทั้งหมด",
      "points": 1,
      "prompt_doc": null,
      "rubric": null,
      "response_mode": "either",
      "options": [
        {
          "id": "opt_001_2_a",
          "text": "วิดีโอ"
        },
        {
          "id": "opt_001_2_b",
          "text": "ตัวอักษรสีขาวบนพื้นขาว"
        },
        {
          "id": "opt_001_2_c",
          "text": "บทอ่าน"
        }
      ]
    },
    {
      "id": "qst_mock_001_3",
      "type": "essay",
      "prompt": "อธิบายแผนบทเรียนของคุณสั้น ๆ",
      "points": 2,
      "prompt_doc": null,
      "rubric": null,
      "response_mode": "either"
    }
  ],
  "answers": {
    "qst_mock_001_1": {
      "option_ids": [
        "opt_001_1_b"
      ]
    },
    "qst_mock_001_2": {
      "option_ids": [
        "opt_001_2_a",
        "opt_001_2_c"
      ]
    },
    "qst_mock_001_3": {
      "text": "answer"
    }
  },
  "grades": {
    "qst_mock_001_1": {
      "score": 1,
      "comment": null
    },
    "qst_mock_001_2": {
      "score": 1,
      "comment": null
    }
  }
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /instructor/learners

ผู้เรียนเฉพาะคอร์สผู้สอน

สิทธิ์: `owner Instructor courses only`. Session: WebSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `limit` | query | integer | optional | minimum: 1; maximum: 50; default: 20 |
| `cursor` | query | string | optional | — |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [RosterPage](#schema-rosterpage).

ตัวอย่าง JSON:

```json
{
  "items": [
    {
      "id": "enr_0001",
      "course_id": "crs_0001",
      "user_id": "usr_learner",
      "learner_display_name": "ผู้เรียนตัวอย่าง",
      "granted_at": "2026-10-08T09:00:00Z",
      "completed_items": 1,
      "total_items": 1,
      "completed_at": "2026-10-08T09:00:00Z",
      "percent": 100,
      "certificate": {
        "id": "cert_0001",
        "code": "MLN-0001",
        "learner_name": "ผู้เรียนตัวอย่าง",
        "issued_at": "2026-10-08T09:00:00Z"
      }
    }
  ],
  "next_cursor": null
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /instructor/summary

summary Instructor

สิทธิ์: `instructor scoped dashboard counts`. Session: WebSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [DashboardDto](#schema-dashboarddto).

ตัวอย่าง JSON:

```json
{
  "course_count": 3,
  "enrollment_count": 0,
  "learner_count": 0,
  "pending_grading_count": 0
}
```

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

#### GET /managed-quizzes/{id}

อ่าน quiz สำหรับผู้จัดการคอร์ส

สิทธิ์: `course.update: owner Instructor/Admin`. Session: WebSession หรือ AdminSession. สถานะ: draft.

Server validates authentication, permission, ownership and lifecycle; see Thai flow spec.

| Parameter | ที่ส่ง | Type/schema | Required | Validation |
| --- | --- | --- | --- | --- |
| `id` | path | string | required | minLength: 1 |

**Request body:** ไม่มี JSON body ตาม Draft นี้.

**Response 200:** `application/json`, schema [ManagedQuizLocator](#schema-managedquizlocator).

ตัวอย่าง JSON:

```json
{
  "course_id": "crs_mock_001",
  "item_id": "itm_mock_001_3"
}
```

Errors ที่มีตัวอย่าง mock ใน OpenAPI:

| HTTP | Code | Message ตัวอย่าง |
| --- | --- | --- |
| 404 | `not_found` | ไม่พบข้อมูลที่ขอ |

Schema ของ error: [ErrorEnvelope](#schema-errorenvelope). No automatic mutation retries without explicit replay/idempotency semantics.

## 4. Provider operations ที่ยังไม่มี JSON/protocol พร้อมใช้จริง

| Method | Endpoint | Feature | สถานะ |
| --- | --- | --- | --- |
| `GET` | `/auth/google/start` | auth | provider-pending |
| `GET` | `/auth/google/callback` | auth | provider-pending |
| `POST` | `/me/auth-identities/google` | auth | provider-pending |
| `GET` | `/me/auth-identities/google/callback` | auth | provider-pending |
| `POST` | `/webhooks/stripe` | payment | provider-pending |

Google start/callback ต้องตกลง redirect, state, PKCE/code exchange, identity verification, account-link conflicts และ error callback; ไม่ใช้ mock_google เป็นข้อมูลยืนยันตัวตนจริง. Stripe webhook ต้องใช้ raw event และ signature ที่ตรวจจาก providerจริง/versionที่ตกลง; ห้ามนำ fake signature/flat mock events ไปเป็น Production payload. เว็บอ่าน payment status ได้แต่ไม่ให้สิทธิ์เอง.

## 5. ช่องว่าง API อัปโหลดรูปโปรไฟล์ / Cloudflare

**มีแล้ว:** `PATCH /me` ส่ง `avatar_url` เป็น URL หรือ null ตาม [UpdateProfileRequest](#schema-updateprofilerequest). UI เลือก/เปลี่ยน/ลบและ preview JPG/PNG/WebP ไม่เกิน 5 MB ได้ แต่ไฟล์ยังเป็น local draft. **ยังไม่มี:** endpoint อัปโหลดภาพ, multipart/presigned upload JSON, DTO/schema/mock หรือ Cloudflare integration. การเลือก Cloudflareเป็นทิศทางล่าสุดของผู้ใช้ แต่ยังไม่เลือก Images/R2/protocol จึงไม่มี request/response ที่รับรองในเอกสารนี้.

งานที่ Backend/Frontend ต้องตกลงเพิ่ม: permission อัปโหลดเฉพาะบัญชีตนเอง, upload intent หรือ multipart route, size/type/content validation, response ที่คืน hosted URL/media ID, expiry/finish flow, ownership ของ media, การลบ/เปลี่ยนรูปเดิมและ errors. อย่าส่ง data URL/local blob เข้า `avatar_url` หรือเก็บ Cloudflare credentials ใน browser. งานนี้อยู่นอก inventory ที่นับข้างต้นจนเพิ่ม schema/client/mock และยืนยัน flow.

## 6. เรื่องที่ยังต้องตกลงก่อน freeze / สิ่งที่ไม่ต้องสร้าง

- Cookie transport/names/domain/CSRF/TTL and environment origins (separate login/session confirmed)

- Username pattern mismatch Admin create vs profile edit; unify or document compatibility

- Revision enforcement on return-review; Blog mutations now require expected_revision

- Idempotency key lifetime and payload mismatch/create/grade partial success behavior

- Pagination cursor expiry/search/sort/filter limits

- Rich document version, safe URL policy, size/depth/node limits and upload/storage

- Certificate download format vs text mock

- Real OAuth handshake/callback and Stripe webhook/provider API version

- AI sync JSON vs async/streaming, retries/cancellation

- Deletion/retention/audit and visibility/PII scopes

- Publish currently accepts an empty request and checks approved review/current revision server-side; agree whether client expected_revision is also required before freeze.


ไม่มี Cart, Discount, Order, Finance, Inbox, คำขอเป็น Instructor หรือ analytics ขนาดใหญ่ใน V1. ไม่มี endpoint แยก POST/DELETE Chapter/Quiz เพียงเพื่อให้ครบ CRUD: Draft ปัจจุบันแก้ nested content ผ่าน `PATCH /courses/{id}`. ห้ามเดา endpoint เพิ่มจากหน้าจอ. JSON schema ไม่ใช่ database schema; Backend ออกแบบ storage/transactions ของตนเองให้ enforce กติกา Final 1.6.

## 7. ภาคผนวก — DTO / fields / validation ครบทุก schema

ตารางนี้สร้างจาก `components.schemas` ทั้ง 134 definitions. Required ของ nested field หมายถึงจำเป็นเมื่อ parent object นั้นถูกส่ง; array items ไม่กำหนดจำนวนขั้นต่ำเว้นแต่มี minItems. คลิก `$ref` เพื่ออ่าน DTO ที่เกี่ยวข้อง; oneOf/anyOf ต้องอ่าน branch ทั้งหมด. ข้อจำกัดที่ไม่ได้ระบุไม่ใช่สิทธิ์ให้ UI/backendใช้ค่าใดก็ได้ แต่เป็น decision gap ที่ควรตกลง.

<a id="schema-acceptedresponse"></a>

### AcceptedResponse

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `status` | string | required | enum: ["accepted"] |
| `retry_after_seconds` | integer | required | minimum: 0 |

<a id="schema-accountprofile"></a>

### AccountProfile

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `bio` | string | optional | — |
| `firstName` | string | optional | — |
| `lastName` | string | optional | — |
| `firstNameEnglish` | string | optional | — |
| `lastNameEnglish` | string | optional | — |
| `certificateName` | string | optional | — |
| `birthDate` | string | optional | — |
| `phone` | string | optional | — |
| `school` | string | optional | — |
| `educationLevel` | string | optional | — |
| `interests` | array<string> | optional | maxItems: 30 |
| `learningGoals` | array<string> | optional | maxItems: 30 |

<a id="schema-accountprofilepatch"></a>

### AccountProfilePatch

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `bio` | string / anyOf / null | optional | — |
| `firstName` | string / anyOf / null | optional | — |
| `lastName` | string / anyOf / null | optional | — |
| `firstNameEnglish` | string / anyOf / null | optional | — |
| `lastNameEnglish` | string / anyOf / null | optional | — |
| `certificateName` | string / anyOf / null | optional | — |
| `birthDate` | string / anyOf / null | optional | — |
| `phone` | string / anyOf / null | optional | — |
| `school` | string / anyOf / null | optional | — |
| `educationLevel` | string / anyOf / null | optional | — |
| `interests` | array<string> | optional | maxItems: 30 |
| `learningGoals` | array<string> | optional | maxItems: 30 |

<a id="schema-adminblogdto"></a>

### AdminBlogDto

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `revision` | integer | required | minimum: 1 |
| `status` | [BlogPostStatus](#schema-blogpoststatus) | required | — |
| `author_id` | string | required | — |
| `editor_id` | string | required | — |
| `created_at` | string | required | — |
| `updated_at` | string | required | — |
| `content` | string | required | — |
| `content_doc` | [JsonValue](#schema-jsonvalue) | required | — |
| `id` | string | required | — |
| `slug` | string | required | — |
| `title` | string | required | — |
| `cover_url` | null / anyOf / string | required | — |
| `excerpt` | null / anyOf / string | required | — |
| `published_at` | null / anyOf / string | required | — |
| `category` | string | required | — |
| `reading_minutes` | number | required | — |
| `author` | object | required | ไม่รับ field นอก schema |
| `author.id` | string | required | — |
| `author.display_name` | string | required | — |

<a id="schema-adminblogpage"></a>

### AdminBlogPage

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `items` | array<[AdminBlogDto](#schema-adminblogdto)> | required | — |
| `next_cursor` | string / anyOf / null | required | — |

<a id="schema-admincoursecreaterequest"></a>

### AdminCourseCreateRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `title` | string | required | minLength: 1; maxLength: 120 |
| `subtitle` | null / anyOf / string | optional | — |
| `description` | null / anyOf / string | optional | — |
| `cover_url` | null / anyOf / string | optional | — |
| `category` | string | optional | maxLength: 80 |
| `level` | string | optional | maxLength: 80 |
| `price` | null / anyOf / [Money](#schema-money) | optional | — |
| `outcomes` | array<string> | optional | — |
| `instructor_id` | string | required | minLength: 1 |

<a id="schema-admincreateuserrequest"></a>

### AdminCreateUserRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `username` | string | required | — |
| `password` | string | required | — |
| `display_name` | string | required | — |
| `email` | null / anyOf / string | optional | — |

<a id="schema-admincreateuserresponse"></a>

### AdminCreateUserResponse

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `user` | [CurrentUser](#schema-currentuser) | required | — |
| `created_by` | string | required | minLength: 1 |
| `created_at` | string | required | format: "date-time" |

<a id="schema-adminuserdetaildto"></a>

### AdminUserDetailDto

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `profile` | object | required | ไม่รับ field นอก schema |
| `profile.bio` | string | optional | — |
| `profile.firstName` | string | optional | — |
| `profile.lastName` | string | optional | — |
| `profile.firstNameEnglish` | string | optional | — |
| `profile.lastNameEnglish` | string | optional | — |
| `profile.certificateName` | string | optional | — |
| `profile.birthDate` | string | optional | — |
| `profile.phone` | string | optional | — |
| `profile.school` | string | optional | — |
| `profile.educationLevel` | string | optional | — |
| `profile.interests` | array<string> | optional | — |
| `profile.learningGoals` | array<string> | optional | — |
| `auth_methods` | array<string> | required | — |
| `id` | string | required | — |
| `display_name` | string | required | — |
| `username` | null / anyOf / string | required | — |
| `email` | null / anyOf / string | required | — |
| `email_verified` | boolean | required | — |
| `avatar_url` | null / anyOf / string | required | — |
| `roles` | array<string> | required | — |
| `origin` | string | required | enum: ["self_email","google","admin_created"] |
| `status` | string | required | enum: ["pending","active"] |
| `created_at` | string | required | — |

<a id="schema-adminuserpage"></a>

### AdminUserPage

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `items` | array<[AdminUserSummary](#schema-adminusersummary)> | required | — |
| `next_cursor` | string / anyOf / null | required | — |

<a id="schema-adminusersummary"></a>

### AdminUserSummary

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | minLength: 1 |
| `display_name` | string | required | — |
| `username` | string / anyOf / null | required | — |
| `email` | string / anyOf / null | required | — |
| `email_verified` | boolean | required | — |
| `avatar_url` | string / anyOf / null | required | — |
| `roles` | array<string> | required | — |
| `origin` | string | required | enum: ["self_email","google","admin_created"] |
| `status` | string | required | enum: ["active","pending"] |
| `created_at` | string | required | format: "date-time" |

<a id="schema-adminusersummarydto"></a>

### AdminUserSummaryDto

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `display_name` | string | required | — |
| `username` | null / anyOf / string | required | — |
| `email` | null / anyOf / string | required | — |
| `email_verified` | boolean | required | — |
| `avatar_url` | null / anyOf / string | required | — |
| `roles` | array<string> | required | — |
| `origin` | string | required | enum: ["self_email","google","admin_created"] |
| `status` | string | required | enum: ["pending","active"] |
| `created_at` | string | required | — |

<a id="schema-aiconversationcreaterequest"></a>

### AiConversationCreateRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `title` | string | optional | minLength: 1; maxLength: 80 |
| `course_id` | string | optional | minLength: 1 |

<a id="schema-aiconversationpage"></a>

### AiConversationPage

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `items` | array<[WireAiConversation](#schema-wireaiconversation)> | required | — |
| `next_cursor` | string / anyOf / null | required | — |

<a id="schema-aiconversationpatchrequest"></a>

### AiConversationPatchRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `title` | string | required | minLength: 1; maxLength: 80 |

<a id="schema-aimessagepage"></a>

### AiMessagePage

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `items` | array<[WireAiMessage](#schema-wireaimessage)> | required | — |
| `next_cursor` | string / anyOf / null | required | — |

<a id="schema-aimessagerequest"></a>

### AiMessageRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `content` | string | required | minLength: 1; maxLength: 4000 |
| `request_id` | string | required | minLength: 8; maxLength: 64 |
| `course_id` | string | optional | minLength: 1 |

<a id="schema-aimessageresponse"></a>

### AiMessageResponse

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `message` | [WireAiMessage](#schema-wireaimessage) | required | — |
| `usage` | [WireAiUsage](#schema-wireaiusage) | required | — |

<a id="schema-aipracticeanswerrequest"></a>

### AiPracticeAnswerRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `question_id` | string | required | minLength: 1 |
| `option_id` | string | required | minLength: 1 |

<a id="schema-aisupportrequest"></a>

### AiSupportRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `ai_enabled` | boolean | required | — |

<a id="schema-aisupportresponse"></a>

### AiSupportResponse

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `course_id` | string | required | minLength: 1 |
| `ai_enabled` | boolean | required | — |

<a id="schema-alreadyenrolledcheckout"></a>

### AlreadyEnrolledCheckout

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `already_enrolled` | object | required | const: true |
| `course_id` | string | required | minLength: 1 |
| `enrollment` | [EnrollmentDto](#schema-enrollmentdto) | required | — |

<a id="schema-assigninstructorresponse"></a>

### AssignInstructorResponse

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `user` | [CurrentUser](#schema-currentuser) | required | — |
| `added_by` | string / anyOf / null | required | — |
| `added_at` | string / anyOf / null | required | — |

<a id="schema-authoringchapterdto"></a>

### AuthoringChapterDto

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `title` | string | required | — |
| `description` | string | optional | — |
| `items` | array<[AuthoringItemDto](#schema-authoringitemdto)> | required | — |

<a id="schema-authoringchapterwrite"></a>

### AuthoringChapterWrite

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | optional | — |
| `title` | string | required | — |
| `description` | string | optional | — |
| `items` | array<[AuthoringItemWrite](#schema-authoringitemwrite)> | required | — |

<a id="schema-authoringcoursedto"></a>

### AuthoringCourseDto

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `slug` | string | required | — |
| `title` | string | required | — |
| `subtitle` | null / anyOf / string | required | — |
| `description` | null / anyOf / string | required | — |
| `cover_url` | null / anyOf / string | required | — |
| `category` | string | required | — |
| `level` | string | required | — |
| `price` | null / anyOf / [Money](#schema-money) | required | — |
| `outcomes` | array<string> | required | — |
| `instructor` | object | required | ไม่รับ field นอก schema |
| `instructor.id` | string | required | — |
| `instructor.display_name` | string | required | — |
| `instructor.avatar_url` | null / anyOf / string | required | — |
| `chapters` | array<[AuthoringChapterDto](#schema-authoringchapterdto)> | required | — |
| `status` | string | required | enum: ["pending_review","approved","draft","published","archived"] |
| `revision` | integer | required | minimum: 1 |
| `published_at` | null / anyOf / string | required | — |
| `published_by` | null / anyOf / string | required | — |
| `created_by` | string | required | — |
| `created_at` | string | required | — |
| `updated_at` | string | required | — |
| `latest_review` | null / anyOf / [CourseReviewDto](#schema-coursereviewdto) | required | — |
| `ai_enabled` | boolean | required | — |
| `enrollment_count` | number | required | — |

<a id="schema-authoringitemdto"></a>

### AuthoringItemDto

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `type` | string | required | enum: ["video","article","quiz"] |
| `title` | string | required | — |
| `video_url` | string | optional | — |
| `body` | string | optional | — |
| `body_doc` | null / anyOf / string / anyOf / number / anyOf / boolean / anyOf / boolean / anyOf / array<[JsonValue](#schema-jsonvalue)> / anyOf / object<string, [JsonValue](#schema-jsonvalue)> | optional | — |
| `description` | string | optional | — |
| `duration` | string | optional | — |
| `reading_minutes` | number | optional | — |
| `quiz` | object | optional | ไม่รับ field นอก schema |
| `quiz.questions` | array<[AuthoringQuestionDto](#schema-authoringquestiondto)> | required | — |
| `quiz.pass_percent` | number | required | — |
| `has_history` | boolean | required | — |
| `has_ai_transcript` | boolean | optional | — |

<a id="schema-authoringitemwrite"></a>

### AuthoringItemWrite

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | optional | — |
| `quiz` | object | optional | ไม่รับ field นอก schema |
| `quiz.questions` | array<[AuthoringQuestionWrite](#schema-authoringquestionwrite)> | required | — |
| `quiz.pass_percent` | number | required | — |
| `type` | string | required | enum: ["video","article","quiz"] |
| `title` | string | required | — |
| `description` | string | optional | — |
| `video_url` | string | optional | — |
| `body` | string | optional | — |
| `body_doc` | null / anyOf / string / anyOf / number / anyOf / boolean / anyOf / boolean / anyOf / array<[JsonValue](#schema-jsonvalue)> / anyOf / object<string, [JsonValue](#schema-jsonvalue)> | optional | — |
| `duration` | string | optional | — |
| `reading_minutes` | number | optional | — |

<a id="schema-authoringpreview"></a>

### AuthoringPreview

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | minLength: 1 |
| `title` | string | required | — |
| `revision` | integer | required | minimum: 1 |
| `chapters` | array<object> | required | — |
| `chapters[].id` | string | required | minLength: 1 |
| `chapters[].title` | string | required | — |
| `chapters[].items` | array<[PreviewItem](#schema-previewitem)> | required | — |

<a id="schema-authoringquestiondto"></a>

### AuthoringQuestionDto

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `type` | string | required | enum: ["single_choice","multiple_choice","essay","image"] |
| `prompt` | string | required | — |
| `points` | number | required | — |
| `prompt_doc` | null / anyOf / string / anyOf / number / anyOf / boolean / anyOf / boolean / anyOf / array<[JsonValue](#schema-jsonvalue)> / anyOf / object<string, [JsonValue](#schema-jsonvalue)> | optional | — |
| `rubric` | null / anyOf / string | optional | — |
| `response_mode` | string | optional | enum: ["image","text","either"] |
| `options` | array<object> | optional | — |
| `options[].id` | string | required | — |
| `options[].text` | string | required | — |
| `correct_option_ids` | array<string> | optional | — |

<a id="schema-authoringquestionwrite"></a>

### AuthoringQuestionWrite

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | optional | — |
| `options` | array<object> | optional | — |
| `options[].id` | string | optional | — |
| `options[].text` | string | required | — |
| `correct_option_indices` | array<number> | optional | — |
| `type` | string | required | enum: ["single_choice","multiple_choice","essay","image"] |
| `prompt` | string | required | — |
| `points` | number | required | — |
| `prompt_doc` | null / anyOf / string / anyOf / number / anyOf / boolean / anyOf / boolean / anyOf / array<[JsonValue](#schema-jsonvalue)> / anyOf / object<string, [JsonValue](#schema-jsonvalue)> | optional | — |
| `rubric` | null / anyOf / string | optional | — |
| `response_mode` | string | optional | enum: ["image","text","either"] |

<a id="schema-blogcreaterequest"></a>

### BlogCreateRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `title` | string | required | minLength: 1; maxLength: 120 |
| `slug` | string | required | pattern: "^[a-z0-9-]{3,80}$" |
| `category` | string | optional | maxLength: 40 |
| `cover_url` | string / anyOf / null | optional | — |
| `excerpt` | string / anyOf / null | optional | — |
| `content` | string | required | maxLength: 200000 |
| `content_doc` | [JsonValue](#schema-jsonvalue) | optional | — |

<a id="schema-blogpatchrequest"></a>

### BlogPatchRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `title` | string | optional | minLength: 1; maxLength: 120 |
| `slug` | string | optional | pattern: "^[a-z0-9-]{3,80}$" |
| `category` | string | optional | maxLength: 40 |
| `cover_url` | string / anyOf / null | optional | — |
| `excerpt` | string / anyOf / null | optional | — |
| `content` | string | optional | maxLength: 200000 |
| `content_doc` | [JsonValue](#schema-jsonvalue) | optional | — |
| `expected_revision` | integer | required | minimum: 1 |

<a id="schema-blogpoststatus"></a>

### BlogPostStatus

Type: string. enum: ["draft","published"]

Schema definition:

```json
{
  "type": "string",
  "enum": [
    "draft",
    "published"
  ]
}
```

<a id="schema-blogrevisionrequest"></a>

### BlogRevisionRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `expected_revision` | integer | required | minimum: 1 |

<a id="schema-blogwriterequest"></a>

### BlogWriteRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `title` | string | required | maxLength: 120 |
| `slug` | string | required | — |
| `category` | string | required | maxLength: 40 |
| `cover_url` | null / anyOf / string | required | — |
| `excerpt` | null / anyOf / string | required | — |
| `content` | string | required | maxLength: 200000 |
| `content_doc` | [JsonValue](#schema-jsonvalue) | required | — |
| `expected_revision` | number | optional | — |

<a id="schema-certificatedownload"></a>

### CertificateDownload

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `filename` | string | required | — |
| `content_type` | string | required | enum: ["text/plain"] |
| `content` | string | required | — |

<a id="schema-certificatepage"></a>

### CertificatePage

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `items` | array<[WireServerCertificate](#schema-wireservercertificate)> | required | — |
| `next_cursor` | string / anyOf / null | required | — |

<a id="schema-checkoutrequest"></a>

### CheckoutRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `course_id` | string | required | minLength: 1 |
| `request_id` | string | required | minLength: 1; maxLength: 64 |

<a id="schema-checkoutresponse"></a>

### CheckoutResponse

Type: [WireCheckoutResult](#schema-wirecheckoutresult) / anyOf / [AlreadyEnrolledCheckout](#schema-alreadyenrolledcheckout). —

Schema definition:

```json
{
  "anyOf": [
    {
      "$ref": "#/components/schemas/WireCheckoutResult"
    },
    {
      "$ref": "#/components/schemas/AlreadyEnrolledCheckout"
    }
  ]
}
```

<a id="schema-completeresponse"></a>

### CompleteResponse

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `item_id` | string | required | minLength: 1 |
| `completed_at` | string | required | format: "date-time" |
| `progress` | [ProgressSummary](#schema-progresssummary) | required | — |
| `course_completed_at` | string / anyOf / null | required | — |
| `certificate_id` | string / anyOf / null | required | — |

<a id="schema-coursedetail"></a>

### CourseDetail

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | minLength: 1 |
| `slug` | string | required | — |
| `title` | string | required | — |
| `subtitle` | string / anyOf / null | required | — |
| `cover_url` | string / anyOf / null | required | — |
| `category` | string | required | — |
| `level` | string | required | — |
| `price` | [Money](#schema-money) / anyOf / null | required | — |
| `instructor` | [InstructorSummary](#schema-instructorsummary) | required | — |
| `published_at` | string | required | format: "date-time" |
| `description` | string / anyOf / null | required | — |
| `outcomes` | array<string> | required | — |
| `outline` | array<[CourseOutlineChapterSummary](#schema-courseoutlinechaptersummary)> | required | — |

<a id="schema-coursemetadatarequest"></a>

### CourseMetadataRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `title` | string | required | minLength: 1; maxLength: 120 |
| `subtitle` | null / anyOf / string | optional | — |
| `description` | null / anyOf / string | optional | — |
| `cover_url` | null / anyOf / string | optional | — |
| `category` | string | optional | maxLength: 80 |
| `level` | string | optional | maxLength: 80 |
| `price` | null / anyOf / [Money](#schema-money) | optional | — |
| `outcomes` | array<string> | optional | — |

<a id="schema-courseoutlinechaptersummary"></a>

### CourseOutlineChapterSummary

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | minLength: 1 |
| `title` | string | required | — |
| `items` | array<[CourseOutlineItemSummary](#schema-courseoutlineitemsummary)> | required | — |

<a id="schema-courseoutlineitemsummary"></a>

### CourseOutlineItemSummary

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | minLength: 1 |
| `type` | string | required | enum: ["article","video","quiz"] |
| `title` | string | required | — |

<a id="schema-coursepage"></a>

### CoursePage

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `items` | array<[CourseSummary](#schema-coursesummary)> | required | — |
| `next_cursor` | string / anyOf / null | required | — |

<a id="schema-coursepatchrequest"></a>

### CoursePatchRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `expected_revision` | integer | required | minimum: 1 |
| `instructor_id` | string | optional | — |
| `chapters` | array<[AuthoringChapterWrite](#schema-authoringchapterwrite)> | optional | — |
| `title` | string | optional | minLength: 1; maxLength: 120 |
| `subtitle` | null / anyOf / string | optional | — |
| `description` | null / anyOf / string | optional | — |
| `cover_url` | null / anyOf / string | optional | — |
| `category` | string | optional | maxLength: 80 |
| `level` | string | optional | maxLength: 80 |
| `price` | null / anyOf / [Money](#schema-money) | optional | — |
| `outcomes` | array<string> | optional | — |

<a id="schema-coursereturnrequest"></a>

### CourseReturnRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `reason` | string | required | — |

<a id="schema-coursereviewdto"></a>

### CourseReviewDto

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `revision` | integer | required | minimum: 1 |
| `status` | string | required | enum: ["pending","approved","returned","stale"] |
| `submitted_by` | string | required | — |
| `submitted_at` | string | required | — |
| `decided_by` | null / anyOf / string | required | — |
| `decided_at` | null / anyOf / string | required | — |
| `reason` | null / anyOf / string | required | — |

<a id="schema-coursereviewrequest"></a>

### CourseReviewRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `expected_revision` | integer | required | minimum: 1 |

<a id="schema-coursesummary"></a>

### CourseSummary

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | minLength: 1 |
| `slug` | string | required | — |
| `title` | string | required | — |
| `subtitle` | string / anyOf / null | required | — |
| `cover_url` | string / anyOf / null | required | — |
| `category` | string | required | — |
| `level` | string | required | — |
| `price` | [Money](#schema-money) / anyOf / null | required | — |
| `instructor` | [InstructorSummary](#schema-instructorsummary) | required | — |
| `published_at` | string | required | format: "date-time" |

<a id="schema-currentuser"></a>

### CurrentUser

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | minLength: 1 |
| `display_name` | string | required | — |
| `username` | string / anyOf / null | required | — |
| `email` | string / anyOf / null | required | — |
| `email_verified` | boolean | required | — |
| `avatar_url` | string / anyOf / null | required | — |
| `roles` | array<string> | required | — |
| `origin` | string | required | enum: ["self_email","google","admin_created"] |
| `auth_methods` | array<string> | required | — |
| `learning_eligible` | boolean | required | — |
| `profile` | [AccountProfile](#schema-accountprofile) | required | — |

<a id="schema-dashboarddto"></a>

### DashboardDto

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `course_count` | number | required | — |
| `enrollment_count` | number | required | — |
| `learner_count` | number | required | — |
| `pending_grading_count` | number | required | — |
| `user_count` | number | optional | — |
| `pending_course_count` | number | optional | — |

<a id="schema-deletedblogresponse"></a>

### DeletedBlogResponse

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | minLength: 1 |
| `deleted` | object | required | const: true |

<a id="schema-emptyrequest"></a>

### EmptyRequest

Type: object. ไม่รับ field นอก schema

Schema definition:

```json
{
  "type": "object",
  "properties": {},
  "required": [],
  "additionalProperties": false
}
```

<a id="schema-enrollmentdto"></a>

### EnrollmentDto

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | minLength: 1 |
| `course_id` | string | required | minLength: 1 |
| `source` | string | required | enum: ["free","stripe","redeem"] |
| `access` | string | required | enum: ["lifetime"] |
| `granted_at` | string | required | format: "date-time" |

<a id="schema-enrollmentlistitem"></a>

### EnrollmentListItem

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `enrollment` | [EnrollmentDto](#schema-enrollmentdto) | required | — |
| `course` | [CourseSummary](#schema-coursesummary) | required | — |
| `progress` | [ProgressSummary](#schema-progresssummary) | required | — |

<a id="schema-enrollmentpage"></a>

### EnrollmentPage

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `items` | array<[EnrollmentListItem](#schema-enrollmentlistitem)> | required | — |
| `next_cursor` | string / anyOf / null | required | — |

<a id="schema-errorenvelope"></a>

### ErrorEnvelope

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `error` | object | required | ไม่รับ field นอก schema |
| `error.code` | string | required | minLength: 1 |
| `error.message` | string | required | — |
| `error.request_id` | string | required | minLength: 1 |
| `error.details` | [ResourceErrorDetails](#schema-resourceerrordetails) | optional | — |

<a id="schema-gradingqueuepage"></a>

### GradingQueuePage

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `items` | array<[WireGradingQueueItem](#schema-wiregradingqueueitem)> | required | — |
| `next_cursor` | string / anyOf / null | required | — |

<a id="schema-instructorpage"></a>

### InstructorPage

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `items` | array<[InstructorSummary](#schema-instructorsummary)> | required | — |
| `next_cursor` | string / anyOf / null | required | — |

<a id="schema-instructorsummary"></a>

### InstructorSummary

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | minLength: 1 |
| `display_name` | string | required | — |
| `avatar_url` | string / anyOf / null | required | — |

<a id="schema-issuecodesrequest"></a>

### IssueCodesRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `course_id` | string | required | minLength: 1 |
| `count` | integer | optional | minimum: 1; maximum: 50 |

<a id="schema-issuedcodesresponse"></a>

### IssuedCodesResponse

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `items` | array<object> | required | — |
| `items[].id` | string | required | minLength: 1 |
| `items[].code` | string | required | minLength: 1 |
| `items[].course_id` | string | required | minLength: 1 |
| `items[].status` | string | required | enum: ["unused"] |
| `items[].created_at` | string | required | format: "date-time" |

<a id="schema-jsonvalue"></a>

### JsonValue

Type: string / anyOf / number / anyOf / boolean / anyOf / null / anyOf / array<[JsonValue](#schema-jsonvalue)> / anyOf / object<string, [JsonValue](#schema-jsonvalue)>. —

Schema definition:

```json
{
  "anyOf": [
    {
      "type": "string"
    },
    {
      "type": "number"
    },
    {
      "type": "boolean"
    },
    {
      "type": "null"
    },
    {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/JsonValue"
      }
    },
    {
      "type": "object",
      "additionalProperties": {
        "$ref": "#/components/schemas/JsonValue"
      }
    }
  ]
}
```

<a id="schema-learnerrosterdto"></a>

### LearnerRosterDto

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `course_id` | string | required | — |
| `user_id` | string | required | — |
| `learner_display_name` | string | required | — |
| `granted_at` | string | required | — |
| `completed_items` | number | required | — |
| `total_items` | number | required | — |
| `percent` | number | required | — |
| `completed_at` | null / anyOf / string | required | — |
| `certificate` | null / anyOf / object | required | — |

<a id="schema-loginrequest"></a>

### LoginRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `identifier` | string | required | minLength: 1 |
| `password` | string | required | minLength: 1 |
| `audience` | string | required | enum: ["web","admin"] |

<a id="schema-loginresponse"></a>

### LoginResponse

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `user` | [CurrentUser](#schema-currentuser) | required | — |

<a id="schema-managedattemptdto"></a>

### ManagedAttemptDto

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `course_id` | string | required | — |
| `item_id` | string | required | — |
| `user_id` | string | required | — |
| `learner_display_name` | string | required | — |
| `status` | string | required | enum: ["in_progress","pending_review","graded","submitted"] |
| `started_at` | string | required | — |
| `submitted_at` | null / anyOf / string | required | — |
| `graded_at` | null / anyOf / string | required | — |
| `earned` | null / anyOf / number | required | — |
| `max` | number | required | — |
| `passed` | null / anyOf / boolean / anyOf / boolean | required | — |
| `choice_earned` | number | required | — |
| `choice_max` | number | required | — |
| `questions` | array<[ManagedQuestion](#schema-managedquestion)> | required | — |
| `answers` | object<string, object> | required | — |
| `grades` | object<string, object> | required | — |

<a id="schema-managedattemptpage"></a>

### ManagedAttemptPage

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `items` | array<[ManagedAttemptDto](#schema-managedattemptdto)> | required | — |
| `next_cursor` | string / anyOf / null | required | — |

<a id="schema-managedcoursepage"></a>

### ManagedCoursePage

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `items` | array<[ManagedCourseSummaryDto](#schema-managedcoursesummarydto)> | required | — |
| `next_cursor` | string / anyOf / null | required | — |

<a id="schema-managedcoursesummarydto"></a>

### ManagedCourseSummaryDto

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `chapters` | array<object> | required | — |
| `chapters[].id` | string | required | — |
| `chapters[].title` | string | required | — |
| `chapters[].items` | array<object> | required | — |
| `chapters[].items[].id` | string | required | — |
| `chapters[].items[].type` | string | required | enum: ["video","article","quiz"] |
| `chapters[].items[].title` | string | required | — |
| `chapters[].items[].quiz` | object | optional | ไม่รับ field นอก schema |
| `chapters[].items[].quiz.question_count` | number | required | — |
| `chapters[].items[].quiz.pass_percent` | number | required | — |
| `chapters[].items[].quiz.attempt_count` | number | required | — |
| `chapters[].items[].has_history` | boolean | required | — |
| `id` | string | required | — |
| `slug` | string | required | — |
| `title` | string | required | — |
| `subtitle` | null / anyOf / string | required | — |
| `description` | null / anyOf / string | required | — |
| `cover_url` | null / anyOf / string | required | — |
| `category` | string | required | — |
| `level` | string | required | — |
| `price` | null / anyOf / [Money](#schema-money) | required | — |
| `outcomes` | array<string> | required | — |
| `instructor` | object | required | ไม่รับ field นอก schema |
| `instructor.id` | string | required | — |
| `instructor.display_name` | string | required | — |
| `instructor.avatar_url` | null / anyOf / string | required | — |
| `status` | string | required | enum: ["pending_review","approved","draft","published","archived"] |
| `revision` | number | required | — |
| `published_at` | null / anyOf / string | required | — |
| `published_by` | null / anyOf / string | required | — |
| `created_by` | string | required | — |
| `created_at` | string | required | — |
| `updated_at` | string | required | — |
| `latest_review` | null / anyOf / [CourseReviewDto](#schema-coursereviewdto) | required | — |
| `ai_enabled` | boolean | required | — |
| `enrollment_count` | number | required | — |

<a id="schema-managedquestion"></a>

### ManagedQuestion

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `type` | string | required | enum: ["single_choice","multiple_choice","essay","image"] |
| `prompt` | string | required | — |
| `points` | number | required | — |
| `prompt_doc` | null / anyOf / string / anyOf / number / anyOf / boolean / anyOf / boolean / anyOf / array<[JsonValue](#schema-jsonvalue)> / anyOf / object<string, [JsonValue](#schema-jsonvalue)> | optional | — |
| `rubric` | null / anyOf / string | optional | — |
| `response_mode` | string | optional | enum: ["image","text","either"] |
| `options` | array<object> | optional | — |
| `options[].id` | string | required | — |
| `options[].text` | string | required | — |

<a id="schema-managedquizlocator"></a>

### ManagedQuizLocator

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `course_id` | string | required | minLength: 1 |
| `item_id` | string | required | minLength: 1 |

<a id="schema-money"></a>

### Money

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `amount_minor` | integer | required | minimum: 0 |
| `currency` | string | required | const: "THB"; Current Frontend Draft/mock supports THB only; additional currencies require contract review. |

<a id="schema-passwordchangedresponse"></a>

### PasswordChangedResponse

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `status` | string | required | enum: ["password_changed"] |

<a id="schema-passwordresetconfirmrequest"></a>

### PasswordResetConfirmRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `token` | string | required | minLength: 1 |
| `new_password` | string | required | minLength: 8; maxLength: 128 |

<a id="schema-passwordresetrequest"></a>

### PasswordResetRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `identifier` | string | required | minLength: 1 |

<a id="schema-previewitem"></a>

### PreviewItem

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `type` | string | required | enum: ["video","article","quiz"] |
| `title` | string | required | — |
| `video_url` | string | optional | — |
| `body` | string | optional | — |
| `body_doc` | null / anyOf / string / anyOf / number / anyOf / boolean / anyOf / boolean / anyOf / array<[JsonValue](#schema-jsonvalue)> / anyOf / object<string, [JsonValue](#schema-jsonvalue)> | optional | — |
| `description` | string | optional | — |
| `duration` | string | optional | — |
| `reading_minutes` | number | optional | — |
| `quiz` | object | optional | ไม่รับ field นอก schema |
| `quiz.questions` | array<[ManagedQuestion](#schema-managedquestion)> | required | — |
| `quiz.pass_percent` | number | required | — |
| `has_history` | boolean | required | — |
| `has_ai_transcript` | boolean | optional | — |

<a id="schema-progresspage"></a>

### ProgressPage

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `items` | array<[ProgressRow](#schema-progressrow)> | required | — |
| `next_cursor` | string / anyOf / null | required | — |

<a id="schema-progressrow"></a>

### ProgressRow

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `course_id` | string | required | minLength: 1 |
| `enrollment_id` | string | required | minLength: 1 |
| `progress` | [ProgressSummary](#schema-progresssummary) | required | — |
| `resume_item_id` | string / anyOf / null | required | — |
| `completed_at` | string / anyOf / null | required | — |

<a id="schema-progresssummary"></a>

### ProgressSummary

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `completed_items` | integer | required | minimum: 0 |
| `total_items` | integer | required | minimum: 0 |
| `completed_at` | string / anyOf / null | required | — |

<a id="schema-publicblogdetail"></a>

### PublicBlogDetail

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `content` | string | required | — |
| `content_doc` | [JsonValue](#schema-jsonvalue) | required | — |
| `id` | string | required | — |
| `slug` | string | required | — |
| `title` | string | required | — |
| `cover_url` | null / anyOf / string | required | — |
| `excerpt` | null / anyOf / string | required | — |
| `published_at` | null / anyOf / string | required | — |
| `category` | string | required | — |
| `reading_minutes` | number | required | — |
| `author` | object | required | ไม่รับ field นอก schema |
| `author.id` | string | required | — |
| `author.display_name` | string | required | — |

<a id="schema-publicblogpage"></a>

### PublicBlogPage

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `items` | array<[PublicBlogSummary](#schema-publicblogsummary)> | required | — |
| `next_cursor` | null / anyOf / string | required | — |

<a id="schema-publicblogsummary"></a>

### PublicBlogSummary

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `slug` | string | required | — |
| `title` | string | required | — |
| `cover_url` | null / anyOf / string | required | — |
| `excerpt` | null / anyOf / string | required | — |
| `published_at` | null / anyOf / string | required | — |
| `category` | string | required | — |
| `reading_minutes` | number | required | — |
| `author` | object | required | ไม่รับ field นอก schema |
| `author.id` | string | required | — |
| `author.display_name` | string | required | — |

<a id="schema-publicinstructorcoursepage"></a>

### PublicInstructorCoursePage

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `items` | array<[CourseDetail](#schema-coursedetail)> | required | — |
| `next_cursor` | string / anyOf / null | required | — |

<a id="schema-publicinstructordto"></a>

### PublicInstructorDto

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `display_name` | string | required | — |
| `avatar_url` | null / anyOf / string | required | — |
| `bio` | null / anyOf / string | required | — |

<a id="schema-questiongraderequest"></a>

### QuestionGradeRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `score` | number | required | minimum: 0 |
| `comment` | null / anyOf / string | required | — |

<a id="schema-quizresults"></a>

### QuizResults

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `attempts` | array<object> | required | — |
| `attempts[].attempt_id` | string | required | minLength: 1 |
| `attempts[].number` | integer | required | minimum: 1 |
| `attempts[].status` | string | required | enum: ["in_progress","pending_review","graded"] |
| `attempts[].submitted_at` | string / anyOf / null | required | — |
| `attempts[].graded_at` | string / anyOf / null | required | — |
| `attempts[].earned` | number / anyOf / null | required | — |
| `attempts[].max` | number | required | — |
| `attempts[].percent` | number / anyOf / null | required | — |
| `attempts[].passed` | boolean / anyOf / null | required | — |
| `best` | object / anyOf / null | required | — |
| `completed` | boolean | required | — |

<a id="schema-redeemcodepage"></a>

### RedeemCodePage

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `items` | array<[WireAdminRedeemCode](#schema-wireadminredeemcode)> | required | — |
| `next_cursor` | string / anyOf / null | required | — |

<a id="schema-redeemrequest"></a>

### RedeemRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `code` | string | required | minLength: 1 |

<a id="schema-registerrequest"></a>

### RegisterRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `display_name` | string | required | minLength: 1; maxLength: 80 |
| `email` | string | required | minLength: 1; maxLength: 254 |
| `password` | string | required | minLength: 8; maxLength: 128 |

<a id="schema-registerresponse"></a>

### RegisterResponse

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `user` | [CurrentUser](#schema-currentuser) | required | — |
| `verification_email` | string | required | enum: ["queued"] |

<a id="schema-resendverificationrequest"></a>

### ResendVerificationRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `email` | string | optional | minLength: 1; maxLength: 254 |

<a id="schema-resourceerrordetails"></a>

### ResourceErrorDetails

Type: object. —

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `fields` | array<[ResourceValidationField](#schema-resourcevalidationfield)> | optional | — |
| `current_revision` | number | optional | — |

<a id="schema-resourcevalidationfield"></a>

### ResourceValidationField

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `field` | string | required | — |
| `code` | string | required | — |

<a id="schema-resume"></a>

### Resume

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `position_seconds` | number / anyOf / null | required | — |
| `updated_at` | string | required | format: "date-time" |

<a id="schema-resumerequest"></a>

### ResumeRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `position_seconds` | number / anyOf / null | optional | — |

<a id="schema-resumeresponse"></a>

### ResumeResponse

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `item_id` | string | required | minLength: 1 |
| `resume` | [Resume](#schema-resume) | required | — |

<a id="schema-reviewdetail"></a>

### ReviewDetail

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `revision` | number | required | — |
| `status` | string | required | enum: ["pending","approved","returned","stale"] |
| `submitted_by` | string | required | — |
| `submitted_at` | string | required | — |
| `decided_by` | null / anyOf / string | required | — |
| `decided_at` | null / anyOf / string | required | — |
| `reason` | null / anyOf / string | required | — |
| `course` | [AuthoringCourseDto](#schema-authoringcoursedto) | required | — |

<a id="schema-reviewpage"></a>

### ReviewPage

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `items` | array<[ReviewSummary](#schema-reviewsummary)> | required | — |
| `next_cursor` | string / anyOf / null | required | — |

<a id="schema-reviewsummary"></a>

### ReviewSummary

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `revision` | number | required | — |
| `status` | string | required | enum: ["pending","approved","returned","stale"] |
| `submitted_by` | string | required | — |
| `submitted_at` | string | required | — |
| `decided_by` | null / anyOf / string | required | — |
| `decided_at` | null / anyOf / string | required | — |
| `reason` | null / anyOf / string | required | — |
| `course` | [ManagedCourseSummaryDto](#schema-managedcoursesummarydto) | required | — |

<a id="schema-revokecoderesponse"></a>

### RevokeCodeResponse

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | minLength: 1 |
| `status` | string | required | enum: ["revoked"] |
| `revoked_at` | string | required | format: "date-time" |

<a id="schema-rosterpage"></a>

### RosterPage

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `items` | array<[LearnerRosterDto](#schema-learnerrosterdto)> | required | — |
| `next_cursor` | string / anyOf / null | required | — |

<a id="schema-saveanswersrequest"></a>

### SaveAnswersRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `answers` | object<string, object> | required | — |

<a id="schema-transcriptrequest"></a>

### TranscriptRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `text` | string | required | maxLength: 200000 |

<a id="schema-updateprofilerequest"></a>

### UpdateProfileRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `display_name` | string | optional | minLength: 1; maxLength: 80 |
| `avatar_url` | string / anyOf / null | optional | — |
| `username` | string | optional | pattern: "^[A-Za-z0-9_.]{3,30}$" |
| `profile` | [AccountProfilePatch](#schema-accountprofilepatch) | optional | — |

<a id="schema-verifyemailrequest"></a>

### VerifyEmailRequest

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `token` | string | required | minLength: 1 |

<a id="schema-verifyemailresponse"></a>

### VerifyEmailResponse

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `status` | string | required | enum: ["verified","already_verified"] |
| `user` | [CurrentUser](#schema-currentuser) | optional | — |

<a id="schema-wireadminaiauthoring"></a>

### WireAdminAiAuthoring

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `title` | string | required | — |
| `status` | string | required | — |
| `ai_enabled` | boolean | required | — |
| `chapters` | array<object> | required | — |
| `chapters[].id` | string | required | — |
| `chapters[].title` | string | required | — |
| `chapters[].items` | array<[WireAdminAiVideo](#schema-wireadminaivideo)> | required | — |

<a id="schema-wireadminaicourse"></a>

### WireAdminAiCourse

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `title` | string | required | — |
| `status` | string | required | — |

<a id="schema-wireadminaivideo"></a>

### WireAdminAiVideo

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `title` | string | required | — |
| `type` | string | required | enum: ["video","article","quiz"] |
| `has_ai_transcript` | boolean | required | — |

<a id="schema-wireadminpayment"></a>

### WireAdminPayment

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `payment_id` | string | required | — |
| `course_id` | string | required | — |
| `user_id` | string | required | — |
| `request_id` | string | required | — |
| `checkout_session_id` | string | required | — |
| `amount` | [Money](#schema-money) | required | — |
| `status` | string | required | enum: ["pending","processing","succeeded","failed","cancelled","expired"] |
| `fulfillment_status` | string | required | enum: ["pending","failed","granted"] |
| `enrollment` | [EnrollmentDto](#schema-enrollmentdto) / anyOf / null | required | — |
| `created_at` | string | required | — |
| `events` | array<object> | required | — |
| `events[].event_id` | string | required | — |
| `events[].type` | string | required | — |
| `events[].received_at` | string | required | — |
| `events[].processed_at` | null / anyOf / string | required | — |
| `events[].outcome` | string | required | — |

<a id="schema-wireadminredeemcode"></a>

### WireAdminRedeemCode

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `code_masked` | string | required | — |
| `course_id` | string | required | — |
| `status` | string | required | enum: ["unused","used","revoked"] |
| `created_at` | string | required | — |
| `used_by` | null / anyOf / string | required | — |
| `used_at` | null / anyOf / string | required | — |
| `revoked_at` | null / anyOf / string | required | — |

<a id="schema-wireadmintranscript"></a>

### WireAdminTranscript

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `item_id` | string | required | — |
| `text` | string | required | — |
| `edited_by` | null / anyOf / string | required | — |
| `edited_at` | null / anyOf / string | required | — |

<a id="schema-wireaicontextcourse"></a>

### WireAiContextCourse

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `title` | string | required | — |

<a id="schema-wireaiconversation"></a>

### WireAiConversation

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `title` | string | required | — |
| `course_id` | null / anyOf / string | required | — |
| `created_at` | string | required | — |
| `updated_at` | string | required | — |

<a id="schema-wireaimessage"></a>

### WireAiMessage

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `role` | string | required | enum: ["user","assistant"] |
| `kind` | string | required | enum: ["text","practice_set"] |
| `content` | string | required | — |
| `status` | string | required | enum: ["pending","succeeded","failed"] |
| `request_id` | string | required | — |
| `created_at` | string | required | — |
| `completed_at` | null / anyOf / string | required | — |
| `error_code` | null / anyOf / string | required | — |
| `practice` | null / anyOf / object | required | — |

<a id="schema-wireaioption"></a>

### WireAiOption

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `text` | string | required | — |

<a id="schema-wireaipracticeanswer"></a>

### WireAiPracticeAnswer

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `question_id` | string | required | — |
| `correct` | boolean | required | — |
| `explanation` | string | required | — |
| `summary` | null / anyOf / object | required | — |

<a id="schema-wireaipracticequestion"></a>

### WireAiPracticeQuestion

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `prompt` | string | required | — |
| `options` | array<[WireAiOption](#schema-wireaioption)> | required | — |
| `answered` | boolean | required | — |
| `my_option_id` | string | optional | — |
| `result` | object | optional | ไม่รับ field นอก schema |
| `result.correct` | boolean | required | — |
| `result.explanation` | string | required | — |

<a id="schema-wireaiusage"></a>

### WireAiUsage

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `limit` | number | required | — |
| `used` | number | required | — |
| `remaining` | number | required | — |
| `reset_at` | string | required | — |

<a id="schema-wireattemptquestion"></a>

### WireAttemptQuestion

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `type` | string | required | enum: ["single_choice","multiple_choice","essay","image"] |
| `prompt` | string | required | — |
| `prompt_doc` | null / anyOf / string / anyOf / number / anyOf / boolean / anyOf / boolean / anyOf / array<[JsonValue](#schema-jsonvalue)> / anyOf / object<string, [JsonValue](#schema-jsonvalue)> | optional | — |
| `points` | number | required | — |
| `options` | array<object> | required | — |
| `options[].id` | string | required | — |
| `options[].text` | string | required | — |

<a id="schema-wireattemptview"></a>

### WireAttemptView

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `item_id` | string | required | — |
| `course_id` | string | required | — |
| `number` | number | required | — |
| `status` | string | required | enum: ["in_progress","pending_review","graded"] |
| `started_at` | string | required | — |
| `submitted_at` | null / anyOf / string | required | — |
| `graded_at` | null / anyOf / string | required | — |
| `questions` | array<[WireAttemptQuestion](#schema-wireattemptquestion)> | required | — |
| `answers` | object<string, object> | required | — |
| `max` | number | required | — |
| `earned` | null / anyOf / number | required | — |
| `percent` | null / anyOf / number | required | — |
| `passed` | null / anyOf / boolean / anyOf / boolean | required | — |
| `question_results` | null / anyOf / array<object> | required | — |

<a id="schema-wirecheckoutresult"></a>

### WireCheckoutResult

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `payment_id` | string | required | — |
| `checkout_url` | string | required | — |
| `already_enrolled` | object | required | const: false |

<a id="schema-wiregradingqueueitem"></a>

### WireGradingQueueItem

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `attempt_id` | string | required | — |
| `course_id` | string | required | — |
| `item_id` | string | required | — |
| `learner_display_name` | string | required | — |
| `submitted_at` | string | required | — |
| `questions_to_grade` | array<object> | required | — |
| `questions_to_grade[].question_id` | string | required | — |
| `questions_to_grade[].type` | string | required | enum: ["essay","image"] |
| `questions_to_grade[].prompt` | string | required | — |
| `questions_to_grade[].max` | number | required | — |
| `questions_to_grade[].answer` | object | required | ไม่รับ field นอก schema |
| `questions_to_grade[].answer.text` | string | optional | — |
| `questions_to_grade[].answer.image_url` | string | optional | — |
| `user_id` | string | required | minLength: 1 |

<a id="schema-wirelearningcourse"></a>

### WireLearningCourse

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | minLength: 1 |
| `title` | string | required | — |
| `subtitle` | string / anyOf / null | required | — |
| `cover_url` | string / anyOf / null | required | — |
| `category` | string | required | — |
| `level` | string | required | — |
| `instructor` | [InstructorSummary](#schema-instructorsummary) | required | — |
| `access` | object | required | ไม่รับ field นอก schema |
| `access.mode` | string | required | enum: ["enrolled"] |
| `access.enrollment` | [EnrollmentDto](#schema-enrollmentdto) | required | — |
| `outline` | array<object> | required | — |
| `outline[].id` | string | required | — |
| `outline[].title` | string | required | — |
| `outline[].items` | array<[WireLearningItem](#schema-wirelearningitem)> | required | — |
| `progress` | object | required | ไม่รับ field นอก schema |
| `progress.completed_items` | number | required | — |
| `progress.total_items` | number | required | — |
| `progress.completed_at` | null / anyOf / string | required | — |
| `resume_item_id` | null / anyOf / string | required | — |
| `certificate_id` | null / anyOf / string | required | — |
| `slug` | string | required | — |
| `price` | [Money](#schema-money) / anyOf / null | required | — |
| `published_at` | string | required | format: "date-time" |

<a id="schema-wirelearningenrollment"></a>

### WireLearningEnrollment

Type: [EnrollmentListItem](#schema-enrollmentlistitem). —

<a id="schema-wirelearningitem"></a>

### WireLearningItem

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `type` | string | required | enum: ["video","article","quiz"] |
| `title` | string | required | — |
| `completed_at` | null / anyOf / string | required | — |
| `resume` | object / anyOf / null | required | — |

<a id="schema-wirelearningitemcontent"></a>

### WireLearningItemContent

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `type` | string | required | enum: ["video","article","quiz"] |
| `title` | string | required | — |
| `video_url` | null / anyOf / string | optional | — |
| `body` | null / anyOf / string | optional | — |
| `body_doc` | null / anyOf / string / anyOf / number / anyOf / boolean / anyOf / boolean / anyOf / array<[JsonValue](#schema-jsonvalue)> / anyOf / object<string, [JsonValue](#schema-jsonvalue)> | optional | — |
| `quiz` | object | optional | ไม่รับ field นอก schema |
| `quiz.question_count` | number | required | — |
| `quiz.max_score` | number | required | — |

<a id="schema-wirepaymentview"></a>

### WirePaymentView

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `payment_id` | string | required | — |
| `course_id` | string | required | — |
| `status` | string | required | enum: ["pending","processing","succeeded","failed","cancelled","expired"] |
| `fulfillment_status` | string | required | enum: ["pending","failed","granted"] |
| `enrollment` | [EnrollmentDto](#schema-enrollmentdto) / anyOf / null | required | — |

<a id="schema-wireredeemadmincourse"></a>

### WireRedeemAdminCourse

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `title` | string | required | — |
| `price` | [Money](#schema-money) | required | — |

<a id="schema-wireredeemresult"></a>

### WireRedeemResult

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `already_enrolled` | boolean | required | — |
| `enrollment` | [EnrollmentDto](#schema-enrollmentdto) | required | — |

<a id="schema-wireservercertificate"></a>

### WireServerCertificate

Type: object. ไม่รับ field นอก schema

| Field | Type/schema | Required | Validation/description |
| --- | --- | --- | --- |
| `id` | string | required | — |
| `code` | string | required | — |
| `course_id` | string | required | — |
| `course_title` | string | required | — |
| `learner_name` | string | required | — |
| `issued_at` | string | required | — |
| `enrollment_id` | string | required | — |

## 8. แหล่งอ้างอิงและการอัปเดต

- [MELEARN_V1_SCOPE.md — Final 1.6](../MELEARN_V1_SCOPE.md) กติกาธุรกิจ
- [OpenAPI Draft](openapi.json) แหล่ง schema หลัก
- [API Contract Draft / decision register](API_CONTRACT_R4A_DRAFT_TH.md)
- [Flow A/B](API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) รายละเอียด auth/catalog
- [Mock limitations](../../melearn-tutor-frontend/docs/PROVISIONAL_API_MOCK_TH.md)
- [Acceptance matrix](../../melearn-tutor-frontend/docs/FRONTEND_API_ACCEPTANCE_MATRIX_TH.md) เกณฑ์ตรวจรับจริง

อัปเดต OpenAPI ก่อน แล้วรัน `node ../docs/api-contract/generate-handbook.mjs` เพื่อสร้าง Markdown นี้ใหม่; `node ../docs/api-contract/generate-handbook.mjs --check` ตรวจ drift. ไม่แก้ tables/JSON ในไฟล์ generated นี้โดยตรง. หากเปลี่ยน business/provider decisions ให้อัปเดต source + เอกสาร decision ที่เกี่ยวข้องพร้อมกัน.

<!-- source-sha256: c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3 -->
