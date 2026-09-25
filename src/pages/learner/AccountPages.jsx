import React from 'react';
import { Alert, Button, Descriptions, Empty, Form, Input, Popconfirm, Table, Tag, Typography, message } from 'antd';
import { PrinterOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import { useLms } from '../../store.jsx';
import { PageTitle, RolePill } from '../../components/common.jsx';
import { flattenItems } from '../../data.js';
import { ImageUploadField } from '../../components/ImageUploadField.jsx';

const { Text } = Typography;

export function CertificatesPage() {
  const { data, currentUser } = useLms();
  const certificates = data.certificates.filter((item) => currentUser.role === 'admin' || item.userId === currentUser.id);
  const columns = [
    { title: 'คอร์ส', render: (_, cert) => data.courses.find((course) => course.id === cert.courseId)?.title ?? 'คอร์สที่ถูกลบ' },
    { title: 'เลขอ้างอิง', dataIndex: 'code' },
    { title: 'วันที่ออก', dataIndex: 'issuedAt', render: (value) => new Date(value).toLocaleDateString('th-TH') },
    { title: '', render: (_, cert) => <Link to={`/account/certificates/${cert.id}`}><Button>เปิดใบรับรอง</Button></Link> },
  ];
  const enrolled = data.enrollments.filter((entry) => entry.userId === currentUser.id).map((entry) => data.courses.find((course) => course.id === entry.courseId)).filter(Boolean);
  return <><PageTitle eyebrow="บัญชีผู้เรียน" title="ใบรับรองของฉัน" subtitle="ใบรับรองจะปรากฏเมื่อเรียนครบและผ่านแบบทดสอบ รวมทั้งคำตอบข้อเขียนได้รับการตรวจแล้ว"/><Table rowKey="id" dataSource={certificates} columns={columns} pagination={false} locale={{ emptyText: 'ยังไม่มีใบรับรองที่ออกแล้ว' }}/>{enrolled.some((course) => !certificates.some((cert) => cert.courseId === course.id)) && <section className="certificate-progress"><Text strong>คอร์สที่กำลังเก็บความคืบหน้า</Text>{enrolled.filter((course) => !certificates.some((cert) => cert.courseId === course.id)).map((course) => { const items = flattenItems(course); const completed = items.filter((item) => item.type === 'quiz' ? data.attempts.some((attempt) => attempt.quizId === item.quizId && attempt.userId === currentUser.id && attempt.passed) : data.progress[`${course.id}:${item.id}`]?.[currentUser.id]).length; const waiting = data.attempts.some((attempt) => attempt.courseId === course.id && attempt.userId === currentUser.id && attempt.essayStatus === 'pending'); return <div key={course.id}><Link to={`/learn/courses/${course.id}`}>{course.title}</Link><Text type="secondary">{waiting ? ' · มีข้อเขียนรอผู้สอนตรวจ' : ` · ทำแล้ว ${completed}/${items.length} รายการ`}</Text></div>; })}</section>}</>;
}

export function CertificateDetailPage() {
  const { certificateId } = useParams();
  const { data } = useLms();
  const cert = data.certificates.find((item) => item.id === certificateId || item.code === certificateId);
  if (!cert) return <Empty description="ยังไม่มีใบรับรองนี้"/>;
  const user = data.users.find((item) => item.id === cert.userId);
  const course = data.courses.find((item) => item.id === cert.courseId);
  const teacher = data.users.find((item) => item.id === course?.instructorId);
  return <><div className="certificate-toolbar"><Link to="/account/certificates">กลับใบรับรอง</Link><Button icon={<PrinterOutlined/>} onClick={() => window.print()}>พิมพ์ / บันทึก PDF</Button></div><article className="certificate-paper"><div className="certificate-emblem"><SafetyCertificateOutlined/></div><Text className="certificate-overline">CERTIFICATE OF COMPLETION</Text><h1>ประกาศนียบัตร</h1><Text>มอบให้แก่</Text><h2>{user?.name}</h2><Text>เพื่อแสดงว่าได้เรียนครบและผ่านการประเมินในหลักสูตร</Text><h3>{course?.title}</h3><div className="certificate-signatures"><div><strong>{teacher?.name}</strong><span>ผู้สอน</span></div><div><strong>{new Date(cert.issuedAt).toLocaleDateString('th-TH')}</strong><span>วันที่ออก</span></div></div><div className="certificate-code">รหัสตรวจสอบ {cert.code} · <Link to={`/certificates/verify/${cert.code}`}>ตรวจสอบใบรับรอง</Link></div></article></>;
}

export function VerifyCertificatePage() {
  const { code } = useParams();
  const { data } = useLms();
  const cert = data.certificates.find((item) => item.code.toLowerCase() === code.toLowerCase());
  const user = data.users.find((item) => item.id === cert?.userId);
  const course = data.courses.find((item) => item.id === cert?.courseId);
  return <div className="public-page verify-page"><PageTitle title="ตรวจสอบใบรับรอง" subtitle="ผลตรวจจากข้อมูลที่บันทึกอยู่ในเบราว์เซอร์นี้"/>{cert ? <Alert type="success" showIcon message="พบใบรับรองในข้อมูลตัวอย่าง" description={<span>{user?.name} · {course?.title} · รหัส {cert.code}</span>}/> : <Alert type="error" showIcon message="ไม่พบรหัสใบรับรองนี้" description="ข้อมูลการตรวจเป็นข้อมูลเดโมในอุปกรณ์นี้"/>}</div>;
}

export function ProfilePage() {
  const { currentUser, updateProfile, resetDemo } = useLms();
  const [form] = Form.useForm();
  return <><PageTitle eyebrow="บัญชีของฉัน" title="ข้อมูลส่วนตัว" subtitle="จัดการรูปโปรไฟล์ ชื่อที่แสดง และข้อมูลแนะนำตัว"/>
    <Form form={form} layout="vertical" initialValues={{ name: currentUser.name, email: currentUser.email, bio: currentUser.bio, avatar: currentUser.avatar }} onFinish={(values) => { updateProfile({ name: values.name.trim(), bio: values.bio, avatar: values.avatar }); message.success('บันทึกข้อมูลส่วนตัวแล้ว'); }} className="profile-settings">
      <aside className="profile-identity"><Form.Item name="avatar" label="รูปโปรไฟล์"><ImageUploadField avatar/></Form.Item><strong>{currentUser.name}</strong><RolePill role={currentUser.role}/></aside>
      <section className="profile-edit-fields"><h2>เกี่ยวกับคุณ</h2><Form.Item label="ชื่อที่แสดง" name="name" rules={[{ required: true, whitespace: true, message: 'กรอกชื่อที่แสดง' }]}><Input autoComplete="name"/></Form.Item><Form.Item label="อีเมล" name="email" extra="อีเมลที่ใช้เข้าสู่ระบบ"><Input readOnly autoComplete="email"/></Form.Item><Form.Item label="แนะนำตัว" name="bio"><Input.TextArea rows={4} maxLength={600} placeholder="เล่าเกี่ยวกับตัวคุณสั้น ๆ"/></Form.Item><div className="profile-save-row"><Button type="primary" htmlType="submit">บันทึกการเปลี่ยนแปลง</Button></div></section>
    </Form>
    <details className="demo-reset-settings"><summary>เครื่องมือสำหรับทดลองระบบ</summary><p>เริ่มข้อมูลตัวอย่างใหม่ โดยล้างการแก้ไขและรายการที่สร้างไว้ในเบราว์เซอร์นี้</p><Popconfirm title="เริ่มข้อมูลตัวอย่างใหม่?" description="ข้อมูลที่คุณแก้ไขในเบราว์เซอร์นี้จะถูกล้าง" okText="เริ่มใหม่" cancelText="ยกเลิก" onConfirm={() => { resetDemo(); message.success('ตั้งค่าข้อมูลตัวอย่างใหม่แล้ว'); }}><Button danger>เริ่มข้อมูลตัวอย่างใหม่</Button></Popconfirm></details>
  </>;
}
