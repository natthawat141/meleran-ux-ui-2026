# Auth — Firebase และบัญชี Username ของ Melearn

วันที่ 10 ตุลาคม 2026 · Provider decision ยืนยันแล้ว · HTTP/session details ด้านล่างเป็น Draft

## ข้อตกลงที่ผู้ใช้ยืนยัน

- Firebase Authentication ดูแล Email/Password และ Google.
- ASP.NET Core ดูแล Username/Password ของบัญชีที่ Admin สร้างโดยไม่มีอีเมล ตาม Final 1.6. ไม่สร้างอีเมลปลอมเพื่อยัดบัญชีเข้า Firebase.
- ทั้งสองวิธีเข้าถึงบัญชี Melearn ชุดเดียว; Web/Admin แยก Login และ session. Logout ปิดเฉพาะ session ของแอปนั้น.
- Phone enabled ใน Firebase Console ไม่ได้เพิ่ม Phone/OTP login เข้า V1. ไม่เปลี่ยน billing/SMS quota.
- Melearn backend เป็น source of truth ของ role, ownership, entitlement, progress, payment และ score.

## Ownership และ account mapping

Firebase เก็บ credentials ของ Email/Google; .NET ไม่รับหรือเก็บ password ของ Firebase อีกชุด. .NET เก็บ password hash สำหรับ local Username เท่านั้น; algorithm/configuration ยังต้องกำหนดก่อน implementation.

บัญชีมี internal Melearn User ID; Firebase UID เป็น external identity ไม่ใช้แทน User ID ในทุก business resource. Mapping ใช้ provider/project/subject ที่ตรวจจาก token แล้วและมี uniqueness; ไม่รับ UID/email/role จาก body เพื่อให้สิทธิ์.

ห้าม auto-link/auto-merge จากอีเมลที่เหมือนกัน. ถ้า Google ตรงกับบัญชีเดิม ให้เข้าบัญชีเดิมและเชื่อม identity โดย explicit link; ต้องมีหลักฐาน fresh Firebase sign-in และ Melearn session ของเจ้าของ. Identity ที่ผูกกับบัญชีอื่นตอบ conflict และไม่ย้ายสิทธิ์. Admin login ไม่สร้าง Admin จาก Firebase claims หรือ request audience; ตรวจ role จาก backend.

Self-email ที่ยังไม่ verified Login ได้ แต่ enroll/buy/redeem/learn ไม่ได้. Google ใช้ email ที่ provider ยืนยันแล้ว. Admin-created Username เริ่มเรียนตาม entitlement ได้แม้ไม่มี email. การเพิ่ม email ภายหลังไม่เปลี่ยน account origin หรือปิดสิทธิ์เดิมโดยอัตโนมัติ.

## Draft flow สำหรับ implementation

1. Email/Google: React Firebase SDK sign-in → Firebase ID token → .NET verify signature/project issuer/audience/expiry และสถานะ revocation ตาม policy → map/create Melearn account อย่างปลอดภัย → ออก Melearn app session.
2. Username: React ส่ง username/password ให้ .NET → ตรวจ hash/account/rate limits → ออก Melearn app sessionแบบเดียวกัน.
3. Business API ใช้ Melearn session และโหลด permission/state ฝั่ง server. `audience` เลือก Web/Admin แต่ไม่ให้ role.
4. Logout ยกเลิก Melearn session ของ app และ sign out Firebase SDK instance ของ app นั้น. Web/Admin ต้องแยก Firebase client persistence ด้วย เพื่อไม่ให้ logout ฝั่งหนึ่งลบ sign-in state อีกฝั่ง.

เสนอใช้ session exchange เพื่อให้สองวิธี Login มี business session เดียวกัน; ยังไม่ได้เลือก cookie/Bearer, attributes, TTL, CSRF/CORS และ storage. ไม่เพิ่ม custom-token bridge สำหรับ Username ในชุดนี้; หากมีเหตุผลต้องใช้งาน Firebase services ด้วย Username ค่อย review เพิ่ม.

## Proposed HTTP changes — ยังไม่ใช่ canonical OpenAPI

Paths อ้าง relative API prefix เดิม. JSON ตัวอย่างด้านล่างเป็นข้อเสนอเฉพาะ request; response ใช้ session/current-user schema หลัง review canonical contract ไม่สร้าง user DTO อีกฉบับในเอกสารนี้.

