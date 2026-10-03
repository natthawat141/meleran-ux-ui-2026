import React from 'react';
import { Tabs } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import './instructor-spotlight.css';

const instructors = [
  {
    id: 'mind',
    name: 'ครูมายด์',
    subject: 'เขียนและเล่าเรื่อง',
    introduction: 'มีเรื่องอยากเล่า แต่ไม่รู้จะเริ่มตรงไหน?',
    description: 'ลองหยิบเรื่องใกล้ตัวมาเขียน แล้วค่อย ๆ เรียบเรียงให้เป็นเรื่องที่คนอื่นเข้าใจ เริ่มจากข้อความสั้น ๆ ก็ได้',
    activities: ['เล่าเรื่องจากชีวิตประจำวัน', 'เขียนให้คนอ่านเข้าใจ', 'ลองทำทีละชิ้น'],
  },
  {
    id: 'ton',
    name: 'ครูต้น',
    subject: 'ข้อมูลและทักษะดิจิทัล',
    introduction: 'ตัวเลขและเครื่องมือใหม่ ๆ เริ่มเรียนได้ทีละนิด',
    description: 'ชวนตั้งคำถามกับข้อมูลที่เจอในแต่ละวัน แล้วลองใช้เครื่องมือดิจิทัลช่วยหาคำตอบ ผ่านตัวอย่างที่คุ้นเคย',
    activities: ['อ่านข้อมูลรอบตัว', 'ลองใช้เครื่องมือดิจิทัล', 'อธิบายสิ่งที่ค้นพบ'],
  },
  {
    id: 'praew',
    name: 'ครูแพรว',
    subject: 'วางแผนและจัดระบบงาน',
    introduction: 'งานเยอะจนไม่รู้จะเริ่มอะไร ลองค่อย ๆ จัดไปด้วยกัน',
    description: 'เริ่มจากสิ่งที่ต้องทำวันนี้ แบ่งงานใหญ่เป็นขั้นเล็ก ๆ แล้วลองหาวิธีวางแผนที่เข้ากับชีวิตเรียนของตัวเอง',
    activities: ['แบ่งงานให้เริ่มง่าย', 'วางแผนสัปดาห์ของตัวเอง', 'ทบทวนและลองปรับ'],
  },
];

export function InstructorSpotlight() {
  return (
    <section className="home-container home-teachers" aria-labelledby="home-teachers-title">
      <div className="home-teachers-heading">
        <h2 id="home-teachers-title">เรียนกับใครได้บ้าง?</h2>
        <p>เลือกผู้สอน แล้วดูว่าแต่ละคนชวนคุณลองทำอะไรบ้าง</p>
      </div>
      <Tabs
        className="home-teacher-tabs"
        defaultActiveKey="mind"
        aria-label="เลือกดูผู้สอนตัวอย่าง"
        items={instructors.map((instructor, index) => ({
          key: instructor.id,
          label: (
            <span className="home-teacher-choice">
              <span className="home-teacher-choice-photo" aria-hidden="true">
                <img src="/images/instructors/instructor-mock-sheet.png" alt="" style={{ left: `${-100 * index}%` }} loading="lazy" />
              </span>
              <span>{instructor.name}<small>{instructor.subject}</small></span>
            </span>
          ),
          children: (
            <div className="home-teacher-profile">
              <div className={`home-teacher-photo home-teacher-photo-${instructor.id}`}>
                <img
                  src="/images/instructors/instructor-mock-sheet.png"
                  alt={`ภาพผู้สอนจำลอง ${instructor.name}`}
                  style={{ left: `${-100 * index}%` }}
                  loading="lazy"
                />
              </div>
              <div className="home-teacher-story">
                <p className="home-teacher-demo">ตัวอย่างผู้สอน · ภาพและข้อมูลจำลอง</p>
                <p className="home-teacher-name">{instructor.name} <span>ชวนเรียน{instructor.subject}</span></p>
                <h3>{instructor.introduction}</h3>
                <p className="home-teacher-description">{instructor.description}</p>
                <ul className="home-teacher-activities">
                  {instructor.activities.map((activity) => <li key={activity}>{activity}</li>)}
                </ul>
                <Link className="home-text-link" to="/courses">สำรวจคอร์สเรียน <ArrowRightOutlined aria-hidden="true" /></Link>
              </div>
            </div>
          ),
        }))}
      />
    </section>
  );
}
