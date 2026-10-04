import React, { useState } from 'react';
import { Button, Col, Input, Row, Space, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useLms } from '../../store';
import { CourseCard, PageTitle } from '../../components/common';
import { CourseCartButton } from '../../components/CourseCartButton';
import { matchesDirectorySearch } from '../../components/DirectorySearch';

export function PublicCatalogPage() {
  const { data } = useLms();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ทั้งหมด');
  const published = data.courses.filter((course) => course.status === 'published');
  const categories = ['ทั้งหมด', ...new Set(published.map((course) => course.category))];
  const courses = published.filter(
    (course) =>
      (category === 'ทั้งหมด' || category === course.category) &&
      matchesDirectorySearch(query, [course.title, course.subtitle, course.category])
  );

  return (
    <div className="public-page catalog-page">
      <PageTitle
        eyebrow="สำรวจคอร์ส"
        title="เลือกเรื่องที่อยากเรียนรู้"
        subtitle="ดูภาพรวม เนื้อหา ผู้สอน และเวลาเรียน ก่อนตัดสินใจเริ่มคอร์ส"
      />
      <div className="catalog-controls">
        <Input
          aria-label="ค้นหาคอร์ส"
          prefix={<SearchOutlined aria-hidden="true" />}
          placeholder="ค้นหาชื่อคอร์สหรือหัวข้อ"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          allowClear
        />
        <Space wrap>
          {categories.map((value) => (
            <Button
              key={value}
              type={category === value ? 'primary' : 'default'}
              onClick={() => setCategory(value)}
            >
              {value}
            </Button>
          ))}
        </Space>
      </div>
      <Typography.Text type="secondary" className="result-count">
        {courses.length} คอร์ส
      </Typography.Text>
      {courses.length ? (
        <Row gutter={[22, 22]} className="catalog-grid">
          {courses.map((course) => (
            <Col xs={24} sm={12} xl={8} key={course.id}>
              <CourseCard
                course={course}
                data={data}
                action={course.price > 0 ? <CourseCartButton course={course} block /> : null}
              />
            </Col>
          ))}
        </Row>
      ) : (
        <div className="empty-page">ไม่พบคอร์ส ลองเปลี่ยนคำค้นหรือหมวดหมู่</div>
      )}
    </div>
  );
}
