import React from 'react';
import { Collapse } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

const faqItems = [
  { key: 'price', label: 'คอร์สมีค่าใช้จ่ายอย่างไร?', children: <p>มีทั้งคอร์สฟรีและคอร์สที่ซื้อแยกรายคอร์ส คุณดูราคาและรายละเอียดเนื้อหาได้ก่อนสมัคร โดยไม่ต้องซื้อแพ็กเกจรายเดือน</p> },
  { key: 'time', label: 'เลือกเวลาเรียนเองได้ไหม?', children: <p>ได้ คอร์สออกแบบให้เรียนด้วยตัวเอง คุณเลือกเวลาเรียนและกลับมาเรียนต่อจากความคืบหน้าที่บันทึกไว้ได้</p> },
  { key: 'certificate', label: 'ต้องทำอย่างไรถึงจะได้รับใบรับรอง?', children: <p>เรียนให้ครบและผ่านแบบทดสอบตามเกณฑ์ของคอร์ส หากมีข้อเขียน ต้องรอผู้สอนตรวจและให้คะแนนผ่านก่อนจึงจะรับใบรับรองได้</p> },
  { key: 'preview', label: 'ดูเนื้อหาและผู้สอนก่อนซื้อได้ไหม?', children: <p>ได้ หน้ารายละเอียดคอร์สแสดงหัวข้อ บทเรียน ผู้สอน และราคา เพื่อให้คุณเลือกคอร์สที่เหมาะกับตัวเองก่อนตัดสินใจ</p> },
];

export function LandingFaq() {
  return (
    <section id="faq" className="home-faq home-section" aria-labelledby="home-faq-title">
      <div className="home-faq-heading">
        <p className="home-landing-kicker">LET’S GET STARTED</p>
        <h2 id="home-faq-title">มีเรื่องอยากรู้เพิ่มเติม?</h2>
        <p>คำตอบสำหรับการเริ่มเรียนกับ melearn</p>
      </div>
      <Collapse
        accordion
        ghost
        items={faqItems}
        expandIconPlacement="end"
        expandIcon={({ isActive }) => <PlusOutlined aria-hidden="true" rotate={isActive ? 45 : 0} />}
      />
    </section>
  );
}
