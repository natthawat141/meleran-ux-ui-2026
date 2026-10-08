import React from 'react';
import { Typography } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import type { Course } from '@melearn/contracts';
import { flattenItems } from '../lib/formatters.ts';

export interface CourseOutlineProps {
  course: Course;
}

export function CourseOutline({ course }: CourseOutlineProps) {
  return (
    <>
      <section className="detail-section">
        <Typography.Title level={3}>คุณจะได้เรียนรู้อะไร</Typography.Title>
        <ul className="outcome-list">
          {course.outcomes?.map((outcome) => (
            <li key={outcome}>
              <CheckCircleOutlined aria-hidden="true" /> {outcome}
            </li>
          ))}
        </ul>
      </section>
      <section className="detail-section">
        <Typography.Title level={3}>เนื้อหาในคอร์ส</Typography.Title>
        <Typography.Text type="secondary">
          {course.chapters.length} บท · {flattenItems(course).length} รายการเรียนรู้
        </Typography.Text>
        <div className="public-course-outline">
          {course.chapters.map((chapter, index) => (
            <div key={chapter.id}>
              <div className="outline-chapter-head">
                <strong>บทที่ {index + 1} · {chapter.title}</strong>
                <Typography.Text type="secondary">{chapter.items.length} รายการ</Typography.Text>
              </div>
              {chapter.items.map((item) => {
                const meta =
                  'duration' in item && item.duration
                    ? item.duration
                    : 'readingMinutes' in item && item.readingMinutes
                      ? `${item.readingMinutes} นาที`
                      : '';
                return (
                  <div className="outline-lesson" key={item.id}>
                    <span>{item.type === 'video' ? 'วิดีโอ' : item.type === 'article' ? 'บทอ่าน' : 'แบบทดสอบ'}</span>
                    <span>{item.title}</span>
                    <Typography.Text type="secondary">{meta}</Typography.Text>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