| Operation | Draft request | หน้าที่ |
| --- | --- | --- |
| `POST /auth/firebase/session` (ใหม่) | `{ "id_token": "<firebase-id-token>", "audience": "web" }` | ตรวจ Firebase token และเริ่ม Melearn session; audience web/admin |
| `POST /auth/login` (เดิม) | คง request schema เดิมจน review; จำกัด local credential flow ให้ Username | .NET ตรวจ local password; ไม่ส่ง Firebase password มาที่นี่ |
| `POST /me/auth-identities/firebase` (ใหม่) | `{ "id_token": "<fresh-firebase-id-token>" }` | ผูก verified identity กับบัญชีเดิมภายใต้ authenticated session และ reauthentication policy |
| `GET /me`, `PATCH /me` (เดิม) | ตาม canonical contract | อ่าน/แก้ profile; ห้ามแก้ role/verification ผ่าน profile |
| `POST /auth/logout` (เดิม) | ตาม canonical contract | ยกเลิก session เฉพาะ app |

Validation: token ต้องเป็น nonempty string มี size limit ที่กำหนดก่อน freeze; audience enum web/admin; ห้าม log/store raw token เป็น profile/cache. Invalid/expired/wrong-project proof → 401; valid identity ไม่มี Admin permission → 403; identity/email collision ที่ต้อง Login/Link หรือ linked to another account → 409; malformed input → 422; provider unavailable → 503 โดยไม่ fallback ให้สิทธิ์จาก mock.

Register/verify/resend/reset ของ Firebase Email ใช้ Firebase SDK/provider flow. Endpoint เดิมใน OpenAPI/mock ยังอยู่จนปรับ SDK/UI/tests พร้อม migration; ห้ามประกาศลบทันที. Local Username ที่ภายหลังมี verified email ยังต้องมี password reset ของ .NET แยกจาก Firebase password reset. ต้องกำหนดการพิสูจน์และผูก verified email เข้าบัญชี local ก่อน implement recovery.

Google start/callback/link 4 operations ที่ deferred ต้อง review แทนด้วย Firebase sign-in/link flow; ไม่ implement OAuth callback อีกชุดโดยอัตโนมัติ. อายุ verification link 24 ชั่วโมงใน Draft เดิมต้องตรวจ provider capability ก่อนอ้างว่ารับประกันได้; ไม่เปลี่ยนกติกานี้เงียบ ๆ.

## งานถัดไปและ acceptance

1. เลือก DB/ORM และ durable account/identity/session persistence; ตอนนี้ยังไม่เลือก.
2. ปรับ canonical OpenAPI, generated DTOs, mock และ handbook พร้อมกันสำหรับ auth exchange/link/session; กำหนด signup collision, linking proof freshness, reset/email ownership และ token error semantics.
3. ตั้ง Firebase client config แบบแยก app และ backend project/credentials ผ่าน environment/secret configuration. API key ฝั่ง clientไม่ใช่ server credential; ห้าม commit service-account private key หรือ paste credentials ในเอกสาร.
4. Implement verifier adapter ใน Infrastructure ผ่าน Application port; local password/session use cases ไม่เรียก Firebase โดยตรงจาก Controllers.
5. ตรวจ valid/expired/wrong-project/revoked token, duplicate identity/account, email-unverified transactions, Username ไม่มี email, link conflict, disabled user, Web/Admin isolation/logout และ Admin escalation. Provider live test ต้องมี config จริง; test doubles ไม่ใช่หลักฐาน live Firebase.

สถานะปัจจุบัน: บันทึก provider decision และ integration Draft แล้วเท่านั้น. ไม่มี Firebase SDK/token verifier/session/business Auth endpoints และ Frontend ยังใช้ HTTP mock. ไม่ deploy ไม่เพิ่ม billing และไม่รัน Docker.

## แหล่งอ้างอิง

- [Firebase ID token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Firebase Email/Password](https://firebase.google.com/docs/auth/web/password-auth)
- [Firebase custom authentication](https://firebase.google.com/docs/auth/admin/create-custom-tokens) — ทางเลือกที่ยังไม่ใช้
- Final 1.6: workspace `../../MELEARN_V1_SCOPE.md` และ Frontend `../../melearn-tutor-frontend/docs/MELEARN_V1_SCOPE.md`
