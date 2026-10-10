# ข้อเสนอปิดคิวถัดไป — ยังไม่ถือว่าอนุมัติ

11 ต.ค. 2026. Git/Cloud SQL placement ปิดแล้วตามคำสั่งล่าสุด. หน้านี้รวม
**Proposed** ที่เหลือก่อนทำ browser/auth slice; ไม่เพิ่มกติกาธุรกิจใหม่ใน code.
Contract ยัง Draft และไม่ถูกแก้ในชุดงานนี้.

## ชุด A — Public Catalog / D16

รายละเอียดและ tests อยู่ [CATALOG_QUERY_REVIEW](CATALOG_QUERY_REVIEW.md).
ค้นชื่อคอร์สแบบ contains ไม่แยกตัวพิมพ์; เรียง published_at ใหม่ก่อนแล้ว id;
signed cursor ผูกตัวกรอง/limit และไม่มี time expiry. คง HTTP fields/paths เดิม.
อนุมัติชุดนี้ปลด CATALOG-01 → INTEGRATION-01 → CATALOG-02; early real UI gate
ต้องตรวจจาก frontend จริง ไม่ใช้ backend smoke เป็นผลแทน.

## ชุด B — Session และ local-account policy / D01–D02

| เรื่อง | Proposed ที่นำไป implement ได้ | ผลต่อ contract |
| --- | --- | --- |
| Audience | Cookie `melearn_web_session` / `melearn_admin_session`; session token สุ่ม 32 bytes, DB เก็บ SHA256; login หมุน session ปัจจุบัน, logout เฉพาะ session/audience นั้น | ระบุ security protocol; response DTO เดิม |
| Cookie | HttpOnly, SameSite=Lax, Path=/api/v1, host-only; Secure บน HTTPS; development loopback HTTP เท่านั้น | ไม่เพิ่ม response field |
| Lifetime | Absolute TTL 12 ชั่วโมงทั้งสอง audience; no silent sliding refresh; ค่า ENV ปรับได้เมื่ออนุมัติ | ปิดค่า policy ใน D01 |
| CSRF/CORS | Unsafe browser requests ต้องมี exact allowed Origin และ JSON; anonymous login/register ตรวจ Origin ด้วย; signature-authenticated Stripe webhook แยกจาก session CSRF | header/origin protocol ต้องตรวจ frontend ด้วย |
| Password | local Username ใช้ Node crypto PBKDF2-SHA256 พร้อม random salt/iteration metadata; 600,000 iterations; ไม่มีรหัส Email-provider ซ้ำใน DB | กลไก technical; wire ไม่เปลี่ยน |
| Login throttling | 5 failed attempts ต่อ identifier/นาที และ 20 ต่อ IP/นาที; state shared ใน PostgreSQL; generic error ไม่เปิดบัญชีมี/ไม่มี | ต้องระบุ 429/retry protocol ใน canonical ก่อนเปิดใช้ |
| Revocation | reset password/disable account ยกเลิกทุก app session ของบัญชีนั้น; logout ปกติไม่ logout audience อื่น | ปิด policy ที่ Draft ยังไม่ระบุ |
| Username | Admin-create และ self-profile ใช้ pattern canonical profile เดียวกัน `^[A-Za-z0-9_.]{3,30}$`; normalized lookup uppercase, case-insensitive uniqueness | AdminCreateUserRequest ต้องเพิ่มข้อจำกัดให้ตรง |
| Password length | create/register/reset ใช้ 8–128 ตาม RegisterRequest; LoginRequest รับเดิมเพื่อ validate credential ไม่บังคับสร้างใหม่ | ต้อง sync create/reset ที่ไม่ตรง; ไม่ยึด min12 จาก prototype |
| Profile PATCH | omitted=ไม่เปลี่ยน; explicit null=ล้างเฉพาะ nullable field; arrays=replace และ []=ล้าง; ไม่ใช้ truthy check ลบค่าที่ถูกต้อง | ต้องปิด conflict ระหว่าง Flow AB และ canonical |

