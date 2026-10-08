import React, { useState } from 'react';
import { Button, Space, Tag, Typography } from 'antd';
import { ArrowRightOutlined, CheckCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageTitle } from '@legacy/components/common';
import { formatCatalogPrice, safeCatalogCoverUrl } from '../../api/catalog-display.ts';
import type { ProvisionalOutlineItemType } from '../../api/catalog-provisional-contract.ts';
import { useDevCatalogCourse } from '../../hooks/use-dev-catalog.ts';

const itemTypeLabel: Record<ProvisionalOutlineItemType, string> = {
  video: 'วิดีโอ',
  article: 'บทอ่าน',
  quiz: 'แบบทดสอบ',
};

export function DevCourseDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [reloadToken, setReloadToken] = useState(0);
  const state = useDevCatalogCourse(slug, reloadToken);

  if (state.status === 'loading') {
    return (
      <div className="public-page" aria-busy="true">
        <Typography.Text aria-live="polite">กำลังโหลดคอร์ส</Typography.Text>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="public-page" role="alert">
        <PageTitle title="โหลดคอร์สไม่สำเร็จ" />
        <Typography.Paragraph>{state.message}</Typography.Paragraph>
        <Space>
          <Button onClick={() => setReloadToken((value) => value + 1)}>ลองอีกครั้ง</Button>
          <Link to="/courses">กลับไปดูคอร์ส</Link>
        </Space>
      </div>
    );
  }

  if (state.status === 'missing') {
    return (
      <div className="public-page">
        <PageTitle title="ไม่พบคอร์สนี้" />
        <Link to="/courses">กลับไปดูคอร์ส</Link>
      </div>
    );
  }

  const { course } = state;
  const coverUrl = safeCatalogCoverUrl(course.cover_url);
  const itemCount = course.outline.reduce((sum, chapter) => sum + chapter.items.length, 0);
  const login = `/login?next=${encodeURIComponent(`/courses/${course.id}`)}`;

  return (
    <div className="public-page course-detail-page">
      <div className="detail-hero">
        <div className="detail-hero-copy">
          <Space>
            <Tag>{course.category}</Tag>
            <Typography.Text type="secondary">ระดับ {course.level}</Typography.Text>
          </Space>
          <Typography.Title>{course.title}</Typography.Title>
          {course.subtitle && <Typography.Paragraph>{course.subtitle}</Typography.Paragraph>}
          <Typography.Paragraph type="secondary">สอนโดย {course.instructor.display_name}</Typography.Paragraph>
          <div className="detail-hero-actions">
            <Button type="primary" size="large" onClick={() => navigate(login)}>
              เข้าสู่ระบบเพื่อเริ่มเรียน <ArrowRightOutlined aria-hidden="true" />
            </Button>
            <Typography.Text className="detail-price">{formatCatalogPrice(course.price)}</Typography.Text>
          </div>
          <Typography.Paragraph type="secondary">
            โหมดพัฒนา: หน้านี้อ่านจาก API จำลอง การเข้าสู่ระบบยังไม่สมัครเรียนผ่าน API
          </Typography.Paragraph>
        </div>
        <div className="detail-cover">
          {coverUrl ? <img src={coverUrl} alt="" /> : <div className="course-cover" />}
          <span><PlayCircleOutlined aria-hidden="true" /> เรียนด้วยตัวเอง</span>
        </div>
      </div>
      <div className="detail-content-grid">
        <main>
          {course.description && (
            <section className="detail-section">
              <Typography.Title level={3}>เกี่ยวกับคอร์ส</Typography.Title>
              <Typography.Paragraph>{course.description}</Typography.Paragraph>
            </section>
          )}
          {course.outcomes.length > 0 && (
            <section className="detail-section">
              <Typography.Title level={3}>คุณจะได้เรียนรู้อะไร</Typography.Title>
              <ul className="outcome-list">
                {course.outcomes.map((outcome) => (
                  <li key={outcome}>
                    <CheckCircleOutlined aria-hidden="true" /> {outcome}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="detail-section">
            <Typography.Title level={3}>เนื้อหาในคอร์ส</Typography.Title>
            {course.outline.length === 0 ? (
              <Typography.Text type="secondary">ยังไม่มีบทเรียนที่เปิดให้ดู</Typography.Text>
            ) : (
              <>
                <Typography.Text type="secondary">{course.outline.length} บท · {itemCount} รายการเรียนรู้</Typography.Text>
                <div className="public-course-outline">
                  {course.outline.map((chapter, index) => (
                    <div key={chapter.id}>
                      <div className="outline-chapter-head">
                        <strong>บทที่ {index + 1} · {chapter.title}</strong>
                        <Typography.Text type="secondary">{chapter.items.length} รายการ</Typography.Text>
                      </div>
                      {chapter.items.length === 0 && <Typography.Text type="secondary">ยังไม่มีรายการ</Typography.Text>}
                      {chapter.items.map((item) => (
                        <div className="outline-lesson" key={item.id}>
                          <span>{itemTypeLabel[item.type]}</span>
                          <span>{item.title}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </main>
        <aside className="detail-side-note">
          <Typography.Title level={4}>เริ่มเรียนในจังหวะของคุณ</Typography.Title>
          <Typography.Paragraph>เข้าสู่ระบบเพื่อสมัครคอร์ส เก็บความคืบหน้า และกลับมาเรียนต่อ</Typography.Paragraph>
          <Button block type="primary" onClick={() => navigate(login)}>เข้าสู่ระบบเพื่อเริ่มเรียน</Button>
        </aside>
      </div>
    </div>
  );
}
