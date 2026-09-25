import React from 'react';
import { BookOutlined, PlayCircleOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { LandingPhoto, landingPhotos } from './LandingMedia.jsx';

const steps = [
  { icon: BookOutlined, title: 'เลือกสิ่งที่อยากเรียน', text: 'ดูเนื้อหา ผู้สอน และราคา มีทั้งคอร์สฟรีและแบบซื้อแยกรายคอร์ส' },
  { icon: PlayCircleOutlined, title: 'เรียนในเวลาที่สะดวก', text: 'เรียนผ่านวิดีโอและบทความ ลองทำแบบทดสอบ แล้วกลับมาเรียนต่อได้' },
  { icon: SafetyCertificateOutlined, title: 'เก็บความสำเร็จของคุณ', text: 'รับใบรับรองเมื่อเรียนครบและผ่านแบบทดสอบ รวมข้อเขียนที่ผู้สอนตรวจ' },
];

export function LearningGuide() {
  return <section id="how-it-works" className="home-guide" aria-labelledby="home-guide-title">
    <div className="home-container home-guide-layout">
      <LandingPhoto photo={landingPhotos.learning} className="home-guide-photo" />
      <div className="home-guide-content">
        <div className="home-guide-heading"><h2 id="home-guide-title">เรียนรู้ได้<br/>แบบที่เข้ากับชีวิตคุณ</h2><p>เริ่มจากความสนใจ แล้วค่อย ๆ พัฒนาทักษะไปด้วยกัน</p></div>
        <ol className="home-learning-steps">{steps.map(({ icon: Icon, title, text }) => <li key={title}>
          <span className="home-step-icon" aria-hidden="true"><Icon /></span>
          <div><h3>{title}</h3><p>{text}</p></div>
        </li>)}</ol>
      </div>
    </div>
  </section>;
}
