import React, { useState } from 'react';
import { Alert, Avatar, Button, Descriptions, Empty, Pagination, Popconfirm, Segmented, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import type { TableProps } from 'antd';
import { AppstoreOutlined, ArrowRightOutlined, PlusOutlined, UnorderedListOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLms } from '../../store';
import { CourseProgress } from '../../components/common';
import { PageTitle, StatusTag } from '@melearn/ui';
import { formatPrice, flattenItems, instructorFor } from '../../data';
import { DirectorySearch, matchesDirectorySearch, useDirectorySearch } from '../../components/DirectorySearch';
import type { Course, QuizAttempt, User } from '../../types';
import './admin-courses.css';
import './admin-users.css';

const { Text, Title } = Typography;

export function AdminDashboardPage() {
  const { data } = useLms();
  const pendingCourseReviews = data.courses.filter((course) => course.status === 'pending_review').length;

  return (
    <>
      <PageTitle eyebrow="ผู้ดูแลระบบ" title="ภาพรวมระบบ" subtitle="ดูจำนวนบัญชี คอร์ส การลงทะเบียน และคิวตรวจคอร์ส" />
      <div className="admin-work-summary">
        <Link to="/admin/users"><span>บัญชีผู้ใช้</span><strong>{data.users.length}</strong><small>บัญชีที่มีในระบบ</small></Link>
        <Link to="/admin/courses">
          <span>คอร์สทั้งหมด</span><strong>{data.courses.length}</strong><small>จัดการคอร์สของผู้สอน</small>
        </Link>
        <Link to="/admin/courses">
          <span>การลงทะเบียน</span><strong>{data.enrollments.length}</strong><small>จำนวนรายการลงทะเบียน</small>
        </Link>
        <Link to="/admin/courses/reviews">
          <span>คอร์สรอตรวจ</span><strong>{pendingCourseReviews}</strong><small>รอ Admin พิจารณา</small>
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
  const { data } = useLms();
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
        user.status === 'active' ? 'ใช้งาน' : user.status === 'suspended' ? 'ระงับ' : 'รอเปิดใช้งาน',
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
      render: (_, user) => user.status === 'active'
        ? <Tag color="success">ใช้งาน</Tag>
        : user.status === 'suspended'
          ? <Tag color="error">ระงับ</Tag>
          : <Tag color="warning">รอเปิดใช้งาน</Tag>,
    },
    {
      title: 'บทบาท',
      render: (_, user) => <Tag color={user.role === 'admin' ? 'blue' : user.role === 'instructor' ? 'cyan' : undefined}>{user.role === 'admin' ? 'แอดมิน' : user.role === 'instructor' ? 'ผู้สอน' : 'ผู้เรียน'}</Tag>,
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
          { value: 'suspended', label: 'ระงับ' },
        ]} />
        <Text type="secondary">แสดง {users.length} บัญชี</Text>
      </div>
      <Alert className="table-note" type="info" showIcon message="ตรวจดูบัญชีและผลการเรียนได้จากรายละเอียดผู้ใช้" />
      <Table
        key={`${query}:${filter}:${statusFilter}`}
        rowKey="id"
        columns={columns}
        dataSource={users}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: 'ไม่พบผู้ใช้ที่ตรงกับคำค้นและตัวกรอง' }}
      />
    </>
  );
}

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, assignInstructorRole } = useLms();
  const user = data.users.find((item) => item.id === id);
  if (!user) return <Empty description="ไม่พบบัญชีผู้ใช้นี้" />;

  const enrollments = data.enrollments.filter((item) => item.userId === user.id);
  const attempts = data.attempts
    .filter((item) => item.userId === user.id)
    .slice()
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
  const certificates = data.certificates
    .filter((item) => item.userId === user.id)
    .slice()
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const eligibleForInstructor = user.role === 'learner' && user.status === 'active';
  const statusLabel = user.status === 'active'
    ? 'ใช้งาน'
    : user.status === 'suspended'
      ? 'ระงับ'
      : 'รอเปิดใช้งาน';
  const statusColor = user.status === 'active'
    ? 'success'
    : user.status === 'suspended'
      ? 'error'
      : 'warning';
  const formatDate = (value?: string, time = false) => {
    if (!value || Number.isNaN(new Date(value).getTime())) return '—';
    return new Date(value).toLocaleString('th-TH', time
      ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const attemptColumns: TableProps<QuizAttempt>['columns'] = [
    { title: 'แบบทดสอบ', render: (_, attempt) => data.quizzes.find((quiz) => quiz.id === attempt.quizId)?.title ?? 'แบบทดสอบ' },
    { title: 'คอร์ส', render: (_, attempt) => data.courses.find((course) => course.id === attempt.courseId)?.title ?? '—' },
    { title: 'ส่งเมื่อ', dataIndex: 'submittedAt', render: (value?: string) => formatDate(value, true) },
    {
      title: 'ผล',
      render: (_, attempt) => attempt.essayStatus === 'pending'
        ? <Tag color="processing">รอตรวจข้อเขียน</Tag>
        : attempt.passed === true
          ? <Tag color="success">ผ่าน · {attempt.finalPercent ?? attempt.percent ?? 0}%</Tag>
          : attempt.passed === false
            ? <Tag color="error">ยังไม่ผ่าน · {attempt.finalPercent ?? attempt.percent ?? 0}%</Tag>
            : <Tag>กำลังทำ</Tag>,
    },
  ];
  const profileItems: [string, string | string[] | undefined][] = [
    ['ชื่อผู้ใช้', user.username], ['ชื่อจริง (ไทย)', [user.firstName, user.lastName].filter(Boolean).join(' ')],
    ['ชื่อจริง (English)', [user.firstNameEnglish, user.lastNameEnglish].filter(Boolean).join(' ')], ['ชื่อบนใบรับรอง', user.certificateName],
    ['วันเกิด', user.birthDate ? formatDate(user.birthDate) : undefined], ['เบอร์โทรศัพท์', user.phone], ['โรงเรียน / มหาวิทยาลัย', user.school],
    ['ระดับการศึกษา', user.educationLevel], ['วิชาที่สนใจ', user.interests], ['เป้าหมายการเรียน', user.learningGoals],
    ['Google ที่เชื่อมไว้ (สถานะเดโม)', user.googleLinkedEmail], ['แนะนำตัว', user.bio],
  ];
  const addInstructorRole = () => {
    const result = assignInstructorRole(user.id);
    if (result.ok) message.success(result.message || 'เพิ่มผู้สอนให้บัญชีนี้แล้ว');
    else message.error(result.message || 'ไม่สามารถเพิ่มผู้สอนให้บัญชีนี้ได้');
  };

  return (
    <>
      <div className="admin-user-detail-heading">
        <Avatar size={58} src={user.avatar}>{user.name.slice(0, 1) || <UserOutlined />}</Avatar>
        <div className="admin-user-detail-identity">
          <Text type="secondary">บัญชีผู้ใช้ · {user.id}</Text>
          <Title level={2}>{user.name}</Title>
          <Text>{user.email}{user.username ? ' · @' + user.username : ''}</Text>
        </div>
        <div className="admin-user-detail-status">
          <Tag color={statusColor}>{statusLabel}</Tag>
          {eligibleForInstructor && (
            <Popconfirm
              title="เพิ่มสิทธิ์ผู้สอนให้บัญชีนี้หรือไม่?"
              description="บัญชีนี้เป็นผู้เรียนที่ใช้งานอยู่ และจะเปลี่ยนเป็นผู้สอน"
              okText="เพิ่มผู้สอน"
              cancelText="ยกเลิก"
              onConfirm={addInstructorRole}
            >
              <Button type="primary">เพิ่มเป็นผู้สอน</Button>
            </Popconfirm>
          )}
          <Link to="/admin/users"><Button>กลับรายการ</Button></Link>
        </div>
      </div>
      <Tabs
        className="admin-user-tabs"
        items={[
          {
            key: 'profile',
            label: 'ข้อมูลบัญชี',
            children: (
              <div className="admin-user-tab-content">
                <section className="admin-user-section">
                  <div className="admin-user-section-heading">
                    <div>
                      <Title level={5}>บัญชีและสิทธิ์</Title>
                      <Text type="secondary">ข้อมูลระบุตัวตนและบทบาทของบัญชี</Text>
                    </div>
                  </div>
                  <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label="รหัสบัญชี">{user.id}</Descriptions.Item>
                    <Descriptions.Item label="อีเมลเข้าสู่ระบบ">{user.email}</Descriptions.Item>
                    <Descriptions.Item label="สถานะ">{statusLabel}</Descriptions.Item>
                    <Descriptions.Item label="บทบาท">
                      <Tag color={user.role === 'admin' ? 'blue' : user.role === 'instructor' ? 'cyan' : undefined}>
                        {user.role === 'admin' ? 'แอดมิน' : user.role === 'instructor' ? 'ผู้สอน' : 'ผู้เรียน'}
                      </Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </section>
                <section className="admin-user-section">
                  <div className="admin-user-section-heading">
                    <div>
                      <Title level={5}>ข้อมูลส่วนตัวและการเรียน</Title>
                      <Text type="secondary">ข้อมูลที่ผู้ใช้กรอกไว้ในโปรไฟล์</Text>
                    </div>
                  </div>
                  <Descriptions bordered size="small" column={2}>
                    {profileItems.map(([label, value]) => (
                      <Descriptions.Item key={label} label={label}>
                        {Array.isArray(value) ? value.join(' · ') || '—' : value || '—'}
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                </section>
                <Alert type="info" showIcon message="ข้อมูลโปรไฟล์ที่ยังไม่ได้กรอกจะแสดงเป็น —" />
              </div>
            ),
          },
          {
            key: 'learning',
            label: 'การเรียนและผลลัพธ์',
            children: (
              <div className="admin-user-tab-content">
                <section className="admin-user-section">
                  <div className="admin-user-section-heading">
                    <div>
                      <Title level={5}>คอร์สที่ลงทะเบียน</Title>
                      <Text type="secondary">ความคืบหน้าคำนวณจากบทเรียนและแบบทดสอบที่บันทึกไว้</Text>
                    </div>
                    <Tag color="blue">{enrollments.length} คอร์ส</Tag>
                  </div>
                  {enrollments.length ? (
                    <div className="admin-user-course-list">
                      {enrollments.map((entry) => {
                        const course = data.courses.find((item) => item.id === entry.courseId);
                        return (
                          <div className="admin-user-course-row" key={entry.id}>
                            <div className="admin-user-course-main">
                              <strong>{course?.title ?? 'ไม่พบข้อมูลคอร์ส'}</strong>
                              <Text type="secondary">
                                ลงทะเบียน {formatDate(entry.createdAt)}
                                {course ? ' · ' + course.category + ' · ' + (course.level || 'ไม่ระบุระดับ') : ''}
                              </Text>
                            </div>
                            {course && (
                              <div className="admin-user-course-progress">
                                <CourseProgress course={course} data={data} userId={user.id} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีประวัติลงทะเบียนคอร์ส" />
                  )}
                </section>
                <section className="admin-user-section">
                  <div className="admin-user-section-heading">
                    <div>
                      <Title level={5}>ผลแบบทดสอบ</Title>
                      <Text type="secondary">รายการคำตอบที่ผู้เรียนส่งและสถานะการตรวจ</Text>
                    </div>
                  </div>
                  <Table
                    size="small"
                    rowKey="id"
                    columns={attemptColumns}
                    dataSource={attempts}
                    pagination={{ pageSize: 5, hideOnSinglePage: true }}
                    locale={{ emptyText: 'ยังไม่มีประวัติส่งแบบทดสอบ' }}
                    scroll={{ x: 650 }}
                  />
                </section>
                <section className="admin-user-section">
                  <div className="admin-user-section-heading">
                    <div>
                      <Title level={5}>ใบรับรอง</Title>
                      <Text type="secondary">ใบรับรองที่ออกให้บัญชีนี้</Text>
                    </div>
                    <Tag color="blue">{certificates.length} ใบ</Tag>
                  </div>
                  {certificates.length ? (
                    <Table
                      size="small"
                      rowKey="id"
                      dataSource={certificates}
                      pagination={false}
                      columns={[
                        { title: 'คอร์ส', render: (_, cert) => data.courses.find((course) => course.id === cert.courseId)?.title ?? 'ไม่พบข้อมูลคอร์ส' },
                        { title: 'ชื่อผู้รับ', dataIndex: 'recipientName', render: (value: string | undefined) => value || user.certificateName || user.name },
                        { title: 'วันที่ออก', dataIndex: 'issuedAt', render: (value: string) => formatDate(value) },
                        { title: 'รหัสตรวจสอบ', dataIndex: 'code' },
                      ]}
                      scroll={{ x: 520 }}
                    />
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีใบรับรอง" />
                  )}
                </section>
              </div>
            ),
          },
        ]}
      />
    </>
  );
}

export function AdminInstructorsPage() {
  const { data } = useLms();
  const instructors = data.users.filter((user) => user.role === 'instructor');
  const columns: TableProps<User>['columns'] = [
    {
      title: 'ผู้สอน',
      render: (_, user) => (
        <div className="admin-user-cell">
          <Avatar src={user.avatar} size={38}>{user.name.slice(0, 1) || <UserOutlined />}</Avatar>
          <div className="table-course-name">
            <strong>{user.name}</strong>
            <Text type="secondary">{user.email}{user.username ? ' · @' + user.username : ''}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'สถานะ',
      render: (_, user) => user.status === 'active'
        ? <Tag color="success">ใช้งาน</Tag>
        : user.status === 'suspended'
          ? <Tag color="error">ระงับ</Tag>
          : <Tag color="warning">รอเปิดใช้งาน</Tag>,
    },
    {
      title: 'คอร์สที่ดูแล',
      render: (_, user) => data.courses.filter((course) => course.instructorId === user.id).length,
    },
    {
      title: '',
      render: (_, user) => <Link to={'/admin/users/' + user.id}><Button>ดูบัญชีผู้ใช้</Button></Link>,
    },
  ];

  return (
    <>
      <PageTitle
        eyebrow="ผู้ดูแลระบบ"
        title="ผู้สอน"
        subtitle="รายชื่อบัญชีผู้ใช้ที่มีบทบาทผู้สอน"
      />
      <Table
        rowKey="id"
        columns={columns}
        dataSource={instructors}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: 'ยังไม่มีบัญชีผู้สอน' }}
        scroll={{ x: 650 }}
      />
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
          <Button onClick={() => navigate(`/admin/courses/${course.id}/settings`)}>แก้ไขคอร์ส</Button>
          <Button onClick={() => navigate(`/admin/courses/${course.id}/curriculum`)}>จัดบทเรียน</Button>
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
          <Link to="/admin/courses/new"><Button type="primary" icon={<PlusOutlined />}>สร้างคอร์ส</Button></Link>
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
                        <Button onClick={() => navigate(`/admin/courses/${course.id}/settings`)}>แก้ไขคอร์ส</Button>
                        <Button onClick={() => navigate(`/admin/courses/${course.id}/curriculum`)}>จัดบทเรียน</Button>
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
            <Link to={`/admin/courses/${course.id}/preview`}><Button>ดูตัวอย่าง / เผยแพร่</Button></Link>
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
