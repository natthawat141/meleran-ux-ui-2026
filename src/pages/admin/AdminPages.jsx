import React, { useState } from 'react';
import { Alert, Avatar, Button, Descriptions, Empty, Form, Input, Modal, Pagination, Popconfirm, Segmented, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import { AppstoreOutlined, ArrowRightOutlined, BookOutlined, ClockCircleOutlined, DollarOutlined, MailOutlined, PlusOutlined, SearchOutlined, TrophyOutlined, UnorderedListOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLms } from '../../store.jsx';
import { CourseProgress, PageTitle, StatusTag } from '../../components/common.jsx';
import { formatPrice, flattenItems, instructorFor } from '../../data.js';
import './admin-courses.css';
import './admin-users.css';

const { Text, Title } = Typography;

export function AdminDashboardPage() {
  const { data } = useLms();
  const pendingRequests = data.instructorRequests.filter((request) => request.status === 'pending').length;
  const pendingEssays = data.attempts.filter((attempt) => attempt.essayStatus === 'pending').length;
  const sales = data.orders.filter((order) => order.status === 'paid').reduce((sum, order) => sum + order.amount, 0);
  return <><PageTitle eyebrow="ผู้ดูแลระบบ" title="ภาพรวมระบบ" subtitle="ตรวจงานที่ต้องดำเนินการและดูสถานะข้อมูลตัวอย่าง"/><div className="admin-work-summary"><Link to="/admin/instructors"><span>คำขอผู้สอน</span><strong>{pendingRequests}</strong><small>รอพิจารณา <ArrowRightOutlined/></small></Link><Link to="/teach/quizzes"><span>คำตอบข้อเขียน</span><strong>{pendingEssays}</strong><small>รอตรวจจากผู้สอน <ArrowRightOutlined/></small></Link><Link to="/admin/courses"><span>คอร์สเผยแพร่</span><strong>{data.courses.filter((course) => course.status === 'published').length}</strong><small>จาก {data.courses.length} คอร์ส <ArrowRightOutlined/></small></Link><Link to="/admin/orders"><span>ยอดซื้อสำเร็จ</span><strong>฿{sales.toLocaleString('th-TH')}</strong><small>ข้อมูลการชำระจำลอง <ArrowRightOutlined/></small></Link></div><section className="admin-recent"><div className="admin-recent-heading"><Title level={4}>คอร์สล่าสุด</Title><Link to="/admin/courses">ดูคอร์สทั้งหมด</Link></div>{data.courses.slice(0, 5).map((course) => <Link to={`/admin/courses/${course.id}`} className="admin-course-row" key={course.id}><div><strong>{course.title}</strong><Text type="secondary">{instructorFor(data, course)?.name} · {flattenItems(course).length} เนื้อหา</Text></div><StatusTag status={course.status}/><ArrowRightOutlined/></Link>)}</section></>;
}

const adminRoleLabels = { learner: 'ผู้เรียน', instructor: 'ผู้สอน', admin: 'แอดมิน' };
const adminStatusLabels = { active: 'ใช้งาน', pending: 'รอเปิดใช้งาน', invited: 'ส่งคำเชิญแล้ว', suspended: 'ระงับ' };

function adminDate(value, includeTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('th-TH', includeTime
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}

function adminEventsForUser(data, userId) {
  const courseTitle = (courseId) => data.courses.find((course) => course.id === courseId)?.title ?? 'ไม่พบข้อมูลคอร์ส';
  const events = [];
  data.enrollments.filter((item) => item.userId === userId).forEach((item) => events.push({
    id: 'enrollment-' + item.id, date: item.createdAt, title: 'ลงทะเบียนเรียน', description: courseTitle(item.courseId), icon: <BookOutlined/>,
  }));
  data.orders.filter((item) => item.userId === userId).forEach((item) => events.push({
    id: 'order-' + item.id, date: item.createdAt, title: item.status === 'paid' ? 'ซื้อคอร์สสำเร็จ' : 'ทำรายการสั่งซื้อ',
    description: courseTitle(item.courseId) + ' · ' + (item.method || 'ไม่ระบุช่องทาง') + ' · ' + formatPrice(item.amount),
    icon: <DollarOutlined/>, status: item.status,
  }));
  data.attempts.filter((item) => item.userId === userId).forEach((item) => {
    const quizTitle = data.quizzes.find((quiz) => quiz.id === item.quizId)?.title ?? 'แบบทดสอบ';
    if (item.submittedAt) events.push({
      id: 'attempt-' + item.id, date: item.submittedAt, title: 'ส่งคำตอบแบบทดสอบ', description: quizTitle,
      icon: <ClockCircleOutlined/>, status: item.passed === true ? 'ผ่าน' : item.passed === false ? 'ยังไม่ผ่าน' : 'รอตรวจ',
    });
    if (item.gradedAt) events.push({
      id: 'graded-' + item.id, date: item.gradedAt, title: 'ผู้สอนตรวจคำตอบแล้ว', description: quizTitle,
      icon: <TrophyOutlined/>, status: item.passed === true ? 'ผ่าน' : 'ตรวจแล้ว',
    });
  });
  data.certificates.filter((item) => item.userId === userId).forEach((item) => events.push({
    id: 'certificate-' + item.id, date: item.issuedAt, title: 'ได้รับใบรับรอง', description: courseTitle(item.courseId), icon: <TrophyOutlined/>,
  }));
  return events.filter((item) => item.date && !Number.isNaN(new Date(item.date).getTime())).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function adminStatusTag(status, context = 'record') {
  const color = status === 'active' || status === 'paid' || status === 'ผ่าน' ? 'success' : status === 'failed' || status === 'cancelled' || status === 'ยังไม่ผ่าน' ? 'error' : 'processing';
  const label = context === 'user' ? adminStatusLabels[status] : ({ active: 'ใช้งาน', paid: 'ชำระแล้ว', pending: 'รอดำเนินการ', failed: 'ไม่สำเร็จ', cancelled: 'ยกเลิก', passed: 'ผ่าน' }[status] ?? status);
  return <Tag color={color}>{label || '—'}</Tag>;
}

export function AdminUsersPage() {
  const { data, changeUserRole } = useLms();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const query = search.trim().toLocaleLowerCase();
  const users = data.users.filter((user) => {
    const matchesQuery = !query || [user.name, user.email, user.username, user.id].some((value) => String(value ?? '').toLocaleLowerCase().includes(query));
    return matchesQuery && (roleFilter === 'all' || user.role === roleFilter) && (statusFilter === 'all' || user.status === statusFilter);
  });
  const columns = [
    { title: 'ผู้ใช้', render: (_, user) => <div className="admin-user-cell"><Avatar src={user.avatar} size={38}>{user.name?.slice(0, 1) ?? <UserOutlined/>}</Avatar><div className="table-course-name"><strong>{user.name}</strong><Text type="secondary">{user.email}{user.username ? ' · @' + user.username : ''}</Text></div></div> },
    { title: 'สถานะ', render: (_, user) => adminStatusTag(user.status, 'user') },
    { title: 'บทบาท', render: (_, user) => <Select aria-label={`บทบาทของ ${user.name}`} value={user.role} style={{ width: 130 }} onChange={(role) => { changeUserRole(user.id, role); message.success('ปรับบทบาทแล้ว'); }} options={[{ value: 'learner', label: 'ผู้เรียน' }, { value: 'instructor', label: 'ผู้สอน' }, { value: 'admin', label: 'แอดมิน' }]}/> },
    { title: 'ประวัติ', render: (_, user) => <Button type="link" onClick={() => navigate('/admin/users/' + user.id)}>เปิดข้อมูลผู้ใช้</Button> },
  ];
  return <><PageTitle eyebrow="ผู้ดูแลระบบ" title="ผู้ใช้งาน" subtitle="ค้นหาบัญชี ตรวจบทบาท และเปิดดูประวัติการใช้งานรายคน"/><div className="admin-users-toolbar"><Input allowClear prefix={<SearchOutlined/>} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อ อีเมล ชื่อผู้ใช้ หรือรหัสบัญชี" aria-label="ค้นหาผู้ใช้"/><Select aria-label="กรองตามบทบาท" value={roleFilter} onChange={setRoleFilter} options={[{ value: 'all', label: 'ทุกบทบาท' }, ...Object.entries(adminRoleLabels).map(([value, label]) => ({ value, label }))]}/><Select aria-label="กรองตามสถานะ" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'ทุกสถานะ' }, ...Object.entries(adminStatusLabels).map(([value, label]) => ({ value, label }))]}/><Text type="secondary">แสดง {users.length} จาก {data.users.length} บัญชี</Text></div><Alert className="table-note" type="info" showIcon message="การปรับบทบาทมีผลกับบัญชีตัวอย่างในเบราว์เซอร์นี้"/><Table rowKey="id" columns={columns} dataSource={users} pagination={{ pageSize: 10, showTotal: (total) => `ทั้งหมด ${total} บัญชี` }} scroll={{ x: 760 }} locale={{ emptyText: 'ไม่พบบัญชีตามเงื่อนไขที่เลือก' }}/></>;
}

export function AdminUserDetailPage() {
  const { id } = useParams();
  const { data, changeUserRole } = useLms();
  const user = data.users.find((item) => item.id === id);
  if (!user) return <Empty description="ไม่พบบัญชีผู้ใช้นี้"/>;
  const enrollments = data.enrollments.filter((item) => item.userId === user.id);
  const orders = data.orders.filter((item) => item.userId === user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const attempts = data.attempts.filter((item) => item.userId === user.id).sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
  const certificates = data.certificates.filter((item) => item.userId === user.id).sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
  const events = adminEventsForUser(data, user.id);
  const paidTotal = orders.filter((item) => item.status === 'paid').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const profileValue = (value) => Array.isArray(value) ? value.join(' · ') || '—' : value || '—';
  const userOrderColumns = [
    { title: 'คอร์ส', render: (_, order) => data.courses.find((course) => course.id === order.courseId)?.title ?? 'ไม่พบข้อมูลคอร์ส' },
    { title: 'วันที่', dataIndex: 'createdAt', render: (value) => adminDate(value, true) },
    { title: 'ยอดชำระ', dataIndex: 'amount', render: (value) => formatPrice(value) },
    { title: 'ช่องทาง', dataIndex: 'method', render: (value) => value || '—' },
    { title: 'สถานะ', dataIndex: 'status', render: (value) => adminStatusTag(value) },
    { title: 'รหัสรายการ', dataIndex: 'id' },
  ];
  const userAttemptColumns = [
    { title: 'แบบทดสอบ', render: (_, attempt) => data.quizzes.find((quiz) => quiz.id === attempt.quizId)?.title ?? 'แบบทดสอบ' },
    { title: 'คอร์ส', render: (_, attempt) => data.courses.find((course) => course.id === attempt.courseId)?.title ?? '—' },
    { title: 'ส่งเมื่อ', dataIndex: 'submittedAt', render: (value) => adminDate(value, true) },
    { title: 'ผล', render: (_, attempt) => attempt.essayStatus === 'pending' ? <Tag color="processing">รอตรวจข้อเขียน</Tag> : attempt.passed === true ? <Tag color="success">ผ่าน · {attempt.finalPercent ?? attempt.percent ?? 0}%</Tag> : attempt.passed === false ? <Tag color="error">ยังไม่ผ่าน · {attempt.finalPercent ?? attempt.percent ?? 0}%</Tag> : <Tag>กำลังทำ</Tag> },
  ];
  const profileItems = [
    ['ชื่อผู้ใช้', user.username], ['ชื่อจริง (ไทย)', [user.firstName, user.lastName].filter(Boolean).join(' ')],
    ['ชื่อจริง (English)', [user.firstNameEnglish, user.lastNameEnglish].filter(Boolean).join(' ')], ['ชื่อบนใบรับรอง', user.certificateName],
    ['วันเกิด', adminDate(user.birthDate)], ['เบอร์โทรศัพท์', user.phone], ['โรงเรียน / มหาวิทยาลัย', user.school],
    ['ระดับการศึกษา', user.educationLevel], ['วิชาที่สนใจ', user.interests], ['เป้าหมายการเรียน', user.learningGoals],
    ['Google ที่เชื่อมไว้ (สถานะเดโม)', user.googleLinkedEmail], ['แนะนำตัว', user.bio],
  ];
  const tabItems = [
    { key: 'profile', label: 'ข้อมูลบัญชี', children: <div className="admin-user-tab-content"><section className="admin-user-section"><div className="admin-user-section-heading"><div><Title level={5}>บัญชีและสิทธิ์</Title><Text type="secondary">ข้อมูลระบุตัวตนและบทบาทของบัญชี</Text></div></div><Descriptions bordered size="small" column={2}><Descriptions.Item label="รหัสบัญชี">{user.id}</Descriptions.Item><Descriptions.Item label="อีเมลเข้าสู่ระบบ">{user.email}</Descriptions.Item><Descriptions.Item label="สถานะ">{adminStatusTag(user.status, 'user')}</Descriptions.Item><Descriptions.Item label="บทบาท"><Select aria-label="เปลี่ยนบทบาทผู้ใช้" value={user.role} style={{ width: 160 }} onChange={(role) => { changeUserRole(user.id, role); message.success('ปรับบทบาทแล้ว'); }} options={Object.entries(adminRoleLabels).map(([value, label]) => ({ value, label }))}/></Descriptions.Item></Descriptions></section><section className="admin-user-section"><div className="admin-user-section-heading"><div><Title level={5}>ข้อมูลส่วนตัวและการเรียน</Title><Text type="secondary">ข้อมูลที่ผู้ใช้กรอกไว้ในโปรไฟล์</Text></div></div><Descriptions bordered size="small" column={2}>{profileItems.map(([label, value]) => <Descriptions.Item key={label} label={label}>{profileValue(value)}</Descriptions.Item>)}</Descriptions></section><Alert type="info" showIcon message="ข้อมูลโปรไฟล์ที่ยังไม่ได้กรอกจะแสดงเป็น —"/></div> },
    { key: 'learning', label: 'การเรียนและผลลัพธ์', children: <div className="admin-user-tab-content"><section className="admin-user-section"><div className="admin-user-section-heading"><div><Title level={5}>คอร์สที่ลงทะเบียน</Title><Text type="secondary">ความคืบหน้าคำนวณจากบทเรียนและแบบทดสอบที่บันทึกไว้</Text></div><Tag color="blue">{enrollments.length} คอร์ส</Tag></div>{enrollments.length ? <div className="admin-user-course-list">{enrollments.map((enrollment) => { const course = data.courses.find((item) => item.id === enrollment.courseId); return <div className="admin-user-course-row" key={enrollment.id}><div className="admin-user-course-main"><strong>{course?.title ?? 'ไม่พบข้อมูลคอร์ส'}</strong><Text type="secondary">ลงทะเบียน {adminDate(enrollment.createdAt)}{course ? ' · ' + course.category + ' · ' + (course.level || 'ไม่ระบุระดับ') : ''}</Text></div>{course && <div className="admin-user-course-progress"><CourseProgress course={course} data={data} userId={user.id}/></div>}</div>; })}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีประวัติลงทะเบียนคอร์ส"/>}</section><section className="admin-user-section"><div className="admin-user-section-heading"><div><Title level={5}>ผลแบบทดสอบ</Title><Text type="secondary">รายการคำตอบที่ผู้เรียนส่งและสถานะการตรวจ</Text></div></div><Table size="small" rowKey="id" columns={userAttemptColumns} dataSource={attempts} pagination={{ pageSize: 5, hideOnSinglePage: true }} locale={{ emptyText: 'ยังไม่มีประวัติส่งแบบทดสอบ' }} scroll={{ x: 650 }}/></section><section className="admin-user-section"><div className="admin-user-section-heading"><div><Title level={5}>ใบรับรอง</Title><Text type="secondary">ใบรับรองที่ออกให้บัญชีนี้</Text></div><Tag color="blue">{certificates.length} ใบ</Tag></div>{certificates.length ? <Table size="small" rowKey="id" dataSource={certificates} pagination={false} columns={[{ title: 'คอร์ส', render: (_, certificate) => data.courses.find((course) => course.id === certificate.courseId)?.title ?? 'ไม่พบข้อมูลคอร์ส' }, { title: 'ชื่อผู้รับ', dataIndex: 'recipientName', render: (value) => value || user.certificateName || user.name }, { title: 'วันที่ออก', dataIndex: 'issuedAt', render: (value) => adminDate(value) }, { title: 'รหัสตรวจสอบ', dataIndex: 'code' }]} scroll={{ x: 520 }}/>: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีใบรับรอง"/>}</section></div> },
    { key: 'purchases', label: 'การซื้อและการชำระเงิน', children: <div className="admin-user-tab-content"><section className="admin-user-section"><div className="admin-user-section-heading"><div><Title level={5}>ประวัติซื้อคอร์ส</Title><Text type="secondary">แสดงรายการชำระเงินที่บันทึกไว้ในข้อมูลตัวอย่าง</Text></div><div className="admin-user-paid-total"><Text type="secondary">ยอดชำระสำเร็จ</Text><strong>{formatPrice(paidTotal)}</strong></div></div><Table size="small" rowKey="id" columns={userOrderColumns} dataSource={orders} pagination={{ pageSize: 6, hideOnSinglePage: true }} locale={{ emptyText: 'ยังไม่มีประวัติซื้อคอร์ส' }} scroll={{ x: 760 }}/></section><section className="admin-user-section"><div className="admin-user-section-heading"><div><Title level={5}>ประวัติเติมเงิน</Title><Text type="secondary">กระเป๋าเงินและรายการเติมเงินของผู้ใช้</Text></div></div><Alert type="info" showIcon message="ต้นแบบนี้ยังไม่มีระบบกระเป๋าเงินหรือข้อมูลประวัติเติมเงิน" description="จึงยังไม่มียอดคงเหลือหรือรายการเติมเงินให้ตรวจสอบ ยอดด้านบนรวมเฉพาะคำสั่งซื้อคอร์สที่สถานะชำระแล้ว"/></section></div> },
    { key: 'activity', label: 'กิจกรรมในระบบ', children: <div className="admin-user-tab-content"><section className="admin-user-section"><div className="admin-user-section-heading"><div><Title level={5}>ประวัติกิจกรรม</Title><Text type="secondary">เรียงจากรายการล่าสุด โดยแสดงเฉพาะกิจกรรมที่มีวันที่บันทึกไว้</Text></div><Tag color="blue">{events.length} รายการ</Tag></div>{events.length ? <ol className="admin-user-timeline">{events.map((event) => <li key={event.id}><span className="admin-user-timeline-icon">{event.icon}</span><div className="admin-user-timeline-copy"><strong>{event.title}</strong><span>{event.description}</span><time>{adminDate(event.date, true)}</time></div>{event.status && adminStatusTag(event.status)}</li>)}</ol> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีประวัติกิจกรรมที่บันทึกไว้"/>}<Alert className="admin-user-activity-note" type="info" showIcon message="ความคืบหน้ารายบทเรียนแสดงในแท็บการเรียน แต่ต้นแบบยังไม่ได้บันทึกเวลาแยกของแต่ละบท"/></section></div> },
  ];
  return <><div className="admin-user-detail-heading"><Avatar size={58} src={user.avatar}>{user.name?.slice(0, 1) ?? <UserOutlined/>}</Avatar><div className="admin-user-detail-identity"><Text type="secondary">บัญชีผู้ใช้ · {user.id}</Text><Title level={2}>{user.name}</Title><Text>{user.email}{user.username ? ' · @' + user.username : ''}</Text></div><div className="admin-user-detail-status">{adminStatusTag(user.status, 'user')}<Link to="/admin/users"><Button>กลับรายการ</Button></Link></div></div><div className="admin-user-metrics"><div><span>คอร์สที่ลงทะเบียน</span><strong>{enrollments.length}</strong></div><div><span>ยอดซื้อที่ชำระแล้ว</span><strong>{formatPrice(paidTotal)}</strong></div><div><span>ใบรับรอง</span><strong>{certificates.length}</strong></div><div><span>กิจกรรมที่มีวันที่</span><strong>{events.length}</strong></div></div><Tabs className="admin-user-tabs" items={tabItems}/></>;
}

function InviteInstructorModal({ onCreate, open, onClose }) {
  const [form] = Form.useForm();
  const [inviteUrl, setInviteUrl] = useState('');
  return <Modal title="เชิญผู้สอน" open={open} onCancel={onClose} footer={inviteUrl ? <Button type="primary" onClick={onClose}>เสร็จ</Button> : undefined} okText="สร้างคำเชิญ" cancelText="ยกเลิก" onOk={async () => { if (inviteUrl) return onClose(); const values = await form.validateFields(); const token = onCreate(values); setInviteUrl(`${window.location.origin}/invite/${token}`); }}>
    {inviteUrl ? <Alert type="success" showIcon message="สร้างคำเชิญแล้ว" description={<div><Text>ส่งลิงก์นี้ให้ผู้สอนเพื่อเปิดบัญชี:</Text><Input className="top-space" readOnly value={inviteUrl} onFocus={(event) => event.target.select()}/></div>}/> : <Form form={form} layout="vertical"><Form.Item name="name" label="ชื่อผู้สอน" rules={[{ required: true, message: 'กรอกชื่อผู้สอน' }]}><Input prefix={<UserOutlined/>}/></Form.Item><Form.Item name="email" label="อีเมล" rules={[{ required: true, type: 'email', message: 'กรอกอีเมลที่ถูกต้อง' }]}><Input prefix={<MailOutlined/>}/></Form.Item></Form>}
  </Modal>;
}

export function AdminInstructorRequestsPage() {
  const { data, reviewInstructorRequest, createInstructorInvite } = useLms();
  const [inviteOpen, setInviteOpen] = useState(false);
  const requests = data.instructorRequests;
  const columns = [
    { title: 'ผู้สมัคร', render: (_, request) => <div className="table-course-name"><strong>{request.userName}</strong><Text type="secondary">{request.email}</Text></div> },
    { title: 'เหตุผลที่สมัคร', dataIndex: 'intro', ellipsis: true },
    { title: 'สถานะ', dataIndex: 'status', render: (status) => <StatusTag status={status}/> },
    { title: '', render: (_, request) => <Link to={`/admin/instructors/${request.id}`}>รายละเอียด</Link> },
    { title: 'การพิจารณา', render: (_, request) => request.status === 'pending' ? <Space><Button onClick={() => reviewInstructorRequest(request.id, 'rejected', 'ขอข้อมูลเพิ่มเติม')}>ส่งกลับ</Button><Button type="primary" onClick={() => { reviewInstructorRequest(request.id, 'approved'); message.success('อนุมัติผู้สอนแล้ว'); }}>อนุมัติ</Button></Space> : <Text type="secondary">ดำเนินการแล้ว</Text> },
  ];
  const inviteColumns = [
    { title: 'ผู้ได้รับเชิญ', render: (_, invite) => <div className="table-course-name"><strong>{invite.name}</strong><Text type="secondary">{invite.email}</Text></div> },
    { title: 'สถานะ', dataIndex: 'status', render: (status) => status === 'pending' ? <Tag color="warning">รอตอบรับ</Tag> : <Tag color="success">ตอบรับแล้ว</Tag> },
    { title: 'ลิงก์', dataIndex: 'token', render: (token) => <Link to={`/invite/${token}`}>เปิดคำเชิญ</Link> },
  ];
  return <><PageTitle eyebrow="ผู้ดูแลระบบ" title="ผู้สอนและคำขอ" subtitle="อนุมัติผู้สมัครหรือส่งคำเชิญเพื่อเปิดบัญชีผู้สอน" actions={<Button type="primary" icon={<PlusOutlined/>} onClick={() => setInviteOpen(true)}>เชิญผู้สอน</Button>}/><Title level={4}>คำขอที่ส่งเข้ามา</Title><Table rowKey="id" dataSource={requests} columns={columns} pagination={{ pageSize: 6 }} locale={{ emptyText: 'ไม่มีคำขอผู้สอน' }}/><Title level={4} className="top-space">คำเชิญ</Title><Table rowKey="id" dataSource={data.invitations} columns={inviteColumns} pagination={false} locale={{ emptyText: 'ยังไม่มีคำเชิญ' }}/><InviteInstructorModal open={inviteOpen} onClose={() => { setInviteOpen(false); }} onCreate={createInstructorInvite}/></>;
}

export function AdminInstructorRequestDetailPage() {
  const { id } = useParams();
  const { data, reviewInstructorRequest } = useLms();
  const request = data.instructorRequests.find((item) => item.id === id);
  if (!request) return <Empty description="ไม่พบคำขอนี้"/>;
  return <><PageTitle eyebrow="คำขอผู้สอน" title={request.userName} subtitle={request.email} actions={<Link to="/admin/instructors"><Button>กลับรายการ</Button></Link>}/><div className="request-detail"><Text type="secondary">แนะนำตัวและหัวข้อที่สนใจสอน</Text><p>{request.intro}</p><Text type="secondary">ส่งคำขอเมื่อ {new Date(request.createdAt).toLocaleDateString('th-TH')}</Text>{request.status === 'pending' ? <Space className="top-space"><Button onClick={() => reviewInstructorRequest(request.id, 'rejected', 'ขอข้อมูลเพิ่มเติม')}>ส่งกลับให้แก้ไข</Button><Button type="primary" onClick={() => reviewInstructorRequest(request.id, 'approved')}>อนุมัติผู้สอน</Button></Space> : <Alert className="top-space" type="info" message={`สถานะ: ${request.status}`} description={request.reviewNote}/>}</div></>;
}

export function AdminCoursesPage() {
  const { data } = useLms();
  const navigate = useNavigate();
  const [view, setView] = useState('table');
  const [cardPage, setCardPage] = useState(1);
  const columns = [
    { title: 'คอร์ส', render: (_, course) => <div className="table-course-name"><strong>{course.title}</strong><Text type="secondary">{course.category} · {flattenItems(course).length} รายการ</Text></div> },
    { title: 'ผู้สอน', render: (_, course) => instructorFor(data, course)?.name ?? '—' },
    { title: 'ราคา', render: (_, course) => formatPrice(course.price) },
    { title: 'สถานะ', dataIndex: 'status', render: (status) => <StatusTag status={status}/> },
    { title: 'จัดการ', render: (_, course) => <Space wrap><Button onClick={() => navigate(`/teach/courses/${course.id}/settings`)}>แก้ไขคอร์ส</Button><Button onClick={() => navigate(`/teach/courses/${course.id}/curriculum`)}>จัดบทเรียน</Button><Button type="text" onClick={() => navigate(`/admin/courses/${course.id}`)}>รายละเอียด</Button></Space> },
  ];
  const pageSize = 9;
  const cardCourses = data.courses.slice((cardPage - 1) * pageSize, cardPage * pageSize);
  const switchView = (value) => { setView(value); setCardPage(1); };
  return <>
    <PageTitle eyebrow="ผู้ดูแลระบบ" title="คอร์สทั้งหมด" subtitle="สร้างคอร์สและจัดการเนื้อหาของผู้สอนทุกคน" actions={<Link to="/teach/courses/new"><Button type="primary" icon={<PlusOutlined/>}>สร้างคอร์ส</Button></Link>}/>
    <div className="admin-courses-toolbar"><span>{data.courses.length} คอร์ส</span><Segmented aria-label="รูปแบบการแสดงคอร์ส" value={view} onChange={switchView} options={[{ value: 'table', label: 'ตาราง', icon: <UnorderedListOutlined/> }, { value: 'card', label: 'การ์ด', icon: <AppstoreOutlined/> }]}/></div>
    {view === 'table' ? <Table rowKey="id" dataSource={data.courses} columns={columns} pagination={{ pageSize: 10 }} scroll={{ x: 850 }}/> : <>
      {data.courses.length ? <div className="admin-course-card-grid">{cardCourses.map((course) => {
        const teacher = instructorFor(data, course);
        const lessonCount = flattenItems(course).length;
        const learnerCount = data.enrollments.filter((enrollment) => enrollment.courseId === course.id).length;
        return <article className="admin-course-card" key={course.id}>
          <div className="admin-course-card-cover"><img src={course.cover} alt={`ภาพปก ${course.title}`} loading="lazy"/><StatusTag status={course.status}/></div>
          <div className="admin-course-card-body">
            <div className="admin-course-card-category">{course.category} <span>·</span> {course.level}</div>
            <h2>{course.title}</h2>
            {course.subtitle && <p className="admin-course-card-summary">{course.subtitle}</p>}
            <div className="admin-course-card-teacher"><Avatar size={30}>{teacher?.name?.slice(0, 1) ?? 'ผ'}</Avatar><span>{teacher?.name ?? 'ยังไม่ระบุผู้สอน'}</span><strong>{formatPrice(course.price)}</strong></div>
            <div className="admin-course-card-stats"><span>{course.chapters.length} บท</span><span>{lessonCount} รายการเรียน</span><span>{learnerCount} ผู้เรียน</span></div>
            <div className="admin-course-card-actions"><Button onClick={() => navigate(`/teach/courses/${course.id}/settings`)}>แก้ไขคอร์ส</Button><Button onClick={() => navigate(`/teach/courses/${course.id}/curriculum`)}>จัดบทเรียน</Button><Button type="link" onClick={() => navigate(`/admin/courses/${course.id}`)}>รายละเอียด</Button></div>
          </div>
        </article>;
      })}</div> : <Empty description="ยังไม่มีคอร์ส"/>}
      {data.courses.length > pageSize && <Pagination className="admin-course-card-pagination" current={cardPage} pageSize={pageSize} total={data.courses.length} onChange={setCardPage} showSizeChanger={false} showTotal={(total, range) => `${range[0]}–${range[1]} จาก ${total} คอร์ส`}/>}
    </>}
  </>;
}

export function AdminCourseDetailPage() {
  const { courseId } = useParams();
  const { data } = useLms();
  const course = data.courses.find((item) => item.id === courseId);
  if (!course) return <Empty description="ไม่พบคอร์สนี้"/>;
  const teacher = instructorFor(data, course);
  return <><PageTitle eyebrow="รายละเอียดคอร์ส" title={course.title} subtitle={course.subtitle} actions={<Link to="/admin/courses"><Button>กลับรายการ</Button></Link>}/><Descriptions bordered column={1}><Descriptions.Item label="ผู้สอน">{teacher?.name}</Descriptions.Item><Descriptions.Item label="ราคา">{formatPrice(course.price)}</Descriptions.Item><Descriptions.Item label="สถานะ"><StatusTag status={course.status}/></Descriptions.Item><Descriptions.Item label="เนื้อหา">{course.chapters.map((chapter) => `${chapter.title} (${chapter.items.length})`).join(' · ')}</Descriptions.Item><Descriptions.Item label="ผู้เรียน">{data.enrollments.filter((item) => item.courseId === course.id).length} คน</Descriptions.Item></Descriptions></>;
}
