import React from 'react';
import { Avatar, Button, Form, Input, Select, Typography, message } from 'antd';
import { defaultUsername, validateProfile, type ProfileUserLike, type ProfileValues } from '@melearn/contracts';
import './profile-settings.css';

const { Text } = Typography;
const interests = ['คณิตศาสตร์', 'ฟิสิกส์', 'เคมี', 'ชีววิทยา', 'ภาษาอังกฤษ', 'ภาษาไทย', 'สังคมศึกษา'];
const goals = ['เรียนเสริมที่โรงเรียน', 'สอบเข้า ม.1', 'สอบเข้า ม.4', 'สอบ TGAT', 'สอบ TPAT', 'สอบ A-Level'];

interface Props {
  user: ProfileUserLike & { email: string; role: string; bio?: string; avatar?: string };
  users: ProfileUserLike[];
  updateProfile: (values: ProfileValues) => Promise<{ ok: boolean; message?: string }>;
  saving: boolean;
}

export function ProfileSettings({ user, users, updateProfile, saving }: Props) {
  const [form] = Form.useForm<ProfileValues>();
  const values = Form.useWatch([], form) || {};
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const save = async (next: ProfileValues) => {
    const error = validateProfile(next, users, user.id);
    if (error) { message.error(error); return; }
    const result = await updateProfile({
      ...next,
      name: next.name.trim(),
      username: next.username?.trim(),
      firstName: next.firstName?.trim(),
      lastName: next.lastName?.trim(),
      certificateName: next.certificateName?.trim(),
      phone: next.phone?.trim(),
      school: next.school?.trim(),
      bio: next.bio?.trim(),
      interests: next.interests ?? [], learningGoals: next.learningGoals ?? [],
    });
    result.ok ? message.success('บันทึกข้อมูลโปรไฟล์แล้ว') : message.error(result.message || 'บันทึกไม่สำเร็จ');
  };
  const googleEmail = values.googleLinkedEmail ?? user.googleLinkedEmail;
  return (
    <Form form={form} layout="vertical" initialValues={{ ...user, username: defaultUsername(user, users), interests: user.interests ?? [], learningGoals: user.learningGoals ?? [] }} onFinish={save} className="profile-settings-v2">
      <Form.Item name="googleLinkedEmail" hidden><Input /></Form.Item>
      <header className="profile-v2-header">
        <div className="profile-v2-heading"><Text className="profile-v2-eyebrow">บัญชีของฉัน</Text><h1>โปรไฟล์ของฉัน</h1><Text type="secondary">ตั้งค่าข้อมูลที่ใช้ระหว่างเรียนและบนใบรับรอง</Text></div>
        <div className="profile-v2-upload"><Avatar size={72} src={values.avatar || user.avatar}>{user.name.slice(0, 1)}</Avatar></div>
      </header>

      <div className="profile-v2-sections">
        <section className="profile-v2-section">
          <div className="profile-v2-section-title"><div><h2>บัญชีและตัวตน</h2><Text type="secondary">ชื่อผู้ใช้ใช้ระบุตัวตนในต้นแบบนี้</Text></div></div>
          <div className="profile-v2-fields">
            <Form.Item name="username" label="ชื่อผู้ใช้" required extra="3–30 ตัวอักษร: a-z, 0-9, จุด หรือขีดล่าง"><Input placeholder="เช่น somchai.learn" autoComplete="username" /></Form.Item>
            <Form.Item name="avatar" label="URL รูปโปรไฟล์" extra="ใช้ URL รูปภาพได้; การอัปโหลดไฟล์รอ Media API"><Input placeholder="https://…" aria-label="URL รูปโปรไฟล์" /></Form.Item>
            <Form.Item name="name" label="ชื่อที่แสดง" rules={[{ required: true, whitespace: true, message: 'กรอกชื่อที่แสดง' }]}><Input autoComplete="nickname" /></Form.Item>
            <Form.Item label="อีเมลบัญชี" extra="อีเมลนี้ใช้เข้าสู่ระบบและแก้ไขในหน้านี้ไม่ได้"><Input value={user.email} readOnly /></Form.Item>
          </div>
        </section>

        <section className="profile-v2-section">
          <div className="profile-v2-section-title"><div><h2>ข้อมูลส่วนตัว</h2><Text type="secondary">ข้อมูลเพิ่มเติมเป็นตัวเลือก</Text></div></div>
          <div className="profile-v2-fields">
            <Form.Item name="firstName" label="ชื่อจริง (ไทย)"><Input autoComplete="given-name" /></Form.Item>
            <Form.Item name="lastName" label="นามสกุล (ไทย)"><Input autoComplete="family-name" /></Form.Item>
            <Form.Item name="firstNameEnglish" label="First name (English)"><Input autoComplete="given-name" /></Form.Item>
            <Form.Item name="lastNameEnglish" label="Last name (English)"><Input autoComplete="family-name" /></Form.Item>
            <Form.Item name="birthDate" label="วันเกิด"><Input type="date" max={localToday} /></Form.Item>
            <Form.Item name="phone" label="เบอร์โทรศัพท์"><Input autoComplete="tel" /></Form.Item>
            <Form.Item name="bio" label="แนะนำตัว" className="profile-v2-wide"><Input.TextArea rows={3} maxLength={600} placeholder="เล่าเกี่ยวกับตัวคุณสั้น ๆ" /></Form.Item>
          </div>
        </section>

        <section className="profile-v2-section">
          <div className="profile-v2-section-title"><div><h2>การเรียนและเป้าหมาย</h2><Text type="secondary">ช่วยแนะนำเนื้อหาที่ตรงกับสิ่งที่สนใจ</Text></div></div>
          <div className="profile-v2-fields">
            <Form.Item name="school" label="โรงเรียน / มหาวิทยาลัย"><Input placeholder="ชื่อสถานศึกษา" /></Form.Item>
            <Form.Item name="educationLevel" label="ระดับการศึกษา"><Select allowClear placeholder="เลือกระดับ" options={['ม.1','ม.2','ม.3','ม.4','ม.5','ม.6','มหาวิทยาลัย','อื่น ๆ'].map((label) => ({ value: label, label }))} /></Form.Item>
            <Form.Item name="interests" label="วิชาที่สนใจ" className="profile-v2-wide"><Select mode="multiple" allowClear placeholder="เลือกได้หลายวิชา" options={interests.map((label) => ({ value: label, label }))} /></Form.Item>
            <Form.Item name="learningGoals" label="เป้าหมายการเรียน / การสอบ" className="profile-v2-wide"><Select mode="multiple" allowClear placeholder="เลือกเป้าหมายได้หลายข้อ" options={goals.map((label) => ({ value: label, label }))} /></Form.Item>
          </div>
        </section>

        <section className="profile-v2-section">
          <div className="profile-v2-section-title"><div><h2>ชื่อบนใบรับรอง</h2><Text type="secondary">ระบุชื่อเต็มตามที่ต้องการให้พิมพ์บนใบรับรอง</Text></div></div>
          <Form.Item name="certificateName" label="ชื่อผู้รับใบรับรอง"><Input placeholder="หากเว้นว่าง จะใช้ชื่อจริงและนามสกุล หรือชื่อที่แสดง" /></Form.Item>
          <div className="profile-v2-certificate-preview">ตัวอย่าง: <strong>{values.certificateName?.trim() || [values.firstName, values.lastName].filter(Boolean).join(' ').trim() || values.name || user.name}</strong></div>
        </section>

        <section className="profile-v2-section profile-v2-google">
          <div className="profile-v2-section-title"><div><h2>บัญชี Google</h2><Text type="secondary">สถานะจากระบบบัญชี</Text></div></div>
          <Text>{googleEmail ? 'เชื่อมบัญชี Google แล้ว' : 'ยังไม่ได้เชื่อมบัญชี Google'}</Text>
          <div className="profile-v2-demo-tag">การเชื่อมบัญชีต้องผ่าน Google OAuth ของ Backend ไม่สามารถเปลี่ยนสถานะด้วยการบันทึกโปรไฟล์</div>
        </section>
      </div>
      <div className="profile-v2-save"><Button type="primary" htmlType="submit" size="large" loading={saving}>บันทึกโปรไฟล์</Button></div>
    </Form>
  );
}
