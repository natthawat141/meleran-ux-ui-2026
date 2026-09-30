import React from 'react';
import { Tabs } from 'antd';
import { StoryReveal } from './BrandStory.jsx';
import './learning-invitation.css';

const invitations = [
  { key: 'write', label: 'ลองเขียน', title: 'เล่าเรื่องหนึ่งเรื่อง ในสามบรรทัด', steps: ['เลือกเรื่องเล็ก ๆ ที่อยากเล่าให้ใครสักคนฟัง', 'เขียนว่าเกิดอะไรขึ้น ทำไมถึงสำคัญ และอยากบอกอะไร', 'อ่านอีกครั้ง ลองตัดคำที่ไม่จำเป็นออก'], note: 'ไม่ต้องเขียนให้สมบูรณ์ในครั้งแรก แค่เริ่มให้ความคิดมีที่อยู่ก็พอ' },
  { key: 'notice', label: 'ลองสังเกต', title: 'มองสิ่งคุ้นเคย ด้วยคำถามใหม่', steps: ['เลือกข้อมูลหรือภาพหนึ่งอย่างที่เห็นในวันนี้', 'ลองถามว่าเราเห็นอะไร และยังไม่รู้อะไร', 'จดคำถามหนึ่งข้อที่อยากหาคำตอบต่อ'], note: 'ความสงสัยเล็ก ๆ ก็เป็นจุดเริ่มต้นของการเรียนรู้ได้' },
  { key: 'time', label: 'ให้เวลาตัวเอง', title: 'เก็บเวลาสิบห้านาที ไว้ให้ความอยากรู้', steps: ['เลือกหนึ่งเรื่องที่อยากรู้ โดยไม่ต้องตั้งเป้าใหญ่', 'หาช่วงเวลาสั้น ๆ ที่สะดวกสำหรับตัวเอง', 'ลองอ่าน ดู หรือทำ แล้วจดสิ่งที่ได้เรียนรู้หนึ่งอย่าง'], note: 'วันนี้ได้เรียนรู้เพียงนิดเดียว ก็ยังเป็นก้าวหนึ่งของคุณ' },
];

export function LearningInvitation() {
  return <section className="home-container home-invitation" aria-labelledby="home-invitation-title">
    <StoryReveal className="home-invitation-intro">
      <p className="brand-kicker">มุมเล็ก ๆ สำหรับวันนี้</p>
      <h2 id="home-invitation-title">ยังไม่ต้องเก่ง<br/>แค่ลองเริ่มก็พอ</h2>
      <p>บางวันเราอาจยังไม่รู้ว่าอยากเรียนอะไร ลองเลือกสิ่งเล็ก ๆ สักอย่าง แล้วดูว่ามันพาเราไปเจออะไร</p>
    </StoryReveal>
    <StoryReveal className="home-invitation-prompts">
      <Tabs defaultActiveKey="write" aria-label="เลือกกิจกรรมสั้น ๆ" items={invitations.map(({ key, label, title, steps, note }) => ({
        key, label, children: <div className="home-invitation-panel"><h3>{title}</h3><ol>{steps.map((step) => <li key={step}>{step}</li>)}</ol><p className="home-invitation-note">{note}</p></div>,
      }))}/>
    </StoryReveal>
  </section>;
}
