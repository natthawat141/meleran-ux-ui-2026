import React from 'react';
import { Alert, Button, Empty, Switch, Tag, Typography, message } from 'antd';
import { ArrowRightOutlined, DeleteOutlined, MailOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useLms } from '../../store.jsx';
import { PageTitle } from '../../components/common.jsx';
import { formatPrice, instructorFor } from '../../data.js';
import './cart.css';

const { Text, Title } = Typography;

function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function CartPage() {
  const { data, currentUser, removeCourseFromCart, setCoursePriceAlert } = useLms();
  const items = (data.cartItems ?? []).filter((item) => item.userId === currentUser?.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const emails = (data.mockPriceEmails ?? []).filter((email) => email.userId === currentUser?.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const removeItem = (item) => {
    if (removeCourseFromCart(item.id)) message.success('นำคอร์สออกจากตะกร้าแล้ว');
  };
  const togglePriceAlert = (courseId, enabled) => {
    if (setCoursePriceAlert(courseId, enabled)) message.success(enabled ? 'เปิดแจ้งเตือนราคาสำหรับคอร์สนี้แล้ว' : 'ปิดแจ้งเตือนราคาสำหรับคอร์สนี้แล้ว');
  };

  return <div className="learner-cart-page">
    <PageTitle eyebrow="บัญชีผู้เรียน" title="ตะกร้าคอร์ส" subtitle="เก็บคอร์สที่สนใจไว้ แล้วกลับมาซื้อเมื่อพร้อม"/>
    <div className="learner-cart-layout">
      <main className="learner-cart-main">
        <section className="learner-cart-section">
          <div className="learner-cart-section-heading"><div><Title level={4}>คอร์สที่บันทึกไว้</Title><Text type="secondary">เลือกชำระเงินทีละคอร์สในต้นแบบนี้</Text></div><Tag color="blue">{items.length} คอร์ส</Tag></div>
          {items.length ? <div className="learner-cart-list">{items.map((item) => {
            const course = data.courses.find((entry) => entry.id === item.courseId);
            const teacher = course && instructorFor(data, course);
            const checkoutPath = course?.price === 0 ? '/courses/' + course.slug : '/checkout/' + item.courseId + (item.referralCode ? '?ref=' + encodeURIComponent(item.referralCode) : '');
            return <article className="learner-cart-item" key={item.id}>
              {course?.cover ? <Link to={'/courses/' + course.slug} className="learner-cart-cover"><img src={course.cover} alt=""/></Link> : <div className="learner-cart-cover learner-cart-cover-empty"/>}
              <div className="learner-cart-course"><div className="learner-cart-course-title">{course ? <Link to={'/courses/' + course.slug}>{course.title}</Link> : <Text strong>คอร์สนี้ไม่พร้อมใช้งานแล้ว</Text>}</div><Text type="secondary">{teacher?.name ? 'ผู้สอน ' + teacher.name + ' · ' : ''}{course?.category ?? '—'}{course?.level ? ' · ' + course.level : ''}</Text><strong className="learner-cart-price">{course ? formatPrice(course.price) : '—'}</strong>
                <div className="learner-cart-price-alert"><Switch checked={Boolean(item.priceAlertEnabled)} disabled={!course || course.status !== 'published' || course.price === 0} onChange={(checked) => togglePriceAlert(item.courseId, checked)} aria-label={'แจ้งเตือนราคาคอร์ส ' + (course?.title ?? '')}/><div><Text strong>แจ้งเตือนเมื่อราคาลด</Text><Text type="secondary">ส่งอีเมลจำลองไปที่ {currentUser.email}</Text></div></div>
                {course?.status !== 'published' && <Text type="secondary">คอร์สยังไม่เปิดขาย</Text>}
              </div>
              <div className="learner-cart-actions"><Button type="text" icon={<DeleteOutlined/>} onClick={() => removeItem(item)}>นำออก</Button>{course?.status === 'published' && <Link to={checkoutPath}><Button type="primary" icon={<ArrowRightOutlined/>}>{course.price === 0 ? 'ลงเรียนฟรี' : 'ไปชำระเงิน'}</Button></Link>}</div>
            </article>;
          })}</div> : <Empty description="ยังไม่มีคอร์สในตะกร้า"><Link to="/courses"><Button type="primary">เลือกดูคอร์ส</Button></Link></Empty>}
        </section>
      </main>
      <aside className="learner-cart-aside">
        <section className="learner-cart-section learner-cart-email-section"><div className="learner-cart-section-heading"><div><Title level={4}>อีเมลแจ้งเตือนราคา</Title><Text type="secondary">รายการแจ้งเตือนที่ระบบจำลองสร้างให้คุณ</Text></div><MailOutlined/></div>
          <Alert type="info" showIcon message="อีเมลในต้นแบบเป็นรายการจำลอง ยังไม่มีการส่งออกจริง" description="เปิดสวิตช์ในคอร์สที่บันทึกไว้ เพื่อรับการแจ้งเตือนเมื่อมีการลดราคา"/>
          {emails.length ? <div className="learner-cart-email-list">{emails.map((email) => <article className="learner-cart-email" key={email.id}><div className="learner-cart-email-title"><strong>ราคาลดลง: {email.courseTitle}</strong><Tag color="blue">จำลองส่งแล้ว</Tag></div><Text type="secondary">ถึง {email.to} · {dateLabel(email.createdAt)}</Text><div className="learner-cart-email-price"><span>{formatPrice(email.previousPrice)}</span><ArrowRightOutlined/><strong>{formatPrice(email.newPrice)}</strong></div></article>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีอีเมลแจ้งเตือนราคา"/>}
        </section>
        <div className="learner-cart-help"><Text strong>ทำงานอย่างไร</Text><Text type="secondary">เมื่อผู้สอนหรือแอดมินบันทึกราคาคอร์สที่เผยแพร่ให้ต่ำลง ระบบต้นแบบจะสร้างอีเมลจำลองให้ผู้เรียนที่เปิดรับแจ้งเตือนและยังไม่ได้ซื้อคอร์สนั้น</Text></div>
      </aside>
    </div>
  </div>;
}
