import React from 'react';
import { Alert, Button, Empty, Space, Tag, Typography, message } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLms } from '../../store';
import { CourseProgress, PageTitle } from '../../components/common';
import { CourseOutline } from '../../components/CourseOutline';
import { UserAvatar } from '../../components/UserAvatar';
import { formatPrice, instructorFor } from '../../data';
import './catalog.css';

export function MemberCourseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data, currentUser, enrollFree } = useLms();
  const course = data.courses.find(
    (entry) => (entry.slug === slug || entry.id === slug) && entry.status === 'published'
  );

  if (!course) {
    return (
      <Empty description="ไม่พบคอร์สที่เผยแพร่นี้">
        <Link to="/explore/courses">กลับสำรวจคอร์ส</Link>
      </Empty>
    );
  }

  const currentUserId = currentUser?.id ?? '';
  const teacher = instructorFor(data, course);
  const enrolled = data.enrollments.some(
    (entry) => entry.courseId === course.id && entry.userId === currentUserId
  );
  const canLearn = currentUser?.role === 'learner' || currentUser?.role === 'instructor' || currentUser?.role === 'admin';
  const canBuy = currentUser?.role === 'learner' || (currentUser?.role === 'instructor' && course.instructorId !== currentUser.id);

  const start = () => {
    if (currentUser?.role !== 'admin' && currentUser?.emailVerified === false) {
      navigate('/verify-email');
    } else if (enrolled) {
      navigate(`/learn/courses/${course.id}`);
    } else if (course.price === 0) {
      const result = enrollFree(course.id);
      if (result.ok) navigate(`/learn/courses/${course.id}`);
      else message.info(result.message);
    } else if (canBuy && currentUser?.status !== 'suspended') {
      navigate(`/checkout/${course.id}`);
    }
  };

  return (
    <div className="member-course-detail">
      <Link to="/explore/courses">กลับสำรวจคอร์ส</Link>
      <PageTitle
        eyebrow="รายละเอียดคอร์สสำหรับสมาชิก"
        title={course.title}
        subtitle={course.subtitle}
      />
      <div className="member-course-summary">
        <img src={course.cover} alt={`ภาพประกอบ ${course.title}`} />
        <div>
          <Space wrap>
            <Tag>{course.category}</Tag>
            <Typography.Text type="secondary">ระดับ {course.level}</Typography.Text>
          </Space>
          <div className="member-course-teacher">
            <UserAvatar user={teacher} size={36} />
            <span>ผู้สอน {teacher?.name}</span>
          </div>
          <Typography.Paragraph>{course.description}</Typography.Paragraph>
          {enrolled ? (
            <>
              <Typography.Text strong>คุณลงเรียนคอร์สนี้แล้ว</Typography.Text>
              <CourseProgress course={course} data={data} userId={currentUserId} />
            </>
          ) : (
            <Typography.Text strong>{formatPrice(course.price)}</Typography.Text>
          )}
          <Space wrap>
            {canLearn && (enrolled || course.price === 0) && (
              <Button type="primary" onClick={start}>
                {enrolled ? 'เรียนต่อ' : course.price === 0 ? 'ลงเรียนฟรี' : 'ซื้อคอร์ส'}
              </Button>
            )}
            {canBuy && !enrolled && course.price > 0 && currentUser?.status !== 'suspended' && (
              <Button type="primary" onClick={start}>ซื้อคอร์ส</Button>
            )}
            {currentUser?.role === 'admin' && (
              <Link to={`/admin/courses/${course.id}`}>
                <Button>จัดการคอร์ส</Button>
              </Link>
            )}
            {currentUser?.role === 'instructor' && course.instructorId === currentUserId && (
              <Link to={`/teach/courses/${course.id}`}>
                <Button>จัดการคอร์สของฉัน</Button>
              </Link>
            )}
          </Space>
          {!canLearn && (
            <Alert
              type="info"
              message="คุณกำลังดูคอร์สในบทบาทผู้สอน"
              description="การลงเรียนในต้นแบบใช้บัญชีผู้เรียน ผ่านเมนูสลับบทบาทด้านบน"
            />
          )}
          {currentUser?.emailVerified === false && <Alert type="info" showIcon message="ยืนยันอีเมลก่อนลงเรียนหรือซื้อคอร์ส" description={<Link to="/verify-email">เปิดหน้าส่งลิงก์ยืนยันจำลอง</Link>} />}
        </div>
      </div>
      <CourseOutline course={course} />
    </div>
  );
}
