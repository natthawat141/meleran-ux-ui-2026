import React, { useState } from 'react';
import { Alert, Avatar, Button, Descriptions, Empty, Form, Input, Modal, Pagination, Popconfirm, Segmented, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import type { TableProps } from 'antd';
import { AppstoreOutlined, ArrowRightOutlined, BookOutlined, ClockCircleOutlined, DollarOutlined, MailOutlined, PlusOutlined, TrophyOutlined, UnorderedListOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLms } from '../../store';
import { CourseProgress, PageTitle, StatusTag } from '../../components/common';
import { formatPrice, flattenItems, instructorFor } from '../../data';
import { DirectorySearch, matchesDirectorySearch, useDirectorySearch } from '../../components/DirectorySearch';
import type { Course, InstructorInvite, InstructorRequest, Order, QuizAttempt, Role, User } from '../../types';
import './admin-courses.css';
import { BusinessAnalyticsPage } from './BusinessAnalyticsPage';
import { FinanceReportPage } from './FinanceReportPage';
import './admin-users.css';

const { Text, Title } = Typography;

export function AdminBusinessAnalyticsPage() {
  const { data } = useLms();
  return <BusinessAnalyticsPage courses={data.courses} />;
}

export function AdminFinanceReportPage() {
  const { data } = useLms();
  return <FinanceReportPage courses={data.courses} />;
}

export function AdminDashboardPage() {
  const { data } = useLms();
  const pendingRequests = data.instructorRequests.filter((request) => request.status === 'pending').length;
  const pendingEssays = data.attempts.filter((attempt) => attempt.essayStatus === 'pending').length;
  const sales = data.orders.filter((order) => order.status === 'paid').reduce((sum, order) => sum + order.amount, 0);

  return (
    <>
      <PageTitle eyebrow="ผู้ดูแลระบบ" title="ภาพรวมระบบ" subtitle="ตรวจงานที่ต้องดำเนินการและดูสถานะข้อมูลตัวอย่าง" actions={<Space wrap><Link to="/admin/business-analytics"><Button>ภาพรวมธุรกิจ</Button></Link><Link to="/admin/reports/finance"><Button>รายงานการเงิน</Button></Link></Space>} />
      <div className="admin-work-summary">
        <Link to="/admin/users"><span>ผู้เรียนในระบบ</span><strong>{data.users.filter(user => user.role === 'learner').length}</strong><small>จากผู้ใช้ทั้งหมด {data.users.length} คน</small></Link>
        <Link to="/admin/instructors"><span>ผู้สอน</span><strong>{data.users.filter(user => user.role === 'instructor').length}</strong><small>ตรวจผู้สอนและคำขอ</small></Link>
        <Link to="/admin/courses"><span>การลงทะเบียน</span><strong>{data.enrollments.length}</strong><small>จำนวนรายการ ไม่ใช่ผู้เรียนไม่ซ้ำ</small></Link>
        <Link to="/admin/orders"><span>คำสั่งซื้อรอดำเนินการ</span><strong>{data.orders.filter(order => order.status === 'pending').length}</strong><small>ล้มเหลว {data.orders.filter(order => order.status === 'failed').length} รายการ</small></Link>
      </div>
      <div className="admin-work-summary">
        <Link to="/admin/instructors">
          <span>คำขอผู้สอน</span>
          <strong>{pendingRequests}</strong>
          <small>
            รอพิจารณา <ArrowRightOutlined />
          </small>
        </Link>
        <Link to="/teach/quizzes">
          <span>คำตอบข้อเขียน</span>
          <strong>{pendingEssays}</strong>
          <small>
            รอตรวจจากผู้สอน <ArrowRightOutlined />
          </small>
        </Link>
        <Link to="/admin/courses">
          <span>คอร์สเผยแพร่</span>
          <strong>{data.courses.filter((course) => course.status === 'published').length}</strong>
          <small>
            จาก {data.courses.length} คอร์ส <ArrowRightOutlined />
          </small>
        </Link>
        <Link to="/admin/orders">
          <span>ยอดซื้อสำเร็จ</span>
          <strong>฿{sales.toLocaleString('th-TH')}</strong>
          <small>
            ข้อมูลการชำระจำลอง <ArrowRightOutlined />
          </small>
        </Link>
      </div>
      <section className="admin-recent">
        <div className="admin-recent-heading">
          <Title level={4}>คอร์สล่าสุด</Title>
          <Link to="/admin/courses">ดูคอร์สทั้งหมด</Link>
        </div>
        {data.courses.slice(0, 5).map((course) => (
          <Link to={`/admin/courses/${course.id}`} className="admin-course-row" key={course.id}>
            <div>
              <strong>{course.title}</strong>
              <Text type="secondary">
                {instructorFor(data, course)?.name} · {flattenItems(course).length} เนื้อหา
              </Text>
            </div>
            <StatusTag status={course.status} />
            <ArrowRightOutlined />
          </Link>
        ))}
      </section>
    </>
  );
}

export function AdminUsersPage() {
  const { data, changeUserRole } = useLms();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');
  const roles = [
    { value: 'all', label: 'ทุกบทบาท' },
    { value: 'learner', label: 'ผู้เรียน' },
    { value: 'instructor', label: 'ผู้สอน' },
    { value: 'admin', label: 'แอดมิน' },
  ];
  const { query, filter, setQuery, setFilter } = useDirectorySearch('role', roles);
  const users = data.users.filter(
    (user) =>
      (filter === 'all' || user.role === filter) &&
      (statusFilter === 'all' || (user.status ?? 'pending') === statusFilter) &&
      matchesDirectorySearch(query, [
        user.id,
        user.name,
        user.email,
        user.username,
        user.bio,
        user.status,
        user.status === 'active' ? 'ใช้งาน' : 'รอเปิดใช้งาน',
        user.role,
        roles.find((entry) => entry.value === user.role)?.label,
      ])
  );

  const columns: TableProps<User>['columns'] = [
    {
      title: 'ผู้ใช้',
      render: (_, user) => (
        <div className="admin-user-cell">
          <Avatar src={user.avatar} size={38}>{user.name.slice(0, 1) || <UserOutlined />}</Avatar>
          <div className="table-course-name">
            <strong>{user.name}</strong>
            <Text type="secondary">{user.email}{user.username ? ` · @${user.username}` : ''}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'สถานะ',
      render: (_, user) =>
        user.status === 'active' ? <Tag color="success">ใช้งาน</Tag> : <Tag color="warning">รอเปิดใช้งาน</Tag>,
    },
    {
      title: 'ซื้อสำเร็จ',
      render: (_, user) => (
        <Link to={`/admin/orders?status=paid&q=${encodeURIComponent(user.email || user.id)}`}>
          {data.orders.filter((order) => order.userId === user.id && order.status === 'paid').length} รายการ
        </Link>
      ),
    },
    {
      title: 'บทบาท',
      render: (_, user) => (
        <Select
          aria-label={`บทบาทของ ${user.name}`}
          value={user.role}
          style={{ width: 130 }}
          onChange={(role: Role) => {
            changeUserRole(user.id, role);
            message.success('ปรับบทบาทแล้ว');
          }}
          options={[
            { value: 'learner', label: 'ผู้เรียน' },
            { value: 'instructor', label: 'ผู้สอน' },
            { value: 'admin', label: 'แอดมิน' },
          ]}
        />
      ),
    },
    {
      title: '',
      render: (_, user) => <Button onClick={() => navigate(`/admin/users/${user.id}`)}>ดูรายละเอียด</Button>,
    },
  ];

  return (
    <>
      <PageTitle eyebrow="ผู้ดูแลระบบ" title="ผู้ใช้งาน" subtitle="ค้นหาบัญชีด้วยชื่อ อีเมล รหัสผู้ใช้ หรือข้อมูลโปรไฟล์" />
      <DirectorySearch
        query={query}
        onQuery={setQuery}
        placeholder="ค้นหาชื่อ อีเมล รหัสผู้ใช้ หรือข้อมูลโปรไฟล์"
        filter={filter}
        onFilter={setFilter}
        filterLabel="บทบาทผู้ใช้"
        options={roles}
        count={users.length}
      />
      <div className="admin-users-toolbar">
        <Select aria-label="กรองตามสถานะ" value={statusFilter} onChange={setStatusFilter} options={[
          { value: 'all', label: 'ทุกสถานะ' },
          { value: 'active', label: 'ใช้งาน' },
          { value: 'pending', label: 'รอเปิดใช้งาน' },
          { value: 'invited', label: 'ส่งคำเชิญแล้ว' },
          { value: 'suspended', label: 'ระงับ' },
        ]} />
        <Text type="secondary">แสดง {users.length} บัญชี</Text>
      </div>
      <Alert className="table-note" type="info" showIcon message="การปรับบทบาทมีผลกับบัญชีตัวอย่างในเบราว์เซอร์นี้" />
      <Table
        key={`${query}:${filter}:${statusFilter}`}
        rowKey="id"
        columns={columns}
        dataSource={users}
        scroll={{ x: 700 }}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: 'ไม่พบผู้ใช้ที่ตรงกับคำค้นและตัวกรอง' }}
      />
    </>
  );
}

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, changeUserRole } = useLms();
  const user = data.users.find((item) => item.id === id);
  if (!user) return <Empty description="ไม่พบบัญชีผู้ใช้นี้" />;

  const enrollments = data.enrollments.filter((item) => item.userId === user.id);
  const orders = data.orders.filter((item) => item.userId === user.id).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const attempts = data.attempts.filter((item) => item.userId === user.id).slice().sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
  const certificates = data.certificates.filter((item) => item.userId === user.id).slice().sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const paidTotal = orders.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0);
  const formatDate = (value?: string, time = false) => {
    if (!value || Number.isNaN(new Date(value).getTime())) return '—';
    return new Date(value).toLocaleString('th-TH', time
      ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const orderColumns: TableProps<Order>['columns'] = [
    { title: 'คอร์ส', render: (_, order) => data.courses.find((course) => course.id === order.courseId)?.title ?? 'ไม่พบข้อมูลคอร์ส' },
    { title: 'วันที่', dataIndex: 'createdAt', render: (value: string) => formatDate(value, true) },
    { title: 'ยอดชำระ', dataIndex: 'amount', render: (value: number) => formatPrice(value) },
    { title: 'ช่องทาง', dataIndex: 'method', render: (value?: string) => value || '—' },
    { title: 'สถานะ', dataIndex: 'status', render: (value: Order['status']) => <Tag color={value === 'paid' ? 'success' : value === 'failed' || value === 'cancelled' ? 'error' : 'processing'}>{({ paid: 'ชำระแล้ว', pending: 'รอดำเนินการ', failed: 'ไม่สำเร็จ', cancelled: 'ยกเลิก' })[value]}</Tag> },
    { title: 'รหัสรายการ', dataIndex: 'id' },
  ];
  const attemptColumns: TableProps<QuizAttempt>['columns'] = [
    { title: 'แบบทดสอบ', render: (_, attempt) => data.quizzes.find((quiz) => quiz.id === attempt.quizId)?.title ?? 'แบบทดสอบ' },
    { title: 'คอร์ส', render: (_, attempt) => data.courses.find((course) => course.id === attempt.courseId)?.title ?? '—' },
    { title: 'ส่งเมื่อ', dataIndex: 'submittedAt', render: (value?: string) => formatDate(value, true) },
    { title: 'ผล', render: (_, attempt) => attempt.essayStatus === 'pending' ? <Tag color="processing">รอตรวจข้อเขียน</Tag> : attempt.passed === true ? <Tag color="success">ผ่าน · {attempt.finalPercent ?? attempt.percent ?? 0}%</Tag> : attempt.passed === false ? <Tag color="error">ยังไม่ผ่าน · {attempt.finalPercent ?? attempt.percent ?? 0}%</Tag> : <Tag>กำลังทำ</Tag> },
  ];
  const events: { id: string; date: string; title: string; description: string; icon: React.ReactNode; status?: string }[] = [
    ...enrollments.map((entry) => ({ id: `enrollment-${entry.id}`, date: entry.createdAt, title: 'ลงทะเบียนเรียน', description: data.courses.find((course) => course.id === entry.courseId)?.title ?? 'ไม่พบข้อมูลคอร์ส', icon: <BookOutlined /> })),
    ...orders.map((entry) => ({ id: `order-${entry.id}`, date: entry.createdAt, title: entry.status === 'paid' ? 'ซื้อคอร์สสำเร็จ' : 'ทำรายการสั่งซื้อ', description: `${data.courses.find((course) => course.id === entry.courseId)?.title ?? 'ไม่พบข้อมูลคอร์ส'} · ${entry.method || 'ไม่ระบุช่องทาง'} · ${formatPrice(entry.amount)}`, icon: <DollarOutlined />, status: entry.status })),
    ...attempts.flatMap((entry) => entry.submittedAt ? [{ id: `attempt-${entry.id}`, date: entry.submittedAt, title: 'ส่งคำตอบแบบทดสอบ', description: data.quizzes.find((quiz) => quiz.id === entry.quizId)?.title ?? 'แบบทดสอบ', icon: <ClockCircleOutlined />, status: entry.passed === true ? 'ผ่าน' : entry.passed === false ? 'ยังไม่ผ่าน' : 'รอตรวจ' }] : []),
    ...certificates.map((entry) => ({ id: `certificate-${entry.id}`, date: entry.issuedAt, title: 'ได้รับใบรับรอง', description: data.courses.find((course) => course.id === entry.courseId)?.title ?? 'ไม่พบข้อมูลคอร์ส', icon: <TrophyOutlined /> })),
  ].filter((entry) => !Number.isNaN(new Date(entry.date).getTime())).sort((a, b) => b.date.localeCompare(a.date));
  const profileItems: [string, string | string[] | undefined][] = [
    ['ชื่อผู้ใช้', user.username], ['ชื่อจริง (ไทย)', [user.firstName, user.lastName].filter(Boolean).join(' ')],
    ['ชื่อจริง (English)', [user.firstNameEnglish, user.lastNameEnglish].filter(Boolean).join(' ')], ['ชื่อบนใบรับรอง', user.certificateName],
    ['วันเกิด', user.birthDate ? formatDate(user.birthDate) : undefined], ['เบอร์โทรศัพท์', user.phone], ['โรงเรียน / มหาวิทยาลัย', user.school],
    ['ระดับการศึกษา', user.educationLevel], ['วิชาที่สนใจ', user.interests], ['เป้าหมายการเรียน', user.learningGoals],
    ['Google ที่เชื่อมไว้ (สถานะเดโม)', user.googleLinkedEmail], ['แนะนำตัว', user.bio],
  ];

  return (
    <>
      <div className="admin-user-detail-heading">
        <Avatar size={58} src={user.avatar}>{user.name.slice(0, 1) || <UserOutlined />}</Avatar>
        <div className="admin-user-detail-identity"><Text type="secondary">บัญชีผู้ใช้ · {user.id}</Text><Title level={2}>{user.name}</Title><Text>{user.email}{user.username ? ` · @${user.username}` : ''}</Text></div>
        <div className="admin-user-detail-status"><Tag color={user.status === 'active' ? 'success' : 'processing'}>{user.status === 'active' ? 'ใช้งาน' : user.status === 'suspended' ? 'ระงับ' : user.status === 'invited' ? 'ส่งคำเชิญแล้ว' : 'รอเปิดใช้งาน'}</Tag><Link to="/admin/users"><Button>กลับรายการ</Button></Link></div>
      </div>
      <div className="admin-user-metrics"><div><span>คอร์สที่ลงทะเบียน</span><strong>{enrollments.length}</strong></div><div><span>ยอดซื้อที่ชำระแล้ว</span><strong>{formatPrice(paidTotal)}</strong></div><div><span>ใบรับรอง</span><strong>{certificates.length}</strong></div><div><span>กิจกรรมที่มีวันที่</span><strong>{events.length}</strong></div></div>
      <Tabs className="admin-user-tabs" items={[
        { key: 'profile', label: 'ข้อมูลบัญชี', children: <div className="admin-user-tab-content"><section className="admin-user-section"><div className="admin-user-section-heading"><div><Title level={5}>บัญชีและสิทธิ์</Title><Text type="secondary">ข้อมูลระบุตัวตนและบทบาทของบัญชี</Text></div></div><Descriptions bordered size="small" column={2}><Descriptions.Item label="รหัสบัญชี">{user.id}</Descriptions.Item><Descriptions.Item label="อีเมลเข้าสู่ระบบ">{user.email}</Descriptions.Item><Descriptions.Item label="สถานะ">{user.status ?? 'pending'}</Descriptions.Item><Descriptions.Item label="บทบาท"><Select aria-label="เปลี่ยนบทบาทผู้ใช้" value={user.role} style={{ width: 160 }} onChange={(role: Role) => { changeUserRole(user.id, role); message.success('ปรับบทบาทแล้ว'); }} options={[{ value: 'learner', label: 'ผู้เรียน' }, { value: 'instructor', label: 'ผู้สอน' }, { value: 'admin', label: 'แอดมิน' }]}/></Descriptions.Item></Descriptions></section><section className="admin-user-section"><div className="admin-user-section-heading"><div><Title level={5}>ข้อมูลส่วนตัวและการเรียน</Title><Text type="secondary">ข้อมูลที่ผู้ใช้กรอกไว้ในโปรไฟล์</Text></div></div><Descriptions bordered size="small" column={2}>{profileItems.map(([label, value]) => <Descriptions.Item key={label} label={label}>{Array.isArray(value) ? value.join(' · ') || '—' : value || '—'}</Descriptions.Item>)}</Descriptions></section><Alert type="info" showIcon message="ข้อมูลโปรไฟล์ที่ยังไม่ได้กรอกจะแสดงเป็น —"/></div> },
        { key: 'learning', label: 'การเรียนและผลลัพธ์', children: <div className="admin-user-tab-content"><section className="admin-user-section"><div className="admin-user-section-heading"><div><Title level={5}>คอร์สที่ลงทะเบียน</Title><Text type="secondary">ความคืบหน้าคำนวณจากบทเรียนและแบบทดสอบที่บันทึกไว้</Text></div><Tag color="blue">{enrollments.length} คอร์ส</Tag></div>{enrollments.length ? <div className="admin-user-course-list">{enrollments.map((entry) => { const course = data.courses.find((item) => item.id === entry.courseId); return <div className="admin-user-course-row" key={entry.id}><div className="admin-user-course-main"><strong>{course?.title ?? 'ไม่พบข้อมูลคอร์ส'}</strong><Text type="secondary">ลงทะเบียน {formatDate(entry.createdAt)}{course ? ` · ${course.category} · ${course.level || 'ไม่ระบุระดับ'}` : ''}</Text></div>{course && <div className="admin-user-course-progress"><CourseProgress course={course} data={data} userId={user.id}/></div>}</div>; })}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีประวัติลงทะเบียนคอร์ส"/>}</section><section className="admin-user-section"><div className="admin-user-section-heading"><div><Title level={5}>ผลแบบทดสอบ</Title><Text type="secondary">รายการคำตอบที่ผู้เรียนส่งและสถานะการตรวจ</Text></div></div><Table size="small" rowKey="id" columns={attemptColumns} dataSource={attempts} pagination={{ pageSize: 5, hideOnSinglePage: true }} locale={{ emptyText: 'ยังไม่มีประวัติส่งแบบทดสอบ' }} scroll={{ x: 650 }}/></section><section className="admin-user-section"><div className="admin-user-section-heading"><div><Title level={5}>ใบรับรอง</Title><Text type="secondary">ใบรับรองที่ออกให้บัญชีนี้</Text></div><Tag color="blue">{certificates.length} ใบ</Tag></div>{certificates.length ? <Table size="small" rowKey="id" dataSource={certificates} pagination={false} columns={[{ title: 'คอร์ส', render: (_, cert) => data.courses.find((course) => course.id === cert.courseId)?.title ?? 'ไม่พบข้อมูลคอร์ส' }, { title: 'ชื่อผู้รับ', dataIndex: 'recipientName', render: (value: string | undefined) => value || user.certificateName || user.name }, { title: 'วันที่ออก', dataIndex: 'issuedAt', render: (value: string) => formatDate(value) }, { title: 'รหัสตรวจสอบ', dataIndex: 'code' }]} scroll={{ x: 520 }}/>: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีใบรับรอง"/>}</section></div> },
        { key: 'purchases', label: 'การซื้อและการชำระเงิน', children: <div className="admin-user-tab-content"><section className="admin-user-section"><div className="admin-user-section-heading"><div><Title level={5}>ประวัติซื้อคอร์ส</Title><Text type="secondary">แสดงรายการชำระเงินที่บันทึกไว้ในข้อมูลตัวอย่าง</Text></div><div className="admin-user-paid-total"><Text type="secondary">ยอดชำระสำเร็จ</Text><strong>{formatPrice(paidTotal)}</strong></div></div><Table size="small" rowKey="id" columns={orderColumns} dataSource={orders} pagination={{ pageSize: 6, hideOnSinglePage: true }} locale={{ emptyText: 'ยังไม่มีประวัติซื้อคอร์ส' }} scroll={{ x: 760 }}/></section><section className="admin-user-section"><div className="admin-user-section-heading"><div><Title level={5}>ประวัติเติมเงิน</Title><Text type="secondary">กระเป๋าเงินและรายการเติมเงินของผู้ใช้</Text></div></div><Alert type="info" showIcon message="ต้นแบบนี้ยังไม่มีระบบกระเป๋าเงินหรือข้อมูลประวัติเติมเงิน" description="จึงยังไม่มียอดคงเหลือหรือรายการเติมเงินให้ตรวจสอบ ยอดด้านบนรวมเฉพาะคำสั่งซื้อคอร์สที่สถานะชำระแล้ว"/></section></div> },
        { key: 'activity', label: 'กิจกรรมในระบบ', children: <div className="admin-user-tab-content"><section className="admin-user-section"><div className="admin-user-section-heading"><div><Title level={5}>ประวัติกิจกรรม</Title><Text type="secondary">เรียงจากรายการล่าสุด โดยแสดงเฉพาะกิจกรรมที่มีวันที่บันทึกไว้</Text></div><Tag color="blue">{events.length} รายการ</Tag></div>{events.length ? <ol className="admin-user-timeline">{events.map((event) => <li key={event.id}><span className="admin-user-timeline-icon">{event.icon}</span><div className="admin-user-timeline-copy"><strong>{event.title}</strong><span>{event.description}</span><time>{formatDate(event.date, true)}</time></div>{event.status && <Tag>{event.status}</Tag>}</li>)}</ol> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีประวัติกิจกรรมที่บันทึกไว้"/>}<Alert className="admin-user-activity-note" type="info" showIcon message="ความคืบหน้ารายบทเรียนแสดงในแท็บการเรียน แต่ต้นแบบยังไม่ได้บันทึกเวลาแยกของแต่ละบท"/></section></div> },
      ]}/>
    </>
  );
}

interface InviteInstructorModalProps {
  onCreate: (invite: { name: string; email: string }) => string;
  open: boolean;
  onClose: () => void;
}

function InviteInstructorModal({ onCreate, open, onClose }: InviteInstructorModalProps) {
  const [form] = Form.useForm<{ name: string; email: string }>();
  const [inviteUrl, setInviteUrl] = useState('');

  return (
    <Modal
      title="เชิญผู้สอน"
      open={open}
      onCancel={onClose}
      footer={
        inviteUrl ? (
          <Button type="primary" onClick={onClose}>
            เสร็จ
          </Button>
        ) : undefined
      }
      okText="สร้างคำเชิญ"
      cancelText="ยกเลิก"
      onOk={async () => {
        if (inviteUrl) return onClose();
        const values = await form.validateFields();
        const token = onCreate(values);
        setInviteUrl(`${window.location.origin}/invite/${token}`);
      }}
    >
      {inviteUrl ? (
        <Alert
          type="success"
          showIcon
          message="สร้างคำเชิญแล้ว"
          description={
            <div>
              <Text>ส่งลิงก์นี้ให้ผู้สอนเพื่อเปิดบัญชี:</Text>
              <Input
                className="top-space"
                readOnly
                value={inviteUrl}
                onFocus={(event) => event.target.select()}
              />
            </div>
          }
        />
      ) : (
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="ชื่อผู้สอน" rules={[{ required: true, message: 'กรอกชื่อผู้สอน' }]}>
            <Input prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item
            name="email"
            label="อีเมล"
            rules={[
              { required: true, message: 'กรอกอีเมล' },
              { type: 'email', message: 'กรอกอีเมลที่ถูกต้อง' },
            ]}
          >
            <Input prefix={<MailOutlined />} />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}

export function AdminInstructorRequestsPage() {
  const { data, reviewInstructorRequest, createInstructorInvite } = useLms();
  const [inviteOpen, setInviteOpen] = useState(false);
  const requests = data.instructorRequests;

  const columns: TableProps<InstructorRequest>['columns'] = [
    {
      title: 'ผู้สมัคร',
      render: (_, request) => (
        <div className="table-course-name">
          <strong>{request.userName}</strong>
          <Text type="secondary">{request.email}</Text>
        </div>
      ),
    },
    { title: 'เหตุผลที่สมัคร', dataIndex: 'intro', ellipsis: true },
    { title: 'สถานะ', dataIndex: 'status', render: (status: string) => <StatusTag status={status} /> },
    { title: '', render: (_, request) => <Link to={`/admin/instructors/${request.id}`}>รายละเอียด</Link> },
    {
      title: 'การพิจารณา',
      render: (_, request) =>
        request.status === 'pending' ? (
          <Space>
            <Button onClick={() => reviewInstructorRequest(request.id, 'rejected', 'ขอข้อมูลเพิ่มเติม')}>ส่งกลับ</Button>
            <Button
              type="primary"
              onClick={() => {
                reviewInstructorRequest(request.id, 'approved');
                message.success('อนุมัติผู้สอนแล้ว');
              }}
            >
              อนุมัติ
            </Button>
          </Space>
        ) : (
          <Text type="secondary">ดำเนินการแล้ว</Text>
        ),
    },
  ];

  const inviteColumns: TableProps<InstructorInvite>['columns'] = [
    {
      title: 'ผู้ได้รับเชิญ',
      render: (_, invite) => (
        <div className="table-course-name">
          <strong>{invite.name}</strong>
          <Text type="secondary">{invite.email}</Text>
        </div>
      ),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      render: (status: string) => (status === 'pending' ? <Tag color="warning">รอตอบรับ</Tag> : <Tag color="success">ตอบรับแล้ว</Tag>),
    },
    { title: 'ลิงก์', dataIndex: 'token', render: (token: string) => <Link to={`/invite/${token}`}>เปิดคำเชิญ</Link> },
  ];

  return (
    <>
      <PageTitle
        eyebrow="ผู้ดูแลระบบ"
        title="ผู้สอนและคำขอ"
        subtitle="อนุมัติผู้สมัครหรือส่งคำเชิญเพื่อเปิดบัญชีผู้สอน"
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setInviteOpen(true)}>
            เชิญผู้สอน
          </Button>
        }
      />
      <Title level={4}>คำขอที่ส่งเข้ามา</Title>
      <Table rowKey="id" dataSource={requests} columns={columns} pagination={{ pageSize: 6 }} locale={{ emptyText: 'ไม่มีคำขอผู้สอน' }} />
      <Title level={4} className="top-space">
        คำเชิญ
      </Title>
      <Table rowKey="id" dataSource={data.invitations} columns={inviteColumns} pagination={false} locale={{ emptyText: 'ยังไม่มีคำเชิญ' }} />
      <InviteInstructorModal open={inviteOpen} onClose={() => setInviteOpen(false)} onCreate={createInstructorInvite} />
    </>
  );
}

export function AdminInstructorRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, reviewInstructorRequest } = useLms();
  const request = data.instructorRequests.find((item) => item.id === id);
  if (!request) return <Empty description="ไม่พบคำขอนี้" />;

  return (
    <>
      <PageTitle
        eyebrow="คำขอผู้สอน"
        title={request.userName}
        subtitle={request.email}
        actions={
          <Link to="/admin/instructors">
            <Button>กลับรายการ</Button>
          </Link>
        }
      />
      <div className="request-detail">
        <Text type="secondary">แนะนำตัวและหัวข้อที่สนใจสอน</Text>
        <p>{request.intro}</p>
        <Text type="secondary">ส่งคำขอเมื่อ {new Date(request.createdAt).toLocaleDateString('th-TH')}</Text>
        {request.status === 'pending' ? (
          <Space className="top-space">
            <Button onClick={() => reviewInstructorRequest(request.id, 'rejected', 'ขอข้อมูลเพิ่มเติม')}>ส่งกลับให้แก้ไข</Button>
            <Button type="primary" onClick={() => reviewInstructorRequest(request.id, 'approved')}>
              อนุมัติผู้สอน
            </Button>
          </Space>
        ) : (
          <Alert className="top-space" type="info" message={`สถานะ: ${request.status}`} description={request.reviewNote} />
        )}
      </div>
    </>
  );
}

export function AdminCoursesPage() {
  const { data } = useLms();
  const navigate = useNavigate();
  const [view, setView] = useState<'table' | 'card'>('table');
  const [cardPage, setCardPage] = useState(1);
  const pendingCourseCount = data.courses.filter((course) => course.status === 'pending_review').length;

  const columns: TableProps<Course>['columns'] = [
    {
      title: 'คอร์ส',
      render: (_, course) => (
        <div className="table-course-name">
          <strong>{course.title}</strong>
          <Text type="secondary">
            {course.category} · {flattenItems(course).length} รายการ
          </Text>
        </div>
      ),
    },
    { title: 'ผู้สอน', render: (_, course) => instructorFor(data, course)?.name ?? '—' },
    { title: 'ราคา', render: (_, course) => formatPrice(course.price) },
    { title: 'สถานะ', dataIndex: 'status', render: (status: string) => <StatusTag status={status} /> },
    {
      title: 'จัดการ',
      render: (_, course) => (
        <Space wrap>
          <Button onClick={() => navigate(`/teach/courses/${course.id}/settings`)}>แก้ไขคอร์ส</Button>
          <Button onClick={() => navigate(`/teach/courses/${course.id}/curriculum`)}>จัดบทเรียน</Button>
          <Button type="text" onClick={() => navigate(`/admin/courses/${course.id}`)}>
            รายละเอียด
          </Button>
        </Space>
      ),
    },
  ];

  const pageSize = 9;
  const cardCourses = data.courses.slice((cardPage - 1) * pageSize, cardPage * pageSize);
  const switchView = (value: string) => {
    setView(value as 'table' | 'card');
    setCardPage(1);
  };

  return (
    <>
      <PageTitle
        eyebrow="ผู้ดูแลระบบ"
        title="คอร์สทั้งหมด"
        subtitle="สร้างคอร์สและจัดการเนื้อหาของผู้สอนทุกคน"
        actions={<Space>
          <Link to="/admin/courses/reviews"><Button>คิวตรวจคอร์ส ({pendingCourseCount})</Button></Link>
          <Link to="/teach/courses/new"><Button type="primary" icon={<PlusOutlined />}>สร้างคอร์ส</Button></Link>
        </Space>}
      />
      <div className="admin-courses-toolbar">
        <span>{data.courses.length} คอร์ส</span>
        <Segmented
          aria-label="รูปแบบการแสดงคอร์ส"
          value={view}
          onChange={switchView}
          options={[
            { value: 'table', label: 'ตาราง', icon: <UnorderedListOutlined /> },
            { value: 'card', label: 'การ์ด', icon: <AppstoreOutlined /> },
          ]}
        />
      </div>
      {view === 'table' ? (
        <Table rowKey="id" dataSource={data.courses} columns={columns} pagination={{ pageSize: 10 }} scroll={{ x: 850 }} />
      ) : (
        <>
          {data.courses.length ? (
            <div className="admin-course-card-grid">
              {cardCourses.map((course) => {
                const teacher = instructorFor(data, course);
                const lessonCount = flattenItems(course).length;
                const learnerCount = data.enrollments.filter((enrollment) => enrollment.courseId === course.id).length;
                return (
                  <article className="admin-course-card" key={course.id}>
                    <div className="admin-course-card-cover">
                      <img src={course.cover} alt={`ภาพปก ${course.title}`} loading="lazy" />
                      <StatusTag status={course.status} />
                    </div>
                    <div className="admin-course-card-body">
                      <div className="admin-course-card-category">
                        {course.category} <span>·</span> {course.level}
                      </div>
                      <h2>{course.title}</h2>
                      {course.subtitle && <p className="admin-course-card-summary">{course.subtitle}</p>}
                      <div className="admin-course-card-teacher">
                        <Avatar size={30}>{teacher?.name?.slice(0, 1) ?? 'ผ'}</Avatar>
                        <span>{teacher?.name ?? 'ยังไม่ระบุผู้สอน'}</span>
                        <strong>{formatPrice(course.price)}</strong>
                      </div>
                      <div className="admin-course-card-stats">
                        <span>{course.chapters.length} บท</span>
                        <span>{lessonCount} รายการเรียน</span>
                        <span>{learnerCount} ผู้เรียน</span>
                      </div>
                      <div className="admin-course-card-actions">
                        <Button onClick={() => navigate(`/teach/courses/${course.id}/settings`)}>แก้ไขคอร์ส</Button>
                        <Button onClick={() => navigate(`/teach/courses/${course.id}/curriculum`)}>จัดบทเรียน</Button>
                        <Button type="link" onClick={() => navigate(`/admin/courses/${course.id}`)}>
                          รายละเอียด
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <Empty description="ยังไม่มีคอร์ส" />
          )}
          {data.courses.length > pageSize && (
            <Pagination
              className="admin-course-card-pagination"
              current={cardPage}
              pageSize={pageSize}
              total={data.courses.length}
              onChange={setCardPage}
              showSizeChanger={false}
              showTotal={(total, range) => `${range[0]}–${range[1]} จาก ${total} คอร์ส`}
            />
          )}
        </>
      )}
    </>
  );
}

export function AdminCourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { data } = useLms();
  const course = data.courses.find((item) => item.id === courseId);
  if (!course) return <Empty description="ไม่พบคอร์สนี้" />;
  const teacher = instructorFor(data, course);

  return (
    <>
      <PageTitle
        eyebrow="รายละเอียดคอร์ส"
        title={course.title}
        subtitle={course.subtitle}
        actions={
          <Space>
            <Link to={`/teach/courses/${course.id}/preview`}><Button>ดูตัวอย่าง / เผยแพร่</Button></Link>
            <Link to="/admin/courses"><Button>กลับรายการ</Button></Link>
          </Space>
        }
      />
      <Descriptions bordered column={1}>
        <Descriptions.Item label="ผู้สอน">{teacher?.name}</Descriptions.Item>
        <Descriptions.Item label="ราคา">{formatPrice(course.price)}</Descriptions.Item>
        <Descriptions.Item label="สถานะ">
          <StatusTag status={course.status} />
        </Descriptions.Item>
        <Descriptions.Item label="เนื้อหา">
          {course.chapters.map((chapter) => `${chapter.title} (${chapter.items.length})`).join(' · ')}
        </Descriptions.Item>
        <Descriptions.Item label="ผู้เรียน">
          {data.enrollments.filter((item) => item.courseId === course.id).length} คน
        </Descriptions.Item>
      </Descriptions>
    </>
  );
}
