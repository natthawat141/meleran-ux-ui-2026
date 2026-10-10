import React, { useState } from 'react';
import { Button, Col, Input, Row, Space, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { Avatar, Badge, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import { PageTitle } from '@melearn/ui';
import { catalogCoverStyle, formatCatalogPrice } from '../../api/catalog-display.ts';
import type { ProvisionalCourseSummary } from '../../api/catalog-provisional-contract.ts';
import { useDebouncedValue, useDevCatalogCategories, useDevCatalogList } from '../../hooks/use-dev-catalog.ts';

export function DevPublicCatalogPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ทั้งหมด');
  const [reloadToken, setReloadToken] = useState(0);
  const debouncedQuery = useDebouncedValue(query, 300);
  const filter = { q: debouncedQuery, category: category === 'ทั้งหมด' ? '' : category };
  const { state, loadMore } = useDevCatalogList(filter, reloadToken);
  const loadedCategories = useDevCatalogCategories(reloadToken);
  const categories = ['ทั้งหมด', ...loadedCategories];

  return (
    <div className="public-page catalog-page" aria-busy={state.status === 'loading'}>
      <PageTitle
        eyebrow="สำรวจคอร์ส"
        title="เลือกเรื่องที่อยากเรียนรู้"
        subtitle="ดูภาพรวม เนื้อหา ผู้สอน และเวลาเรียน ก่อนตัดสินใจเริ่มคอร์ส"
      />
      <Typography.Paragraph type="secondary">
        โหมดพัฒนา: รายการนี้มาจาก API จำลอง ไม่ใช่ข้อมูลตัวอย่างในเครื่อง และไม่ใช่ Backend จริง
      </Typography.Paragraph>
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
      {state.status === 'loading' && <Typography.Text aria-live="polite">กำลังโหลดคอร์ส</Typography.Text>}
      {state.status === 'error' && (
        <div className="empty-page" role="alert">
          <p>{state.message}</p>
          <Button onClick={() => setReloadToken((value) => value + 1)}>ลองอีกครั้ง</Button>
        </div>
      )}
      {state.status === 'ready' && (
        <>
          <Typography.Text type="secondary" className="result-count">
            {state.nextCursor ? `${state.items.length} คอร์สในหน้านี้` : `${state.items.length} คอร์ส`}
          </Typography.Text>
          {state.items.length ? (
            <Row gutter={[22, 22]} className="catalog-grid">
              {state.items.map((course) => (
                <Col xs={24} sm={12} xl={8} key={course.id}>
                  <DevCourseCard course={course} />
                </Col>
              ))}
            </Row>
          ) : (
            <div className="empty-page">ไม่พบคอร์ส ลองเปลี่ยนคำค้นหรือหมวดหมู่</div>
          )}
          {state.moreMessage && <Typography.Paragraph role="alert">{state.moreMessage}</Typography.Paragraph>}
          {state.nextCursor && (
            <Button onClick={loadMore} loading={state.loadingMore}>ดูคอร์สเพิ่ม</Button>
          )}
        </>
      )}
    </div>
  );
}

function DevCourseCard({ course }: { course: ProvisionalCourseSummary }) {
  const href = `/courses/${encodeURIComponent(course.id)}`;
  return (
    <article className="course-card">
      <Link className="course-cover-link" to={href} aria-label={`ดูคอร์ส ${course.title}`}>
        <div className="course-cover" style={catalogCoverStyle(course.cover_url)}>
          <Badge className="course-category" color="white" c="dark">{course.category}</Badge>
        </div>
      </Link>
      <div className="course-card-content">
        <div className="course-card-topline">
          <Badge className={course.price === null ? 'course-price-free' : 'course-price-paid'} color="gray" variant="light">
            {formatCatalogPrice(course.price)}
          </Badge>
          <Text c="dimmed" size="sm">{course.level}</Text>
        </div>
        <Link to={href} className="course-title-link">
          <Title order={3}>{course.title}</Title>
        </Link>
        {course.subtitle && (
          <Text c="dimmed" className="course-summary" lineClamp={2}>{course.subtitle}</Text>
        )}
        <div className="course-card-meta">
          <Avatar size={27} color="gray" radius="xl">{course.instructor.display_name.slice(0, 1)}</Avatar>
          <Text size="sm">{course.instructor.display_name}</Text>
        </div>
      </div>
    </article>
  );
}
