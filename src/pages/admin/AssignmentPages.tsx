import React from 'react';
import { Empty, Input, Space, Table, Typography } from 'antd';
import type { TableProps } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { Link, useSearchParams } from 'react-router-dom';
import { useLms } from '../../store';
import { PageTitle } from '../../components/common';
import { UserAvatar } from '../../components/UserAvatar';
import { matchesDirectorySearch } from '../../components/DirectorySearch';
import { AssignmentsPage } from '../AssignmentsPage';
import type { User } from '../../types';
import './assignments.css';

interface InstructorAssignmentRow extends User {
  courseCount: number;
  assignmentCount: number;
}

export function AdminAssignmentsPage() {
  const { data } = useLms();
  const [params, setParams] = useSearchParams();
  const instructorId = params.get('instructor');
  const query = params.get('q') || '';
  const instructors = data.users.filter((user) => user.role === 'instructor');
  const selected = instructors.find((user) => user.id === instructorId);
  const directoryParams = new URLSearchParams(params);
  directoryParams.delete('instructor');
  directoryParams.delete('course');
  if (instructorId) {
    directoryParams.delete('q');
    if (params.get('instructorQ')) directoryParams.set('q', params.get('instructorQ') || '');
  }
  directoryParams.delete('instructorQ');
  const backTo = `/admin/assignments${directoryParams.size ? `?${directoryParams}` : ''}`;
  if (instructorId && !selected)
    return (
      <Empty description="ไม่พบผู้สอนที่เลือก">
        <Link to={backTo}>กลับเลือกผู้สอน</Link>
      </Empty>
    );
  if (selected) return <AssignmentsPage key={selected.id} instructorId={selected.id} directoryBackTo={backTo} />;

  const rows: InstructorAssignmentRow[] = instructors
    .filter((user) => matchesDirectorySearch(query, [user.name, user.email, user.id]))
    .map((user) => {
      const courses = data.courses.filter((course) => course.instructorId === user.id);
      return {
        ...user,
        courseCount: courses.length,
        assignmentCount: (data.assignments || []).filter((assignment) =>
          courses.some((course) => course.id === assignment.courseId)
        ).length,
      };
    });

  const columns: TableProps<InstructorAssignmentRow>['columns'] = [
    {
      title: 'ผู้สอน',
      key: 'instructor',
      render: (_, user) => (
        <Space>
          <UserAvatar user={user} size={40} />
          <div>
            <Typography.Text strong>{user.name}</Typography.Text>
            <div>
              <Typography.Text type="secondary">{user.email}</Typography.Text>
            </div>
          </div>
        </Space>
      ),
    },
    { title: 'คอร์ส', dataIndex: 'courseCount' },
    { title: 'งานมอบหมาย', dataIndex: 'assignmentCount' },
    {
      title: '',
      key: 'action',
      render: (_, user) => {
        const next = new URLSearchParams();
        next.set('instructor', user.id);
        if (query) next.set('instructorQ', query);
        return <Link to={`/admin/assignments?${next}`}>ดูงานมอบหมาย</Link>;
      },
    },
  ];

  return (
    <div className="admin-assignment-directory">
      <PageTitle
        eyebrow="การจัดการงาน"
        title="จัดการงานมอบหมาย"
        subtitle="เลือกผู้สอนก่อน เพื่อจัดการงานมอบหมายในคอร์สของผู้สอนคนนั้น"
      />
      <div className="directory-search">
        <Input
          aria-label="ค้นหาผู้สอน"
          prefix={<SearchOutlined aria-hidden="true" />}
          placeholder="ค้นหาชื่อ อีเมล หรือรหัสผู้สอน"
          value={query}
          allowClear
          onChange={(event) => {
            const next = new URLSearchParams(params);
            if (event.target.value) next.set('q', event.target.value);
            else next.delete('q');
            setParams(next, { replace: true });
          }}
        />
        <span role="status">พบ {rows.length} ผู้สอน</span>
      </div>
      <Table
        key={query}
        rowKey="id"
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 8 }}
        scroll={{ x: 650 }}
        locale={{ emptyText: 'ไม่พบผู้สอนที่ตรงกับคำค้น' }}
      />
    </div>
  );
}
