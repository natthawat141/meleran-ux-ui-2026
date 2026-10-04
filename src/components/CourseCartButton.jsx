import React from 'react';
import { Button, message } from 'antd';
import { ShoppingCartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLms } from '../store.jsx';

export function CourseCartButton({ course, referralCode, block = false, size = 'middle' }) {
  const { data, currentUser, addCourseToCart } = useLms();
  const navigate = useNavigate();
  if (!course || course.price <= 0 || (currentUser && !['learner', 'admin'].includes(currentUser.role))) return null;
  const next = '/courses/' + course.slug + (referralCode ? '?ref=' + encodeURIComponent(referralCode) : '');
  if (!currentUser) return <Button block={block} size={size} onClick={() => navigate('/login?next=' + encodeURIComponent(next))}>เข้าสู่ระบบเพื่อเก็บคอร์ส</Button>;
  const ownsCourse = data.enrollments.some((entry) => entry.courseId === course.id && entry.userId === currentUser.id)
    || data.orders.some((order) => order.courseId === course.id && order.userId === currentUser.id && order.status === 'paid');
  if (ownsCourse) return null;
  const isInCart = data.cartItems.some((item) => item.courseId === course.id && item.userId === currentUser.id);
  if (isInCart) return <Button block={block} size={size} icon={<ShoppingCartOutlined/>} onClick={() => navigate('/account/cart')}>ดูในตะกร้า</Button>;
  return <Button block={block} size={size} icon={<ShoppingCartOutlined/>} onClick={() => {
    const result = addCourseToCart(course.id, referralCode);
    if (!result.ok) { message.info(result.message); return; }
    message.success('เพิ่มคอร์สลงตะกร้าแล้ว');
  }}>ใส่ตะกร้า</Button>;
}
