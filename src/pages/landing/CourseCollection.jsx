import React, { useState } from 'react';
import { Tabs } from 'antd';
import { ArrowRightOutlined, BookOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { formatPrice, instructorFor, flattenItems } from '../../data.js';

function LandingCourseCard({ course, data }) {
  const teacher = instructorFor(data, course);
  const href = `/courses/${course.slug}`;
  return <article className="home-course">
    <Link to={href} className="home-course-image" tabIndex={-1} aria-hidden="true">
      <img src={course.cover} alt="" loading="lazy" width="600" height="360" />
    </Link>
    <div className="home-course-content">
      <div className="home-course-meta"><span>{course.category}</span><span>ระดับ{course.level}</span></div>
      <h3><Link to={href}>{course.title}</Link></h3>
      <p className="home-course-summary">{course.subtitle}</p>
      <div className="home-course-teacher"><span className="home-teacher-avatar" aria-hidden="true">{teacher?.name?.slice(0, 1) ?? 'ผ'}</span><span>สอนโดย {teacher ? <Link to={`/instructors/${teacher.id}`}>{teacher.name}</Link> : 'ทีม melearn'}</span></div>
      <div className="home-course-details"><span><BookOutlined /> {course.chapters?.length ?? 0} บท · {flattenItems(course).length} บทเรียน</span><strong>{formatPrice(course.price)}</strong></div>
      <Link className="home-course-action" to={href}>ดูรายละเอียดคอร์ส <ArrowRightOutlined aria-hidden="true" /></Link>
    </div>
  </article>;
}

export function CourseCollection({ courses, data }) {
  const [category, setCategory] = useState('ทั้งหมด');
  const categories = ['ทั้งหมด', ...new Set(courses.map((course) => course.category))];
  const visibleCourses = courses.filter((course) => category === 'ทั้งหมด' || course.category === category);
  return <section className="home-container home-section home-courses" id="courses" aria-labelledby="home-courses-title">
    <div className="home-section-heading">
      <div><h2 id="home-courses-title">วันนี้ อยากเรียนรู้อะไร?</h2><p>เลือกเรื่องที่สนใจ แล้วเริ่มต้นได้ทีละบท</p></div>
      <Link to="/courses" className="home-text-link">ดูคอร์สทั้งหมด <ArrowRightOutlined aria-hidden="true" /></Link>
    </div>
    <Tabs activeKey={category} onChange={setCategory} className="home-course-tabs" aria-label="หมวดหมู่คอร์ส" items={categories.map((label) => ({ key: label, label, children: <div className="home-course-grid">{visibleCourses.slice(0, 6).map((course) => <LandingCourseCard key={course.id} course={course} data={data} />)}</div> }))} />
    {!courses.length && <p className="home-empty">ยังไม่มีคอร์สเปิดให้เรียนในขณะนี้</p>}
  </section>;
}
