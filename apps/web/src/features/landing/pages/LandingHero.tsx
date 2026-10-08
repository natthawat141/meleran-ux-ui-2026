import React, { useRef, useState } from 'react';
import { Button } from 'antd';
import { ArrowRightOutlined, BookOutlined, BulbOutlined, CloseOutlined, LineChartOutlined, PlayCircleFilled, SoundOutlined, TeamOutlined } from '@ant-design/icons';
import { motion, useReducedMotion, useScroll, useTransform, type Variants } from 'motion/react';
import heroImage from '@melearn/ui/assets/generated/melearn-student-hero.webp';

const reveal: Variants = {
  // Copy stays readable while the entrance motion runs.
  hidden: { opacity: 1, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 20 } },
};

const benefits = [
  { icon: BookOutlined, title: 'เรียนในแบบของคุณ', text: 'เลือกคอร์สและเวลาที่สะดวก' },
  { icon: TeamOutlined, title: 'มีผู้สอนคอยช่วย', text: 'ถามเรื่องที่ยังไม่เข้าใจ' },
  { icon: LineChartOutlined, title: 'ค่อย ๆ พัฒนาไปด้วยกัน', text: 'เรียนรู้แล้วลองลงมือทำ' },
];

const highlights = [
  { key: 'learn', icon: BookOutlined, title: 'เข้าใจทีละขั้น', lines: ['เรียนรู้แนวคิด', 'ก่อนลองลงมือทำ'] },
  { key: 'practice', icon: BulbOutlined, title: 'มั่นใจขึ้น', lines: ['ฝึกไปพร้อมบทเรียน', 'ทบทวนได้ในเวลาของคุณ'] },
  { key: 'progress', icon: LineChartOutlined, title: 'ก้าวต่อได้ทุกวัน', lines: ['ดูความคืบหน้า', 'แล้วกลับมาเรียนต่อ'] },
];

export function LandingHero() {
  const heroRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '4%']);

  return (
    <section ref={heroRef} className="home-hero home-hero-vivid" aria-labelledby="home-title">
      <div className="home-container home-hero-layout">
        <motion.div
          className="home-hero-copy"
          initial={reducedMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={{ visible: { transition: { staggerChildren: 0.09 } } }}
        >
          <motion.p variants={reducedMotion ? undefined : reveal} className="home-hero-kicker">SUCCESS WITH MELEARN</motion.p>
          <motion.h1 variants={reducedMotion ? undefined : reveal} id="home-title">
            เรียนรู้วันนี้<br />
            <span className="home-hero-blue">เพื่ออนาคต</span><span className="home-hero-red">ที่ดีกว่า</span>
          </motion.h1>
          <motion.p variants={reducedMotion ? undefined : reveal} className="home-intro">
            เพิ่มทักษะที่อยากมี ผ่านคอร์สออนไลน์ที่เลือกเวลาเรียนได้เอง พร้อมบทเรียนและแบบฝึกหัดที่ช่วยให้คุณค่อย ๆ ไปต่อ
          </motion.p>
          <motion.div variants={reducedMotion ? undefined : reveal} className="home-hero-actions">
            <Button href="/courses" type="primary" size="large">
              <PlayCircleFilled aria-hidden="true" /> สำรวจคอร์สเรียน
            </Button>
            <Button className="home-hero-secondary" href="/register" size="large">
              สมัครเรียนออนไลน์ <ArrowRightOutlined aria-hidden="true" />
            </Button>
          </motion.div>
          <motion.ul variants={reducedMotion ? undefined : reveal} className="home-hero-benefits">
            {benefits.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <span className="home-hero-benefit-icon"><Icon aria-hidden="true" /></span>
                <div><strong>{title}</strong><span>{text}</span></div>
              </li>
            ))}
          </motion.ul>
        </motion.div>
        <div className="home-hero-visual">
          <motion.img
            className="home-hero-student"
            src={heroImage}
            alt="ภาพประกอบนักเรียนยิ้มอย่างมั่นใจ พร้อมกราฟิกสีน้ำเงิน ฟ้า และแดง"
            fetchPriority="high"
            width="1122"
            height="1402"
            style={{ y: reducedMotion ? 0 : backgroundY }}
          />
          {highlights.map(({ key, icon: Icon, title, lines }) => (
            <div className={`home-hero-float home-hero-float-${key}`} key={key}>
              <span className="home-hero-float-icon"><Icon aria-hidden="true" /></span>
              <div><strong>{title}</strong><span>{lines[0]}<br />{lines[1]}</span></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingAnnouncement() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <aside className="home-announcement" aria-label="เริ่มเรียนกับ Melearn">
      <a href="/courses">
        <SoundOutlined aria-hidden="true" />
        <span>เริ่มต้นได้วันนี้ เลือกคอร์สที่ใช่ แล้วเรียนในจังหวะของคุณ</span>
        <strong>ดูคอร์สทั้งหมด <ArrowRightOutlined aria-hidden="true" /></strong>
      </a>
      <Button type="text" icon={<CloseOutlined aria-hidden="true" />} aria-label="ปิดข้อความแนะนำ" onClick={() => setVisible(false)} />
    </aside>
  );
}
