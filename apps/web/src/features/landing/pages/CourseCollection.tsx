import React from 'react';
import { ArrowRightOutlined, BookOutlined, UserOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useDevCatalogList } from '../../courses/hooks/use-dev-catalog';
import { formatCatalogPrice, safeCatalogCoverUrl } from '../../courses/api/catalog-display';

export function CourseCollection() {
  const { state } = useDevCatalogList({ q: '', category: '' }, 0);
  const courses = state.status === 'ready' ? state.items.slice(0, 3) : [];
  return (
    <section className="home-container home-section home-courses" id="courses" aria-labelledby="home-courses-title" aria-busy={state.status === 'loading'}>
      <div className="home-collection-heading">
        <div><p className="home-landing-kicker">MELEARN COURSES</p><h2 id="home-courses-title">เรียนเรื่องที่ชอบ<span>ต่อยอดเรื่องที่ใช่</span></h2><p>ค้นพบคอร์สที่ช่วยให้คุณเข้าใจมากขึ้น และพร้อมลองทำด้วยตัวเอง</p></div>
        <Link to="/courses" className="home-collection-link">ดูคอร์สทั้งหมด <ArrowRightOutlined aria-hidden="true" /></Link>
      </div>
      {state.status === 'loading' && <p role="status">กำลังโหลดคอร์ส</p>}
      {state.status === 'error' && <p role="alert">{state.message}</p>}
      {state.status === 'ready' && <>
        <div className="home-course-cards">
          {courses.map((course) => {
            const href = `/courses/${encodeURIComponent(course.id)}`;
            const cover = safeCatalogCoverUrl(course.cover_url);
            return <article className="home-course-card" key={course.id}>
              <Link to={href} className="home-course-cover" aria-label={`ดูคอร์ส ${course.title}`}>
                {cover && <img src={cover} alt="" loading="lazy" width="600" height="360" />}
              </Link>
              <div className="home-course-body">
                <div className="home-course-tags"><span>{course.category}</span><span>ระดับ{course.level}</span></div>
                <h3><Link to={href}>{course.title}</Link></h3>
                {course.subtitle && <p className="home-course-description">{course.subtitle}</p>}
                <div className="home-course-instructor"><span>สอนโดย <Link to={`/instructors/${course.instructor.id}`}>{course.instructor.display_name}</Link></span></div>
                <div className="home-course-bottom"><span>คอร์สออนไลน์ · เรียนด้วยตัวเอง</span><strong>{formatCatalogPrice(course.price)}</strong></div>
                <Link className="home-course-cta" to={href}>ดูรายละเอียดคอร์ส <ArrowRightOutlined aria-hidden="true" /></Link>
              </div>
            </article>;
          })}
        </div>
        {!courses.length && <p className="home-empty">ยังไม่มีคอร์สเปิดให้เรียนในขณะนี้</p>}
      </>}
    </section>
  );
}
