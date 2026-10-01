import React from 'react';
import { Button, Table, Typography } from 'antd';
import type { TableProps } from 'antd';
import { Link } from 'react-router-dom';
import { useLms } from '../../store';
import { PageTitle } from '../../components/common';
import { DirectorySearch, matchesDirectorySearch, useDirectorySearch } from '../../components/DirectorySearch';
import type { Certificate, Course, User } from '../../types';

interface EnrichedCertificate extends Certificate {
  user?: User;
  course?: Course;
}

export function AdminCertificatesPage() {
  const { data } = useLms();
  const options = [{ value: 'all', label: 'ทุกคอร์ส' }, ...data.courses.map((course) => ({ value: course.id, label: course.title }))];
  const { query, filter, params, setQuery, setFilter } = useDirectorySearch('course', options);
  const certificates: EnrichedCertificate[] = data.certificates
    .map((cert) => ({
      ...cert,
      user: data.users.find((entry) => entry.id === cert.userId),
      course: data.courses.find((entry) => entry.id === cert.courseId),
    }))
    .filter(
      (cert) =>
        (filter === 'all' || cert.courseId === filter) &&
        matchesDirectorySearch(query, [
          cert.id,
          cert.code,
          cert.userId,
          cert.user?.name,
          cert.user?.email,
          cert.courseId,
          cert.course?.title,
          cert.issuedAt,
          new Date(cert.issuedAt).toLocaleDateString('th-TH'),
        ])
    );
  const returnTo = `/admin/certificates${params.size ? `?${params}` : ''}`;

  const columns: TableProps<EnrichedCertificate>['columns'] = [
    {
      title: 'ผู้ได้รับใบรับรอง',
      render: (_, cert) => (
        <div className="table-course-name">
          <Link to={`/admin/users/${cert.userId}`}>{cert.user?.name || 'ไม่พบบัญชี'}</Link>
          <Typography.Text type="secondary">{cert.user?.email || cert.userId}</Typography.Text>
        </div>
      ),
    },
    { title: 'คอร์ส', render: (_, cert) => cert.course?.title || 'คอร์สที่ถูกลบ' },
    { title: 'รหัสใบรับรอง', dataIndex: 'code' },
    { title: 'วันที่ออก', dataIndex: 'issuedAt', render: (value: string) => new Date(value).toLocaleDateString('th-TH') },
    {
      title: 'ใบรับรอง',
      render: (_, cert) => (
        <Link to={`/admin/certificates/${cert.id}?returnTo=${encodeURIComponent(returnTo)}`}>
          <Button>เปิดใบรับรอง</Button>
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageTitle eyebrow="ผู้ดูแลระบบ" title="ใบรับรองทั้งหมด" subtitle="ค้นหาชื่อ อีเมล คอร์ส หรือรหัสใบรับรองของผู้เรียน" />
      <DirectorySearch
        query={query}
        onQuery={setQuery}
        placeholder="ค้นหาชื่อ อีเมล คอร์ส หรือรหัสใบรับรอง"
        filter={filter}
        onFilter={setFilter}
        filterLabel="คอร์สของใบรับรอง"
        options={options}
        count={certificates.length}
      />
      <Table
        key={`${query}:${filter}`}
        rowKey="id"
        columns={columns}
        dataSource={certificates}
        scroll={{ x: 850 }}
        pagination={{ pageSize: 8 }}
        locale={{ emptyText: data.certificates.length ? 'ไม่พบใบรับรองที่ตรงกับคำค้นและตัวกรอง' : 'ยังไม่มีใบรับรองที่ออกแล้ว' }}
      />
    </>
  );
}
