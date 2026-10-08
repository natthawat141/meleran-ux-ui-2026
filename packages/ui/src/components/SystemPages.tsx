import React from 'react';
import { Button, Result } from 'antd';
import { Link } from 'react-router-dom';

export function NoAccessPage() {
  return (
    <Result
      status="403"
      title="หน้านี้เปิดได้ตามบทบาทของบัญชี"
      subTitle="เปลี่ยนบทบาทตัวอย่างจากแถบด้านบน หรือกลับไปพื้นที่ของคุณ"
      extra={<Link to="/"><Button type="primary">กลับหน้าแรก</Button></Link>}
    />
  );
}

export function NotFoundPage() {
  return (
    <Result
      status="404"
      title="ไม่พบหน้านี้"
      subTitle="ตรวจสอบลิงก์ หรือกลับไปเลือกเส้นทางที่ต้องการ"
      extra={<Link to="/"><Button type="primary">กลับหน้าแรก</Button></Link>}
    />
  );
}
