import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Human-readable projection of the canonical schema, not a second contract source.
const source = (await readFile(new URL('./openapi.json', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
const doc = JSON.parse(source);
const target = new URL('./API_CONTRACT_FEATURES_TH.md', import.meta.url);
const schemas = doc.components.schemas;
const methods = ['get', 'post', 'put', 'patch', 'delete'];
const groups = [
  ['auth', 'สมัครบัญชี / Login / ยืนยันอีเมล / กู้รหัสผ่าน', 'Web และ Admin Login แยก session กัน; audience ไม่ใช่หลักฐานสิทธิ์. Google protocol จริงยังรอกำหนด.'],
  ['account', 'โปรไฟล์และข้อมูลบัญชีตนเอง', 'อ่าน/แก้บัญชีตนเอง ห้ามเปลี่ยน role หรือสถานะยืนยันอีเมลผ่าน profile. avatar_url รับ URL; API อัปโหลดไฟล์ยังไม่มี.'],
  ['catalog', 'Catalog / รายละเอียดคอร์ส / หน้าผู้สอนสาธารณะ', 'แสดงคอร์ส published เท่านั้น; public outline ไม่เปิดเนื้อหาบทเรียนหรือเฉลย. API ใช้ course ID แม้ UI บาง route ใช้ slug.'],
  ['enrollment', 'สมัครคอร์สฟรี / รายการคอร์สที่มีสิทธิ์', 'สิทธิ์เรียนสร้างโดย server; Instructor เรียนคอร์สคนอื่นได้; ห้าม Admin ซื้อหรือสมัครผ่าน learner flow.'],
  ['learning', 'บทเรียน / Progress / Resume', 'ต้องมีสิทธิ์เรียน; เปิดหน้าอย่างเดียวไม่ถือว่าเรียนจบ; server บันทึก progress/resume.'],
  ['assessment', 'แบบฝึกหัด / ส่งคำตอบ / ผลคะแนน / ตรวจงาน', 'ผ่านเมื่อคะแนนมากกว่า 70%; ข้อเขียน/ภาพรอ Instructor เจ้าของคอร์สตรวจ; Admin อ่านเพื่อจัดการได้แต่ไม่ให้คะแนน.'],
  ['certificate', 'ใบรับรอง', 'อ่าน/ดาวน์โหลดเฉพาะเจ้าของ; ออกครั้งเดียวจาก completion snapshot. download ปัจจุบันเป็น mock text ไม่ใช่ PDF contract ที่พร้อมจริง.'],
  ['authoring', 'สร้างและแก้คอร์ส / บท / Quiz / Preview', 'Instructor เจ้าของคอร์สหรือ Admin แก้คอร์สได้; submit-review เฉพาะ Instructor เจ้าของ. วิดีโอใช้ YouTube; upload video ยังไม่พร้อม.'],
  ['approval', 'คิวตรวจคอร์ส / อนุมัติ / ส่งกลับ / Publish', 'Admin ตรวจอนุมัติ/ส่งกลับ; publish ตรวจ review และ current revision ที่ server. กลยุทธ์ expected_revision ของ return/publish ยังรอตกลง.'],
  ['payment', 'Stripe Checkout / สถานะจ่ายเงิน', 'ให้สิทธิ์จาก webhook ที่ server ตรวจแล้วเท่านั้น; ห้ามให้สิทธิ์จากหน้า success หรือ GET payment. ไม่มี cart/orders/finance dashboard.'],
  ['redeem', 'รหัสแลกคอร์ส', 'หนึ่ง code ต่อหนึ่ง course ใช้ครั้งเดียว ไม่มีวันหมดอายุ; revoke เฉพาะยังไม่ใช้; ไม่ใช่คูปองส่วนลดและไม่สร้าง Order.'],
  ['ai', 'AI Chat / Transcript / ประวัติ / Quota / AIPractice', 'Transcript/การเปิด AI ของคอร์สเป็น Admin; ประวัติเป็นเจ้าของบัญชี; 20 prompts สำเร็จต่อวันเวลาไทย; AIPractice ไม่เปลี่ยน Quiz/progress.'],
  ['blog', 'บทความสาธารณะ / Blog Editor', 'Admin สร้าง/แก้/publish; public เห็นเฉพาะ published; PATCH/publish/unpublish/delete ต้องส่ง expected_revision.'],
  ['management', 'จัดการผู้ใช้ / Instructor / ผู้เรียน / ผลเรียน / Dashboard', 'Admin จัดการบัญชีและแต่งตั้ง Instructor; Instructor เห็นข้อมูลในคอร์สตนเอง. Dashboard เป็น scoped summary ตาม V1.'],
];
function groupOf(path, operation) {
  if (path === '/me') return 'account';
  if (path.includes('/certificates')) return 'certificate';
  if (path.includes('redeem')) return 'redeem';
  if (path === '/courses/{id}/enroll' || path === '/me/enrollments') return 'enrollment';
  if (path.includes('course-reviews') || path === '/courses/{id}/publish') return 'approval';
  if (path.startsWith('/admin/users') || path === '/admin/instructors') return 'management';
  if (path.startsWith('/instructors/')) return 'catalog';
  return operation.tags[0];
}
const operations = [];
for (const [path, item] of Object.entries(doc.paths)) for (const method of methods) {
  if (item[method]) operations.push({ path, method: method.toUpperCase(), operation: item[method], group: groupOf(path, item[method]) });
}
for (const entry of operations) if (!groups.some(([key]) => key === entry.group)) throw new Error(`Unmapped ${entry.path}`);
const deferred = doc['x-deferred-operations'];
const counts = Object.fromEntries(methods.map(m => [m.toUpperCase(), operations.filter(o => o.method === m.toUpperCase()).length]));
const escape = value => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>');
const code = value => '`' + escape(value) + '`';
const json = value => '```json\n' + JSON.stringify(value, null, 2) + '\n```';
const refName = ref => ref.split('/').pop();
const schemaLink = name => `[${name}](#schema-${name.toLowerCase()})`;
function typeOf(s) {
  if (!s) return 'ไม่ระบุ';
  if (s.$ref) return schemaLink(refName(s.$ref));
  if (s.oneOf || s.anyOf) return (s.oneOf || s.anyOf).map(typeOf).join(s.oneOf ? ' / oneOf / ' : ' / anyOf / ');
  if (s.allOf) return s.allOf.map(typeOf).join(' + ');
  if (s.type === 'array') return `array<${typeOf(s.items)}>`;
  if (s.type === 'object' && s.additionalProperties && typeof s.additionalProperties === 'object') return `object<string, ${typeOf(s.additionalProperties)}>`;
  return Array.isArray(s.type) ? s.type.join(' / ') : (s.type || 'object');
}
function constraints(s) {
  const parts = [];
  if (s.enum) parts.push(`enum: ${JSON.stringify(s.enum)}`);
  if (Object.hasOwn(s, 'const')) parts.push(`const: ${JSON.stringify(s.const)}`);
  for (const key of ['format', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minItems', 'maxItems', 'uniqueItems', 'minProperties', 'maxProperties', 'default']) {
    if (Object.hasOwn(s, key)) parts.push(`${key}: ${JSON.stringify(s[key])}`);
  }
  if (s.additionalProperties === false) parts.push('ไม่รับ field นอก schema');
  if (s.description) parts.push(s.description);
  return escape(parts.join('; ') || '—');
}
function fields(s, prefix = '') {
  let rows = [];
  for (const [name, child] of Object.entries(s.properties || {})) {
    const path = prefix ? `${prefix}.${name}` : name;
    rows.push(`| ${code(path)} | ${typeOf(child)} | ${(s.required || []).includes(name) ? 'required' : 'optional'} | ${constraints(child)} |`);
    if (child.type === 'object') rows.push(...fields(child, path));
    if (child.type === 'array' && child.items?.properties) rows.push(...fields(child.items, `${path}[]`));
  }
  return rows;
}
function examples(media) {
  const samples = [];
  if (Object.hasOwn(media || {}, 'example')) samples.push(['ตัวอย่าง JSON', media.example]);
  for (const [name, value] of Object.entries(media?.examples || {})) if (Object.hasOwn(value, 'value')) samples.push([name, value.value]);
  return samples.map(([label, value]) => `${label}:\n\n${json(value)}`).join('\n\n');
}
const captions = {
  '/auth/register': 'สมัครด้วยอีเมล', '/auth/verify-email': 'ยืนยันอีเมลด้วย token', '/auth/resend-verification-email': 'ส่งอีเมลยืนยันใหม่',
  '/auth/login': 'เข้าสู่ระบบ Web/Admin', '/auth/logout': 'ออกจาก app session ปัจจุบัน', '/auth/password-reset/request': 'ขอลิงก์กู้รหัสผ่าน', '/auth/password-reset/confirm': 'ตั้งรหัสผ่านใหม่',
  '/me': 'ข้อมูลบัญชีปัจจุบัน / แก้ข้อมูลตนเอง', '/courses': 'รายการคอร์สสาธารณะ', '/courses/{id}': 'รายละเอียด public / แก้โครงสร้างและเนื้อหาคอร์ส',
  '/courses/{id}/enroll': 'ลงคอร์สฟรี', '/me/enrollments': 'รายการคอร์สที่มีสิทธิ์', '/learn/courses/{id}': 'โครงสร้างคอร์สสำหรับเรียน',
  '/learn/courses/{id}/items/{item_id}': 'เปิดเนื้อหาเรียน', '/me/progress': 'ความคืบหน้าตนเอง', '/learn/items/{id}/complete': 'ยืนยันจบเนื้อหา', '/learn/items/{id}/resume': 'บันทึกตำแหน่งวิดีโอ',
  '/learn/items/{id}/attempts': 'เริ่มหรือรับ attempt', '/learn/attempts/{id}/answers': 'บันทึกคำตอบ', '/learn/attempts/{id}/submit': 'ส่ง attempt', '/learn/attempts/{id}': 'อ่าน attempt ตนเอง', '/learn/items/{id}/results': 'อ่านผลเรียนของแบบฝึกหัด',
  '/instructor/grading-queue': 'คิวข้อเขียน/ภาพรอตรวจ', '/instructor/attempts/{id}/questions/{question_id}/grade': 'บันทึกคะแนนและ feedback',
  '/me/certificates': 'รายการใบรับรอง', '/me/certificates/{id}': 'รายละเอียดใบรับรอง', '/me/certificates/{id}/download': 'ดาวน์โหลดใบรับรอง (mock text)',
  '/instructor/courses': 'สร้าง/รายการคอร์สผู้สอน', '/admin/courses': 'สร้าง/รายการคอร์ส Admin', '/courses/{id}/authoring': 'อ่านข้อมูล editor รวม quiz/เฉลยสำหรับผู้มีสิทธิ์', '/courses/{id}/authoring-preview': 'ตัวอย่างคอร์สสำหรับผู้จัดการ',
  '/courses/{id}/videos/uploads': 'Upload Video: ยังไม่พร้อม', '/courses/{id}/submit-review': 'เจ้าของ Instructor ส่งคอร์สตรวจ', '/admin/course-reviews': 'คิวตรวจคอร์ส', '/admin/course-reviews/{id}': 'รายละเอียด review', '/admin/course-reviews/{id}/approve': 'อนุมัติ review', '/admin/course-reviews/{id}/return': 'ส่งกลับพร้อมเหตุผล', '/courses/{id}/publish': 'เผยแพร่คอร์ส',
  '/me/payments/checkout': 'เริ่ม Stripe Checkout / คืน entitlement เดิม', '/me/payments/{id}': 'ติดตามสถานะ payment ตนเอง', '/admin/payments/{id}': 'Admin ตรวจ payment รายกรณี',
  '/me/redeem': 'แลกรหัสรับสิทธิ์เรียน', '/admin/redeem-codes': 'สร้าง/รายการรหัสแลกคอร์ส', '/admin/redeem-codes/{id}/revoke': 'ยกเลิกรหัสที่ยังไม่ใช้',
  '/admin/courses/{id}/ai-support': 'Admin เปิด/ปิด AI คอร์ส', '/admin/courses/{id}/videos/{itemId}/ai-transcript': 'Admin อ่าน/บันทึก Transcript',
  '/me/ai/conversations': 'สร้าง/ค้นหารายการแชตตนเอง', '/me/ai/conversations/{id}/messages': 'ประวัติข้อความ / ส่ง prompt', '/me/ai/conversations/{id}': 'เปลี่ยนชื่อ/ลบแชต', '/me/ai/usage': 'โควตา prompt ประจำวัน', '/me/ai/conversations/{id}/messages/{messageId}/practice/answers': 'ตอบ AIPractice และอ่านผล',
  '/blog': 'รายการบทความ published', '/blog/{slug}': 'อ่านบทความ public', '/admin/blog': 'รายการ/สร้างบทความ Admin', '/admin/blog/{id}': 'แก้/ลบบทความ', '/admin/blog/{id}/preview': 'preview บทความ draft', '/admin/blog/{id}/publish': 'เผยแพร่บทความ', '/admin/blog/{id}/unpublish': 'ถอนเผยแพร่บทความ',
  '/admin/users': 'Admin สร้าง/รายการบัญชี', '/admin/users/{id}': 'รายละเอียดบัญชี', '/admin/users/{id}/instructor': 'แต่งตั้ง Instructor', '/admin/instructors': 'รายชื่อ Instructor เพื่อเลือกเจ้าของคอร์ส',
  '/admin/users/{id}/enrollments': 'คอร์สที่บัญชีมีสิทธิ์', '/admin/users/{id}/attempts': 'ผลแบบฝึกหัดของบัญชี', '/courses/{id}/learners': 'ผู้เรียนในคอร์ส', '/courses/{id}/attempts': 'ผลแบบฝึกหัดในคอร์ส',
  '/instructor/learners': 'ผู้เรียนเฉพาะคอร์สผู้สอน', '/admin/learners': 'รายการผู้เรียนเพื่อจัดการ', '/managed-quizzes/{id}': 'อ่าน quiz สำหรับผู้จัดการคอร์ส', '/instructor/attempts/{id}': 'รายละเอียดงานตรวจของเจ้าของ Instructor', '/admin/summary': 'summary Admin', '/instructor/summary': 'summary Instructor', '/instructors/{id}': 'โปรไฟล์ผู้สอน public', '/instructors/{id}/courses': 'คอร์ส published ของผู้สอน',
};
let out = [];
const add = text => out.push(text);
add('# Melearn V1 — API Contract แยกตามฟีเจอร์');
add('อัปเดต 10 ตุลาคม 2026 · **Frontend Draft — ยังไม่ freeze กับ Backend** · อิง Final 1.6');
add('เอกสารนี้ใช้ส่งให้ผู้เขียน Backend อ่านว่าหน้าจอต้องการ API และ JSON แบบใด สร้างจาก [OpenAPI ต้นทาง](openapi.json) โดยตรง ไม่คัดลอก prototype types เป็น contract. ตัวอย่างเป็นข้อมูลสังเคราะห์จาก mock ไม่ใช่ข้อมูลจริงหรือคำรับรองว่า Backend/provider พร้อม.');
add(`## 1. จำนวนฟีเจอร์และ API\n\nมี **${groups.length} กลุ่มฟีเจอร์สำหรับ handoff** ครอบคลุม **${operations.length} HTTP operations ที่กำหนด schema แล้ว** และ **${deferred.length} provider operations ที่ยังรอกำหนด protocol** รวม inventory ${operations.length + deferred.length} operations. จำนวนนี้นับคู่ method + path ไม่ใช่จำนวนหน้าจอหรือจำนวน path ไม่ซ้ำ. OpenAPI เดิมมี 9 tags; เอกสารแยก Profile/Enrollment/Certificate/Approval/Redeem ให้อ่านเป็นงานได้ชัดขึ้น ไม่เพิ่ม scope ธุรกิจ.`);
add('| ฟีเจอร์ | Defined operations | Provider pending |\n| --- | ---: | ---: |');
for (const [key, title] of groups) add(`| [${title}](#feature-${key}) | ${operations.filter(o => o.group === key).length} | ${deferred.filter(o => o.flow === key).length} |`);
add(`\nMethods ที่มี schema แล้ว: ${Object.entries(counts).map(([m,n]) => `${code(m)} ${n}`).join(', ')}. อัปโหลดรูปโปรไฟล์เป็นงานเพิ่มที่ยังไม่มี endpoint/schema/mock จึง **ไม่รวมใน 86 หรือ 91**.`);
add('## 2. กติกาอ่านและสร้าง Backend');
add('- Base URL ระบบจริงที่เสนอ: `/api/v1`; dev mock ใช้ `/mock-api/v1`. เปลี่ยน origin/base URL ตาม environment.\n- JSON ใช้ field names ตาม schema ด้านล่าง; GET ส่ง query/path ไม่ส่ง JSON body. POST/PATCH/PUT/DELETE ส่ง body ตามที่ operation ระบุเท่านั้น.\n- `required` หมายถึงต้องส่ง field; `optional` หมายถึงละได้. `null` ใช้ได้เฉพาะ schema อนุญาต. optional ไม่เท่ากับ null.\n- `PATCH` ใช้แก้บางส่วน แต่ nested course content replacement ต้องอ่าน schema/lifecycle ห้ามเดาว่า merge nested lists อัตโนมัติ. `PUT` ใช้บันทึก resource/subresource ตาม endpoint.\n- เวลาใช้ค่าจาก server ตามรูปแบบ schema; IDs เป็น opaque strings; ตัวอย่าง ID/เวลา/URL ไม่ใช่ค่าบังคับ.\n- Backend ตรวจ authentication, role, ownership, enrollment, lifecycle, progress, score, payment, quota และ concurrency ทุกครั้ง; route guard และ audience ไม่มีอำนาจให้สิทธิ์.\n- `Money.amount_minor` เป็น integer หน่วยย่อย, 100 = 1 บาท; Draft/mock ปัจจุบันรองรับ `THB`. Free course ใช้ price `null` ตาม schema.\n- แต่ละ schema มีตาราง fields ในภาคผนวก; คลิกชื่อ schema เพื่อดู nested schema/enum/required/validation.');
add('### Login/session แยก Web และ Admin');
add('บัญชีใช้ identity ชุดเดียวกันได้ แต่ Login/logout/session แยกตาม app ที่ผู้ใช้ยืนยันแล้ว. ชื่อ cookie `melearn_web_session` / `melearn_admin_session` เป็นข้อเสนอใน Draft; HttpOnly/Secure/domain/path/CORS/CSRF/TTL/origins ยังต้องตกลงก่อนใช้จริง. Security schemes หลายรายการใน operation เป็นทางเลือก OR ไม่ใช่การอนุญาต role ทั้งหมด; ต้องอ่าน permission คู่กัน.');
add('### Error JSON กลาง');
add(json({ error: { code: 'validation_failed', message: 'ข้อมูลที่ส่งไม่ถูกต้อง', request_id: 'example-request-id', details: { fields: [{ field: 'display_name', code: 'invalid' }] } } }));
add('`error.code`, `message`, `request_id` required; `details` optional ตาม '+schemaLink('ErrorEnvelope')+'. HTTP: 400 request ไม่ถูกต้อง, 401 ไม่ได้ login, 403 ไม่มีสิทธิ์, 404 ไม่พบหรือซ่อน resource, 409 conflict, 410 หมดอายุ, 422 validation, 429 quota/rate, 500 server, 503 ฟังก์ชัน/บริการไม่พร้อม. OpenAPI ใส่ common error statuses หลายรายการทุก operation; **ไม่ใช่หลักฐานว่าทุก endpoint เกิด error ทุกแบบได้จริง**. ตาราง error ที่มีตัวอย่างด้านล่างระบุ code ที่สังเกตจาก mock; applicability ที่ไม่พบตัวอย่างต้องยืนยันกับ Backend.');
add('## 3. รายละเอียดแต่ละฟีเจอร์');
for (const [key,title,rule] of groups) {
  add(`<a id="feature-${key}"></a>\n\n### ${title}\n\n${rule}`);
  const entries = operations.filter(o => o.group === key).sort((a,b) => a.path.localeCompare(b.path) || methods.indexOf(a.method.toLowerCase()) - methods.indexOf(b.method.toLowerCase()));
  add('| Method | Endpoint | หน้าที่ |\n| --- | --- | --- |');
  for (const e of entries) add(`| ${code(e.method)} | ${code(e.path)} | ${captions[e.path] || e.operation.summary} |`);
  for (const {path,method,operation:o} of entries) {
    add(`#### ${method} ${path}\n\n${captions[path] || o.summary}`);
    add(`สิทธิ์: ${code(o['x-permission'])}. Session: ${(o.security || []).length ? o.security.map(s => Object.keys(s).join('+')).join(' หรือ ') : 'public ไม่ต้องมี session'}. สถานะ: ${o['x-contract-status']}.`);
    if (o.description) add(o.description);
    if (o.parameters?.length) {
      add('| Parameter | ที่ส่ง | Type/schema | Required | Validation |\n| --- | --- | --- | --- | --- |');
      for (const p of o.parameters) add(`| ${code(p.name)} | ${p.in} | ${typeOf(p.schema)} | ${p.required ? 'required' : 'optional'} | ${constraints(p.schema)} |`);
    }
    const request = o.requestBody;
    if (!request) add('**Request body:** ไม่มี JSON body ตาม Draft นี้.');
    else for (const [mime,media] of Object.entries(request.content)) {
      add(`**Request body:** ${request.required ? 'required' : 'optional'}, ${code(mime)}, schema ${typeOf(media.schema)}.`);
      if (examples(media)) add(examples(media));
      else add('ยังไม่มีตัวอย่าง request ที่เก็บไว้; ใช้ fields/required ของ schema ที่ลิงก์แทน ไม่อนุมาน payload จาก UI.');
    }
    let success = false;
    for (const [status,response] of Object.entries(o.responses)) if (Number(status) >= 200 && Number(status) < 300) {
      success = true;
      if (!response.content) { add(`**Response ${status}:** ไม่มี body.`); continue; }
      for (const [mime,media] of Object.entries(response.content)) {
        add(`**Response ${status}:** ${code(mime)}, schema ${typeOf(media.schema)}.`);
        if (examples(media)) add(examples(media));
        else add('ยังไม่มีตัวอย่าง response ที่เก็บไว้; ใช้ schema ที่ลิงก์.');
      }
    }
    if (!success) add('**Success response:** ไม่มีใน V1 สำหรับ operation นี้; video upload ตอบ 503 และไม่รับไฟล์/สร้าง upload record.');
    const observed = [];
    for (const [status,response] of Object.entries(o.responses)) if (Number(status) >= 400) {
      for (const media of Object.values(response.content || {})) {
        const ex = Object.hasOwn(media,'example') ? [media.example] : [];
        ex.push(...Object.values(media.examples || {}).map(v => v.value).filter(Boolean));
        for (const item of ex) if (item.error) observed.push(`| ${status} | ${code(item.error.code)} | ${escape(item.error.message)} |`);
      }
    }
    if (observed.length) add('Errors ที่มีตัวอย่าง mock ใน OpenAPI:\n\n| HTTP | Code | Message ตัวอย่าง |\n| --- | --- | --- |\n'+[...new Set(observed)].join('\n'));
    add('Schema ของ error: '+schemaLink('ErrorEnvelope')+'. '+escape(o['x-retry'] || 'Retry/idempotency ต้องตกลงก่อนใช้งานจริง.'));
    if (path === '/me/payments/checkout') add('**ต้องรองรับทั้งสอง branch:** `already_enrolled: false` คืน payment/checkout URL; `already_enrolled: true` คืน `course_id` และ full `enrollment`. ตัวอย่างข้างบนเป็นเพียงหนึ่ง branch; request_id ยาว 1–64 ตาม Draft. ไม่สร้างสิทธิ์จาก client.');
    if (path === '/courses/{id}' && method === 'PATCH') add('วิดีโอใน chapters/items ส่ง `video_url` เป็น YouTube URL canonical. UI แปลง short/Shorts เป็น watch URL ก่อนบันทึก. แก้ content เป็นชุด atomic และต้องรักษา ID/revision/history rules; เฉลยไม่ส่งออก public/learner projection.');
    if (path.includes('/admin/blog/{id}') && method !== 'GET') add('Blog mutation ต้องส่ง `expected_revision`: missing/invalid → 422, stale → 409; DELETE ปัจจุบันส่ง JSON body กลยุทธ์ If-Match/retention ยังรอยืนยัน.');
  }
}
add('## 4. Provider operations ที่ยังไม่มี JSON/protocol พร้อมใช้จริง');
add('| Method | Endpoint | Feature | สถานะ |\n| --- | --- | --- | --- |');
for (const e of deferred) add(`| ${code(e.method)} | ${code(e.path)} | ${e.flow} | provider-pending |`);
add('Google start/callback ต้องตกลง redirect, state, PKCE/code exchange, identity verification, account-link conflicts และ error callback; ไม่ใช้ mock_google เป็นข้อมูลยืนยันตัวตนจริง. Stripe webhook ต้องใช้ raw event และ signature ที่ตรวจจาก providerจริง/versionที่ตกลง; ห้ามนำ fake signature/flat mock events ไปเป็น Production payload. เว็บอ่าน payment status ได้แต่ไม่ให้สิทธิ์เอง.');
add('## 5. ช่องว่าง API อัปโหลดรูปโปรไฟล์ / Cloudflare');
add('**มีแล้ว:** `PATCH /me` ส่ง `avatar_url` เป็น URL หรือ null ตาม '+schemaLink('UpdateProfileRequest')+'. UI เลือก/เปลี่ยน/ลบและ preview JPG/PNG/WebP ไม่เกิน 5 MB ได้ แต่ไฟล์ยังเป็น local draft. **ยังไม่มี:** endpoint อัปโหลดภาพ, multipart/presigned upload JSON, DTO/schema/mock หรือ Cloudflare integration. การเลือก Cloudflareเป็นทิศทางล่าสุดของผู้ใช้ แต่ยังไม่เลือก Images/R2/protocol จึงไม่มี request/response ที่รับรองในเอกสารนี้.');
add('งานที่ Backend/Frontend ต้องตกลงเพิ่ม: permission อัปโหลดเฉพาะบัญชีตนเอง, upload intent หรือ multipart route, size/type/content validation, response ที่คืน hosted URL/media ID, expiry/finish flow, ownership ของ media, การลบ/เปลี่ยนรูปเดิมและ errors. อย่าส่ง data URL/local blob เข้า `avatar_url` หรือเก็บ Cloudflare credentials ใน browser. งานนี้อยู่นอก inventory ที่นับข้างต้นจนเพิ่ม schema/client/mock และยืนยัน flow.');
add('## 6. เรื่องที่ยังต้องตกลงก่อน freeze / สิ่งที่ไม่ต้องสร้าง');
for (const decision of doc['x-pending-decisions']) add('- '+decision);
add('\nไม่มี Cart, Discount, Order, Finance, Inbox, คำขอเป็น Instructor หรือ analytics ขนาดใหญ่ใน V1. ไม่มี endpoint แยก POST/DELETE Chapter/Quiz เพียงเพื่อให้ครบ CRUD: Draft ปัจจุบันแก้ nested content ผ่าน `PATCH /courses/{id}`. ห้ามเดา endpoint เพิ่มจากหน้าจอ. JSON schema ไม่ใช่ database schema; Backend ออกแบบ storage/transactions ของตนเองให้ enforce กติกา Final 1.6.');
add('## 7. ภาคผนวก — DTO / fields / validation ครบทุก schema');
add('ตารางนี้สร้างจาก `components.schemas` ทั้ง '+Object.keys(schemas).length+' definitions. Required ของ nested field หมายถึงจำเป็นเมื่อ parent object นั้นถูกส่ง; array items ไม่กำหนดจำนวนขั้นต่ำเว้นแต่มี minItems. คลิก `$ref` เพื่ออ่าน DTO ที่เกี่ยวข้อง; oneOf/anyOf ต้องอ่าน branch ทั้งหมด. ข้อจำกัดที่ไม่ได้ระบุไม่ใช่สิทธิ์ให้ UI/backendใช้ค่าใดก็ได้ แต่เป็น decision gap ที่ควรตกลง.');
for (const [name,schema] of Object.entries(schemas).sort(([a],[b]) => a.localeCompare(b))) {
  add(`<a id="schema-${name.toLowerCase()}"></a>\n\n### ${name}\n\nType: ${typeOf(schema)}. ${constraints(schema)}`);
  if (schema.description) add(schema.description);
  const rows = fields(schema);
  if (rows.length) add('| Field | Type/schema | Required | Validation/description |\n| --- | --- | --- | --- |\n'+rows.join('\n'));
  else if (!schema.$ref) add('Schema definition:\n\n'+json(schema));
}
add('## 8. แหล่งอ้างอิงและการอัปเดต');
add('- [MELEARN_V1_SCOPE.md — Final 1.6](../MELEARN_V1_SCOPE.md) กติกาธุรกิจ\n- [OpenAPI Draft](openapi.json) แหล่ง schema หลัก\n- [API Contract Draft / decision register](API_CONTRACT_R4A_DRAFT_TH.md)\n- [Flow A/B](API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) รายละเอียด auth/catalog\n- [Mock limitations](../../frontend/docs/PROVISIONAL_API_MOCK_TH.md)\n- [Acceptance matrix](../../frontend/docs/FRONTEND_API_ACCEPTANCE_MATRIX_TH.md) เกณฑ์ตรวจรับจริง');
add('อัปเดต OpenAPI ก่อน แล้วรัน `node ../docs/api-contract/generate-handbook.mjs` เพื่อสร้าง Markdown นี้ใหม่; `node ../docs/api-contract/generate-handbook.mjs --check` ตรวจ drift. ไม่แก้ tables/JSON ในไฟล์ generated นี้โดยตรง. หากเปลี่ยน business/provider decisions ให้อัปเดต source + เอกสาร decision ที่เกี่ยวข้องพร้อมกัน.');
add(`<!-- source-sha256: ${createHash('sha256').update(source).digest('hex')} -->`);
const content = out.join('\n\n').replaceAll('|\n\n|', '|\n|') + '\n';
if (process.argv.includes('--check')) {
  const existing = await readFile(target, 'utf8');
  if (existing.replaceAll('\r\n','\n') !== content) throw new Error('Contract handbook drift; run node ../docs/api-contract/generate-handbook.mjs');
  console.log(`Handbook verified: ${groups.length} feature groups, ${operations.length} defined + ${deferred.length} deferred, ${Object.keys(schemas).length} schemas.`);
} else {
  await writeFile(target, content);
  console.log(`Written ${target}: ${groups.length} feature groups, ${operations.length} defined + ${deferred.length} deferred.`);
}
