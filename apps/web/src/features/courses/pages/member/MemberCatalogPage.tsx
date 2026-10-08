import React, { useState } from 'react';
import { Button, Col, Empty, Input, Row, Segmented, Select, Space, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useLms } from '@melearn/store';
import { CourseCard, CourseProgress, PageTitle, instructorFor, matchesDirectorySearch } from '@melearn/ui';
import '@melearn/ui/styles/catalog.css';

export function MemberCatalogPage() {
  const { data, currentUser } = useLms();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [filter, setFilter] = useState<string | number>('all');

  const currentUserId = currentUser?.id ?? '';
  const enrolled = new Set(
    data.enrollments
      .filter((entry) => entry.userId === currentUserId)
      .map((entry) => entry.courseId)
  );

  const published = data.courses.filter((course) => course.status === 'published');
  const categories = [...new Set(published.map((course) => course.category))];
  const courses = published.filter(
    (course) =>
      (category === 'all' || category === course.category) &&
      (filter === 'all' || enrolled.has(course.id) === (filter === 'enrolled')) &&
      matchesDirectorySearch(query, [
        course.title,
        course.subtitle,
        course.category,
        instructorFor(data, course)?.name,
      ])
  );

  return (
    <div className="member-catalog">
      <PageTitle
        eyebrow="พื้นที่สมาชิก"
        title="สำรวจคอร์ส"
        subtitle="เลือกคอร์สใหม่ หรือกลับไปเรียนคอร์สที่คุณลงทะเบียนไว้"
        actions={
          currentUser?.role !== 'instructor' && (
            <Link to="/learn/courses">
              <Button>คอร์สของฉัน</Button>
            </Link>
          )
        }
      />
      <div className="member-catalog-controls">
        <Input
          aria-label="ค้นหาคอร์ส"
          prefix={<SearchOutlined aria-hidden="true" />}
          placeholder="ค้นหาชื่อคอร์ส หัวข้อ หรือผู้สอน"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          allowClear
        />
        <Select
          aria-label="หมวดหมู่คอร์ส"
          value={category}
          onChange={setCategory}
          options={[{ value: 'all', label: 'ทุกหมวดหมู่' }, ...categories.map((value) => ({ value, label: value }))]}
        />
        <Segmented
          aria-label="สถานะลงเรียน"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'ทั้งหมด' },
            { value: 'new', label: 'ยังไม่ลงเรียน' },
            { value: 'enrolled', label: 'ลงเรียนแล้ว' },
          ]}
        />
      </div>
      <Typography.Text type="secondary" className="result-count">
        พบ {courses.length} คอร์ส
      </Typography.Text>
      {courses.length ? (
        <Row gutter={[20, 20]}>
          {courses.map((course) => (
            <Col xs={24} md={12} xl={8} key={course.id}>
              <div className="member-catalog-course">
                <CourseCard course={course} data={data} href={`/explore/courses/${course.slug}`} />
                <div className="member-catalog-course-status">
                  {enrolled.has(course.id) ? (
                    <>
                      <Typography.Text>ลงเรียนแล้ว</Typography.Text>
                      <CourseProgress course={course} data={data} userId={currentUserId} />
                      <Link to={`/learn/courses/${course.id}`}>
                        <Button type="primary" block>เรียนต่อ</Button>
                      </Link>
                    </>
                  ) : (
                    <Space className="member-catalog-course-actions">
                      <Typography.Text type="secondary">ยังไม่ลงเรียน</Typography.Text>
                      <Link to={`/explore/courses/${course.slug}`}>
                        <Button>ดูรายละเอียด</Button>
                      </Link>
                    </Space>
                  )}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      ) : (
        <Empty description="ไม่มีคอร์สที่ตรงกับตัวกรอง ลองเปลี่ยนคำค้นหรือสถานะลงเรียน" />
      )}
    </div>
  );
}
