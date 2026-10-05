import React from 'react';
import { ArrowRightOutlined, BookOutlined, UserOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { formatPrice, instructorFor, flattenItems } from '../../data';
import { landingCover } from './LandingArtwork';
import type { Course, LmsData } from '../../types';

interface LandingCourseCardProps {
  course: Course;
  data: LmsData;
}

function LandingCourseCard({ course, data }: LandingCourseCardProps) {
  const teacher = instructorFor(data, course);
  const href = `/courses/${course.slug}`;
  return (
    <article className="home-course-card">
      <Link to={href} className="home-course-cover" tabIndex={-1} aria-hidden="true">
        <img src={landingCover(course.cover, course.id.replace(/^course-/, ''))} alt="" loading="lazy" width="600" height="360" />
      </Link>
      <div className="home-course-body">
        <div className="home-course-tags">
          <span>{course.category}</span>
          <span>ระดับ{course.level}</span>
        </div>
        <h3><Link to={href}>{course.title}</Link></h3>
        <p className="home-course-description">{course.subtitle}</p>
        <div className="home-course-instructor">
          <span className="home-course-avatar" aria-hidden="true"><UserOutlined /></span>
          <span>สอนโดย {teacher ? <Link to={`/instructors/${teacher.id}`}>{teacher.name}</Link> : 'ทีม melearn'}</span>
        </div>
        <div className="home-course-bottom">
          <span><BookOutlined /> {course.chapters?.length ?? 0} บท · {flattenItems(course).length} บทเรียน</span>
          <strong>{formatPrice(course.price)}</strong>
        </div>
        <Link className="home-course-cta" to={href}>ดูรายละเอียดคอร์ส <ArrowRightOutlined aria-hidden="true" /></Link>
      </div>
    </article>
  );
}

export interface CourseCollectionProps {
  courses: Course[];
  data: LmsData;
}

export function CourseCollection({ courses, data }: CourseCollectionProps) {
  return (
    <section className="home-container home-section home-courses" id="courses" aria-labelledby="home-courses-title">
      <div className="home-collection-heading">
        <div>
          <p className="home-landing-kicker">MELEARN COURSES</p>
          <h2 id="home-courses-title">เรียนเรื่องที่ชอบ<span>ต่อยอดเรื่องที่ใช่</span></h2>
          <p>ค้นพบคอร์สที่ช่วยให้คุณเข้าใจมากขึ้น และพร้อมลองทำด้วยตัวเอง</p>
        </div>
        <Link to="/courses" className="home-collection-link">ดูคอร์สทั้งหมด <ArrowRightOutlined aria-hidden="true" /></Link>
      </div>
      <div className="home-course-cards">
        {courses.slice(0, 3).map((course) => (
          <LandingCourseCard key={course.id} course={course} data={data} />
        ))}
      </div>
      {!courses.length && <p className="home-empty">ยังไม่มีคอร์สเปิดให้เรียนในขณะนี้</p>}
    </section>
  );
}
