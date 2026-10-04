import React, { useState } from 'react';
import dayjs from 'dayjs';
import { Button, Card, DatePicker, Form, Input, Modal, Popconfirm, Radio, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { TableProps } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Link, Navigate } from 'react-router-dom';
import { useLms } from '../store';
import { PageTitle } from '../components/common';
import { UserAvatar } from '../components/UserAvatar';
import { DirectorySearch, useDirectorySearch, matchesDirectorySearch } from '../components/DirectorySearch';
import type { Assignment } from '../types';
import './analytics/analytics.css';

const { Text } = Typography;

export interface AssignmentsPageProps {
  instructorId?: string;
  directoryBackTo?: string;
}

interface AssignmentFormValues {
  courseId: string;
  quizId: string;
  title?: string;
  stage: 'pre_test' | 'practice' | 'post_test';
  assigneeType: 'all_enrolled' | 'specific';
  assigneeIds?: string[];
  dueDate?: dayjs.Dayjs | null;
}

export function AssignmentsPage({ instructorId, directoryBackTo = '/admin/assignments' }: AssignmentsPageProps) {
  const { data, currentUser, saveAssignment, removeAssignment } = useLms();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [form] = Form.useForm<AssignmentFormValues>();

  const role = currentUser?.role || 'learner';
  const isLearner = role === 'learner';
  const isAdmin = role === 'admin';
  const isInstructor = role === 'instructor' || isAdmin;

  const courses = (data.courses || []).filter(
    (c) => c.instructorId === (isAdmin ? instructorId : currentUser?.id)
  );
  const owner = data.users.find((user) => user.id === instructorId);
  const searchOptions = [{ value: 'all', label: 'ทุกคอร์ส' }, ...courses.map((course) => ({ value: course.id, label: course.title }))];
  const { query, filter, setQuery, setFilter } = useDirectorySearch('course', searchOptions);
  const assignments = data.assignments || [];

  // Learner view: Filter assignments where learner is in assigneeIds or assigneeType === 'all_enrolled'
  const myEnrolledCourseIds = (data.enrollments || [])
    .filter((e) => e.userId === currentUser?.id)
    .map((e) => e.courseId);

  const learnerAssignments = assignments.filter((a) => {
    if (!myEnrolledCourseIds.includes(a.courseId)) return false;
    if (a.assigneeType === 'all_enrolled') return true;
    return a.assigneeIds?.includes(currentUser?.id ?? '');
  });

  const instructorAssignments = assignments.filter((a) => {
    const course = courses.find((c) => c.id === a.courseId);
    return course && (filter === 'all' || filter === a.courseId) && matchesDirectorySearch(query, [a.title, a.id, course.title]);
  });

  const handleOpenCreate = () => {
    setEditingAssignment(null);
    form.resetFields();
    if (courses[0]) {
      form.setFieldsValue({
        courseId: filter === 'all' ? courses[0].id : filter,
        stage: 'practice',
        assigneeType: 'all_enrolled',
      });
    }
    setModalOpen(true);
  };

  const handleOpenEdit = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    form.setFieldsValue({
      courseId: assignment.courseId,
      quizId: assignment.quizId,
      title: assignment.title,
      stage: assignment.stage,
      assigneeType: assignment.assigneeType,
      assigneeIds: assignment.assigneeIds || [],
      dueDate: assignment.dueDate ? dayjs(assignment.dueDate) : null,
    });
    setModalOpen(true);
  };

  const handleSave = (values: AssignmentFormValues) => {
    const course = data.courses.find((c) => c.id === values.courseId);
    const quiz = data.quizzes.find((q) => q.id === values.quizId);
    if (!courses.some((entry) => entry.id === values.courseId) || quiz?.courseId !== course?.id) {
      message.error('เลือกคอร์สและแบบฝึกหัดในขอบเขตผู้สอนนี้');
      return;
    }
    const enrolledUsers = (data.enrollments || [])
      .filter((e) => e.courseId === values.courseId)
      .map((e) => e.userId);

    const payload = {
      courseId: values.courseId,
      quizId: values.quizId,
      title: values.title || quiz?.title || 'แบบฝึกหัดมอบหมาย',
      stage: values.stage,
      assigneeType: values.assigneeType,
      assigneeIds: values.assigneeType === 'all_enrolled' ? enrolledUsers : values.assigneeIds || [],
      dueDate: values.dueDate ? values.dueDate.toISOString() : null,
      createdBy: editingAssignment?.createdBy || currentUser?.id,
    };

    saveAssignment(payload, editingAssignment?.id);
    message.success(editingAssignment ? 'แก้ไขงานมอบหมายแล้ว' : 'สร้างงานมอบหมายแล้ว');
    setModalOpen(false);
  };

  // Watched courseId for dynamic quiz list
  const watchedCourseId = Form.useWatch('courseId', form) || courses[0]?.id;
  const courseQuizzes = (data.quizzes || []).filter((q) => q.courseId === watchedCourseId);
  const courseEnrollments = (data.enrollments || []).filter((e) => e.courseId === watchedCourseId);

  // Learner columns
  const learnerColumns: TableProps<Assignment>['columns'] = [
    {
      title: 'ชื่องาน / แบบฝึกหัด',
      key: 'title',
      render: (_, row) => {
        const course = (data.courses || []).find((c) => c.id === row.courseId);
        return (
          <div>
            <strong>{row.title}</strong>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                คอร์ส: {course?.title}
              </Text>
            </div>
          </div>
        );
      },
    },
    {
      title: 'ประเภทงาน',
      key: 'stage',
      dataIndex: 'stage',
      render: (stage: string) => {
        switch (stage) {
          case 'pre_test':
            return <Tag color="blue">แบบทดสอบก่อนเรียน</Tag>;
          case 'post_test':
            return <Tag color="purple">แบบทดสอบหลังเรียน</Tag>;
          default:
            return <Tag>แบบฝึกหัด</Tag>;
        }
      },
    },
    {
      title: 'กำหนดส่ง',
      key: 'dueDate',
      dataIndex: 'dueDate',
      render: (date: string | null | undefined) => (date ? new Date(date).toLocaleDateString('th-TH') : 'ไม่กำหนด'),
    },
    {
      title: 'สถานะ',
      key: 'status',
      render: (_, row) => {
        const attempt = (data.attempts || []).find(
          (att) => att.quizId === row.quizId && att.userId === currentUser?.id
        );
        if (!attempt) return <Tag>ยังไม่ทำ</Tag>;
        if (attempt.essayStatus === 'pending') return <Tag color="warning">ส่งแล้ว (รอตรวจ)</Tag>;
        if (attempt.passed) return <Tag color="success">ผ่าน ({attempt.finalPercent ?? attempt.percent}%)</Tag>;
        return <Tag color="error">ยังไม่ผ่าน ({attempt.finalPercent ?? attempt.percent}%)</Tag>;
      },
    },
    {
      title: '',
      key: 'action',
      render: (_, row) => {
        const attempt = (data.attempts || []).find(
          (att) => att.quizId === row.quizId && att.userId === currentUser?.id
        );
        if (attempt && attempt.status === 'submitted') {
          return (
            <Link to={`/learn/attempts/${attempt.id}/result`}>
              <Button size="small">ดูผลงาน</Button>
            </Link>
          );
        }
        return (
          <Link to={`/learn/quizzes/${row.quizId}`}>
            <Button type="primary" size="small">
              {attempt ? 'ทำต่อ' : 'เริ่มทำ'}
            </Button>
          </Link>
        );
      },
    },
  ];

  // Instructor/Admin columns
  const instructorColumns: TableProps<Assignment>['columns'] = [
    {
      title: 'ชื่องานที่มอบหมาย',
      key: 'title',
      render: (_, row) => {
        const course = (data.courses || []).find((c) => c.id === row.courseId);
        return (
          <div>
            <strong>{row.title}</strong>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                คอร์ส: {course?.title}
              </Text>
            </div>
            {isAdmin && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                สร้างโดย: {data.users.find((user) => user.id === row.createdBy)?.name || 'ไม่ระบุผู้สร้าง'}
                {data.users.find((user) => user.id === row.createdBy)?.role === 'admin' ? ' (แอดมิน)' : ''}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'ระยะการวัดผล',
      key: 'stage',
      dataIndex: 'stage',
      render: (stage: string) => {
        switch (stage) {
          case 'pre_test':
            return <Tag color="blue">Pre-test</Tag>;
          case 'post_test':
            return <Tag color="purple">Post-test</Tag>;
          default:
            return <Tag>งานทั่วไป</Tag>;
        }
      },
    },
    {
      title: 'ผู้รับมอบหมาย',
      key: 'assignees',
      render: (_, row) =>
        row.assigneeType === 'all_enrolled' ? (
          <Tag color="cyan">ผู้เรียนทุกคนที่ลงทะเบียน</Tag>
        ) : (
          <Tag>{row.assigneeIds?.length || 0} คนที่ระบุ</Tag>
        ),
    },
    {
      title: 'ส่งแล้ว / ทั้งหมด',
      key: 'completion',
      render: (_, row) => {
        const targetIds =
          row.assigneeType === 'all_enrolled'
            ? (data.enrollments || []).filter((e) => e.courseId === row.courseId).map((e) => e.userId)
            : row.assigneeIds || [];
        const submittedCount = (data.attempts || []).filter(
          (att) => att.quizId === row.quizId && targetIds.includes(att.userId) && att.status === 'submitted'
        ).length;
        return `${submittedCount}/${targetIds.length}`;
      },
    },
    {
      title: 'กำหนดส่ง',
      key: 'dueDate',
      dataIndex: 'dueDate',
      render: (date: string | null | undefined) => (date ? new Date(date).toLocaleDateString('th-TH') : 'ไม่กำหนด'),
    },
    {
      title: '',
      key: 'action',
      render: (_, row) => (
        <Space>
          <Link to={`/teach/quizzes/${row.quizId}/attempts`}>
            <Button size="small">ดูคำตอบ</Button>
          </Link>
          <Button size="small" onClick={() => handleOpenEdit(row)}>
            แก้ไข
          </Button>
          <Popconfirm
            title="ลบงานมอบหมายนี้หรือไม่?"
            onConfirm={() => {
              removeAssignment(row.id);
              message.success('ลบงานมอบหมายแล้ว');
            }}
          >
            <Button size="small" danger>
              ลบ
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (isAdmin && !instructorId) return <Navigate to="/admin/assignments" replace />;

  return (
    <div className="analytics-container assignment-workspace">
      {isAdmin && <Link to={directoryBackTo}>กลับเลือกผู้สอน</Link>}
      <PageTitle
        eyebrow={isLearner ? 'การเรียนรู้ของฉัน' : 'การจัดการงาน'}
        title={isAdmin ? `งานมอบหมาย / ${owner?.name || 'ผู้สอน'}` : 'งานมอบหมาย (Assignments)'}
        subtitle={
          isLearner
            ? 'แบบทดสอบและงานที่ผู้สอนมอบหมายให้คุณทำตามกำหนดเวลา'
            : 'มอบหมายแบบฝึกหัดหรือข้อสอบให้ผู้เรียนที่ลงทะเบียนในคอร์สอย่างชัดเจน'
        }
        actions={
          isInstructor && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate} disabled={!courses.length}>
              สร้างงานมอบหมาย
            </Button>
          )
        }
      />
      {isAdmin && (
        <div className="assignment-owner">
          <UserAvatar user={owner} size={40} />
          <div>
            <Text strong>{owner?.name}</Text>
            <div>
              <Text type="secondary">
                {owner?.email} · {courses.length} คอร์ส
              </Text>
            </div>
          </div>
        </div>
      )}
      {!isLearner && (
        <DirectorySearch
          query={query}
          onQuery={setQuery}
          placeholder="ค้นหาชื่องาน รหัสงาน หรือคอร์ส"
          filter={filter}
          onFilter={setFilter}
          filterLabel="คอร์สของผู้สอน"
          options={searchOptions}
          count={instructorAssignments.length}
        />
      )}

      <Card>
        {isLearner ? (
          <Table
            rowKey="id"
            dataSource={learnerAssignments}
            columns={learnerColumns}
            pagination={{ pageSize: 8 }}
            scroll={{ x: 900 }}
            locale={{ emptyText: 'คุณไม่มีงานที่ได้รับมอบหมายในขณะนี้' }}
          />
        ) : (
          <Table
            rowKey="id"
            dataSource={instructorAssignments}
            columns={instructorColumns}
            pagination={{ pageSize: 8 }}
            key={`${query}:${filter}`}
            scroll={{ x: 1000 }}
            locale={{ emptyText: courses.length ? 'ไม่พบงานมอบหมายในคอร์สที่เลือก' : 'ผู้สอนคนนี้ยังไม่มีคอร์ส' }}
          />
        )}
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        title={editingAssignment ? 'แก้ไขงานมอบหมาย' : 'สร้างงานมอบหมายใหม่'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
          <Form.Item name="courseId" label="เลือกคอร์ส" rules={[{ required: true, message: 'เลือกคอร์ส' }]}>
            <Select
              options={courses.map((c) => ({ value: c.id, label: c.title }))}
              onChange={() => {
                form.setFieldValue('quizId', undefined);
                form.setFieldValue('assigneeIds', []);
              }}
            />
          </Form.Item>

          <Form.Item
            name="quizId"
            label="เลือกแบบทดสอบ / งานที่ต้องการมอบหมาย"
            rules={[{ required: true, message: 'เลือกแบบทดสอบ' }]}
          >
            <Select
              placeholder="เลือกแบบทดสอบจากคอร์ส"
              options={courseQuizzes.map((q) => ({ value: q.id, label: q.title }))}
            />
          </Form.Item>

          <Form.Item name="title" label="หัวข้องานที่แสดงให้ผู้เรียน">
            <Input placeholder="เช่น แบบทดสอบวัดระดับก่อนเรียน หรือการบ้านสัปดาห์ที่ 1" />
          </Form.Item>

          <Form.Item name="stage" label="ระยะการวัดผล" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value="pre_test">ก่อนเรียน (Pre-test)</Radio>
              <Radio value="practice">แบบฝึกหัดระหว่างเรียน</Radio>
              <Radio value="post_test">หลังเรียน (Post-test)</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item name="assigneeType" label="กลุ่มผู้เรียนเป้าหมาย" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value="all_enrolled">ผู้เรียนทุกคนที่ลงทะเบียนในคอร์สนี้ ({courseEnrollments.length} คน)</Radio>
              <Radio value="specific">ระบุผู้เรียนรายคน</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.assigneeType !== cur.assigneeType || prev.courseId !== cur.courseId}
          >
            {({ getFieldValue }) =>
              getFieldValue('assigneeType') === 'specific' ? (
                <Form.Item
                  name="assigneeIds"
                  label="เลือกผู้เรียน"
                  rules={[{ required: true, message: 'เลือกผู้เรียนอย่างน้อย 1 คน' }]}
                >
                  <Select
                    mode="multiple"
                    placeholder="เลือกผู้เรียนในคอร์สนี้"
                    options={courseEnrollments.map((e) => {
                      const u = (data.users || []).find((user) => user.id === e.userId);
                      return { value: e.userId, label: `${u?.name || 'ผู้เรียน'} (${u?.email || ''})` };
                    })}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Form.Item name="dueDate" label="กำหนดวันส่งงาน (Due Date)">
            <DatePicker showTime style={{ width: '100%' }} placeholder="เลือกวันและเวลาที่ครบกำหนด" />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <Button onClick={() => setModalOpen(false)}>ยกเลิก</Button>
            <Button type="primary" htmlType="submit">
              บันทึกงานมอบหมาย
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
