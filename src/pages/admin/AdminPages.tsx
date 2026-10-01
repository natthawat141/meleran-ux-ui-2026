import React, { useState } from 'react';
import { Alert, Avatar, Button, Descriptions, Empty, Form, Input, Modal, Pagination, Popconfirm, Segmented, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { TableProps } from 'antd';
import { AppstoreOutlined, ArrowRightOutlined, MailOutlined, PlusOutlined, UnorderedListOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLms } from '../../store';
import { PageTitle, StatusTag } from '../../components/common';
import { formatPrice, flattenItems, instructorFor } from '../../data';
import { DirectorySearch, matchesDirectorySearch, useDirectorySearch } from '../../components/DirectorySearch';
import type { Course, InstructorInvite, InstructorRequest, Role, User } from '../../types';
import './admin-courses.css';

const { Text, Title } = Typography;

export function AdminDashboardPage() {
  const { data } = useLms();
  const pendingRequests = data.instructorRequests.filter((request) => request.status === 'pending').length;
  const pendingEssays = data.attempts.filter((attempt) => attempt.essayStatus === 'pending').length;
  const sales = data.orders.filter((order) => order.status === 'paid').reduce((sum, order) => sum + order.amount, 0);

  return (
    <>
      <PageTitle eyebrow="ผู้ดูแลระบบ" title="ภาพรวมระบบ" subtitle="ตรวจงานที่ต้องดำเนินการและดูสถานะข้อมูลตัวอย่าง" />
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
      matchesDirectorySearch(query, [
        user.id,
        user.name,
        user.email,
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
        <div className="table-course-name">
          <strong>{user.name}</strong>
          <Text type="secondary">{user.email}</Text>
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
      <Alert className="table-note" type="info" showIcon message="การปรับบทบาทมีผลกับบัญชีตัวอย่างในเบราว์เซอร์นี้" />
      <Table
        key={`${query}:${filter}`}
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

  return (
    <>
      <PageTitle
        eyebrow="ผู้ใช้งาน"
        title={user.name}
        subtitle={user.email}
        actions={
          <Link to="/admin/users">
            <Button>กลับรายการ</Button>
          </Link>
        }
      />
      <Descriptions bordered column={1}>
        <Descriptions.Item label="รหัสบัญชี">{user.id}</Descriptions.Item>
        <Descriptions.Item label="อีเมล">{user.email}</Descriptions.Item>
        <Descriptions.Item label="สถานะ">{user.status}</Descriptions.Item>
        <Descriptions.Item label="เปลี่ยนบทบาท">
          <Select
            value={user.role}
            style={{ width: 180 }}
            onChange={(role: Role) => changeUserRole(user.id, role)}
            options={[
              { value: 'learner', label: 'ผู้เรียน' },
              { value: 'instructor', label: 'ผู้สอน' },
              { value: 'admin', label: 'แอดมิน' },
            ]}
          />
        </Descriptions.Item>
        <Descriptions.Item label="แนะนำตัว">{user.bio || '—'}</Descriptions.Item>
      </Descriptions>
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
        actions={
          <Link to="/teach/courses/new">
            <Button type="primary" icon={<PlusOutlined />}>
              สร้างคอร์ส
            </Button>
          </Link>
        }
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
          <Link to="/admin/courses">
            <Button>กลับรายการ</Button>
          </Link>
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
