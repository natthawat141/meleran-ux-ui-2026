import React from 'react';
import { Button, Empty, Popconfirm, Table, Typography, message, type TableProps } from 'antd';
import { PrinterOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import { useLms } from '../../store';
import { PageTitle } from '../../components/common';
import { flattenItems } from '../../data';
import type { Certificate } from '../../types';
import { ProfileSettings } from './ProfileSettings';

const { Text } = Typography;

export function CertificatesPage() {
  const { data, currentUser } = useLms();
  const currentUserId = currentUser?.id ?? '';
  const certificates = data.certificates.filter((item) => item.userId === currentUserId);

  const columns: TableProps<Certificate>['columns'] = [
    {
      title: 'คอร์ส',
      render: (_, cert) =>
        data.courses.find((course) => course.id === cert.courseId)?.title ?? 'คอร์สที่ถูกลบ',
    },
    { title: 'เลขอ้างอิง', dataIndex: 'code' },
    {
      title: 'วันที่ออก',
      dataIndex: 'issuedAt',
      render: (value: string) => new Date(value).toLocaleDateString('th-TH'),
    },
    {
      title: '',
      render: (_, cert) => (
        <Link to={`/account/certificates/${cert.id}`}>
          <Button>เปิดใบรับรอง</Button>
        </Link>
      ),
    },
  ];

  const enrolled = data.enrollments
    .filter((entry) => entry.userId === currentUserId)
    .map((entry) => data.courses.find((course) => course.id === entry.courseId))
    .filter((course): course is NonNullable<typeof course> => Boolean(course));

  return (
    <>
      <PageTitle
        eyebrow="บัญชีผู้เรียน"
        title="ใบรับรองของฉัน"
        subtitle="ใบรับรองจะปรากฏเมื่อเรียนครบและผ่านแบบทดสอบ รวมทั้งคำตอบข้อเขียนได้รับการตรวจแล้ว"
      />
      <Table<Certificate>
        rowKey="id"
        dataSource={certificates}
        columns={columns}
        pagination={false}
        locale={{ emptyText: 'ยังไม่มีใบรับรองที่ออกแล้ว' }}
      />
      {enrolled.some((course) => !certificates.some((cert) => cert.courseId === course.id)) && (
        <section className="certificate-progress">
          <Text strong>คอร์สที่กำลังเก็บความคืบหน้า</Text>
          {enrolled
            .filter((course) => !certificates.some((cert) => cert.courseId === course.id))
            .map((course) => {
              const items = flattenItems(course);
              const completed = items.filter((item) =>
                'quizId' in item
                  ? data.attempts.some(
                      (attempt) =>
                        attempt.quizId === item.quizId &&
                        attempt.userId === currentUserId &&
                        attempt.passed
                    )
                  : data.progress[`${course.id}:${item.id}`]?.[currentUserId]
              ).length;
              const waiting = data.attempts.some(
                (attempt) =>
                  attempt.courseId === course.id &&
                  attempt.userId === currentUserId &&
                  attempt.essayStatus === 'pending'
              );
              return (
                <div key={course.id}>
                  <Link to={`/learn/courses/${course.id}`}>{course.title}</Link>
                  <Text type="secondary">
                    {waiting ? ' · มีข้อเขียนรอผู้สอนตรวจ' : ` · ทำแล้ว ${completed}/${items.length} รายการ`}
                  </Text>
                </div>
              );
            })}
        </section>
      )}
    </>
  );
}

export function CertificateDetailPage() {
  const { certificateId } = useParams<{ certificateId: string }>();
  const { data, currentUser } = useLms();
  const currentUserId = currentUser?.id ?? '';
  const cert = data.certificates.find(
    (item) => (item.id === certificateId || item.code === certificateId) && item.userId === currentUserId
  );

  if (!cert) {
    return <Empty description="ยังไม่มีใบรับรองนี้" />;
  }

  const back = '/account/certificates';
  const user = data.users.find((item) => item.id === cert.userId);
  const course = data.courses.find((item) => item.id === cert.courseId);
  const teacher = data.users.find((item) => item.id === course?.instructorId);

  return (
    <>
      <div className="certificate-toolbar">
        <Link to={back}>กลับใบรับรอง</Link>
        <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
          พิมพ์ / บันทึก PDF
        </Button>
      </div>
      <article className="certificate-paper">
        <div className="certificate-emblem">
          <SafetyCertificateOutlined />
        </div>
        <Text className="certificate-overline">CERTIFICATE OF COMPLETION</Text>
        <h1>ประกาศนียบัตร</h1>
        <Text>มอบให้แก่</Text>
        <h2>{cert.recipientName ?? user?.name}</h2>
        <Text>เพื่อแสดงว่าได้เรียนครบและผ่านการประเมินในหลักสูตร</Text>
        <h3>{course?.title}</h3>
        <div className="certificate-signatures">
          <div>
            <strong>{teacher?.name}</strong>
            <span>ผู้สอน</span>
          </div>
          <div>
            <strong>{new Date(cert.issuedAt).toLocaleDateString('th-TH')}</strong>
            <span>วันที่ออก</span>
          </div>
        </div>
        <div className="certificate-code">
          รหัสใบรับรอง {cert.code}
        </div>
      </article>
    </>
  );
}

export function ProfilePage() {
  const { currentUser, data, updateProfile, resetDemo } = useLms();

  if (!currentUser) return null;

  return (
    <>
      <ProfileSettings key={currentUser.id} user={currentUser} users={data.users} updateProfile={updateProfile} />
      <details className="demo-reset-settings">
        <summary>เครื่องมือสำหรับทดลองระบบ</summary>
        <p>เริ่มข้อมูลตัวอย่างใหม่ โดยล้างการแก้ไขและรายการที่สร้างไว้ในเบราว์เซอร์นี้</p>
        <Popconfirm
          title="เริ่มข้อมูลตัวอย่างใหม่?"
          description="ข้อมูลที่คุณแก้ไขในเบราว์เซอร์นี้จะถูกล้าง"
          okText="เริ่มใหม่"
          cancelText="ยกเลิก"
          onConfirm={() => {
            resetDemo();
            message.success('ตั้งค่าข้อมูลตัวอย่างใหม่แล้ว');
          }}
        >
          <Button danger>เริ่มข้อมูลตัวอย่างใหม่</Button>
        </Popconfirm>
      </details>
    </>
  );
}