รายการข้างบนยัง Proposed. ก่อนเปิด Auth task ต้องอนุมัติ transport/limits และ
แก้ canonical อย่างเจาะจง พร้อม regenerate/check frontend contract snapshot.
Origins ของ production ยังไม่กำหนด; ไม่เปิด wildcard หรือ deploy ในงานนี้.

## ชุด C — Firebase/Resend owner และ protocol / D03

**Confirmed:** Firebase Email/Google + local Username ไม่มี email, บัญชีภายใน ID
เดียว, explicit linking, ไม่ auto-merge จาก email, Resend delivery, ลิงก์ที่ scope
กำหนดใช้ครั้งเดียวภายใน 24 ชั่วโมง. Firebase public Web config ไม่ทดแทน server
identity/credential หรือการตรวจ proof.

**Proposed:** Nest เป็น owner ของ verification/reset proof ในระบบและกติกา 24h;
Firebase เป็น owner ของ Email/Google credential; Resend ส่งลิงก์. Username password
เป็น local credential อิสระ; ไม่ใช้ fake Firebase email และไม่ sync password
ระหว่าง provider/local อัตโนมัติ. Link ต้องมี app session และ Firebase proof
ของผู้ใช้เดียวกัน; collision กับ identity ที่ผูกบัญชีอื่นต้องปฏิเสธ.

Server ตรวจ ID token signature/issuer/audience/expiry และ revocation ตาม policy
ก่อนสร้าง app session. [Firebase verify documentation](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
และ [revocation](https://firebase.google.com/docs/auth/admin/manage-sessions)
รองรับการออกแบบนี้. Firebase มีวิธีสร้าง email action links สำหรับผู้ส่งเอง
([official documentation](https://firebase.google.com/docs/auth/admin/email-action-links));
อายุ proof ของ Melearn และ recovery ownership ต้องตรวจให้ตรง Final 1.6 ก่อน
เลือก provider action mechanism ไม่อนุมานว่า link ทุกชนิดมีอายุ 24h.

**Contract delta ที่ต้องตัดสิน:** เสนอ `POST /auth/firebase/exchange`
`{id_token,audience}` และ `POST /auth/firebase/link` `{id_token}` เพื่อแทนที่
4 Google routes ที่ Deferred. Proposed เท่านั้น ยังไม่เพิ่ม endpoint และยัง
ติดตาม 5 Deferred records เดิม. ต้องออกแบบ response/error/link freshness และ
recovery endpoints เดิมครบก่อน canonical revision ใหม่; ไม่เอา mock OAuth มาใช้.

**Dependency justification:** เสนอ official `firebase-admin` สำหรับ token/user
operations แทนเขียน JWT/provider protocol เอง. ยังไม่ติดตั้ง. ต้องเลือก/pin
version และอนุมัติ dependency หลังตกลง owner/protocol. ค่า Admin identity และ
Resend From ยังไม่พร้อมใน ENV; ไม่สร้าง service-account key/IAM หรือส่งอีเมล
จริงในชุดนี้.

## คิวหลัง browser/auth slice

| Decision | ต้องตกลงอะไร | Task ที่ได้รับผล |
| --- | --- | --- |
| D04/D05 | aggregate replace/PATCH/revision; rich-document/security limits | Course/Review/Blog authoring |
| D06 | best attempt เมื่อคะแนนเต็มเปลี่ยน: เปรียบเทียบเปอร์เซ็นต์หรือ raw score/แยก version | Assessment/Grade และ completion snapshot selection |
| D07/D09 | certificate text mock vs file delivery; upload HTTP contract ที่ยังไม่มี | Certificates/Account/Authoring |
| D08/D10 | real Stripe protocol, API version, checkout idempotency/retry/expiry | Payments/provider gate |
| D11/D12 | history delete/retention/inflight; AI retry/reservation cleanup | AI/Blog lifecycle |
| D16 ส่วนอื่น | query/cursor/search/PII แยก Management/AI/Blog | รายการแต่ละ feature |

DB constraints ที่ผ่านแล้วไม่ใช่หลักฐานว่าการตัดสิน policy เหล่านี้ผ่าน.
เลือกทำ task ที่ dependencies/policy พร้อม; เป้าหมาย 86 operations และ 113 cases
คงเดิม. Source/decision conflicts ต้องปรากฏใน execution board.
