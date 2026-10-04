import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightOutlined } from '@ant-design/icons';
import { motion, useReducedMotion } from 'motion/react';
import './brand-story.css';

export const founders = [
  { id: 3, image: '/images/founders/kiattisak-sing-ngam-ceo.jpg', name: 'Kiattisak Sing-ngam', role: 'ประธานเจ้าหน้าที่บริหาร · CEO', width: 960, height: 955 },
  { id: 1, image: '/images/founders/nichanun-kaitom-thongprasert-coo.jpg', name: 'Nichanun Kaitom Thongprasert', role: 'ประธานเจ้าหน้าที่ฝ่ายปฏิบัติการ · COO', width: 1030, height: 1030 },
  { id: 2, image: '/images/founders/natthawat-sawatdee-cto.jpg', name: 'Natthawat Sawatdee', role: 'ประธานเจ้าหน้าที่ฝ่ายเทคโนโลยี · CTO', width: 1086, height: 1448 },
];

export function StoryReveal({ children, className = '' }) {
  const reducedMotion = useReducedMotion();
  return <motion.div className={className} initial={reducedMotion ? false : { opacity: 0, y: 18 }}
    whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }}
    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>;
}

export function BrandIntroduction() {
  return <section className="home-container brand-introduction" aria-labelledby="brand-intro-title">
    <p className="brand-kicker">ความตั้งใจของ melearn</p>
    <StoryReveal className="brand-introduction-copy">
      <h2 id="brand-intro-title">พื้นที่เล็ก ๆ สำหรับ<br/>ความเป็นไปได้<span>ที่มากขึ้น</span></h2>
      <div><p>ไม่ว่าคุณจะเริ่มจากความสงสัย อยากลองสิ่งใหม่ หรืออยากทำสิ่งเดิมให้ดีขึ้น การเรียนรู้เริ่มได้จากตรงนั้น</p>
        <p>เราอยากให้ melearn เป็นพื้นที่ที่คุณได้ค่อย ๆ เรียนรู้ ลงมือทำ และเติบโตในจังหวะของตัวเอง</p>
        <Link className="home-text-link" to="/about">อ่านเรื่องราวของเรา <ArrowRightOutlined aria-hidden="true" /></Link>
      </div>
    </StoryReveal>
  </section>;
}

export function FounderPortrait({ founder, eager = false }) {
  return <figure className={`founder-portrait founder-portrait-${founder.id}`}>
    <img src={founder.image} alt={founder.name}
      loading={eager ? 'eager' : 'lazy'} decoding="async" width={founder.width} height={founder.height} />
  </figure>;
}

export function FounderPreview() {
  return <section className="brand-team-section" aria-labelledby="brand-team-title">
    <div className="home-container brand-team-layout">
      <StoryReveal className="brand-team-copy">
        <p className="brand-kicker">คนเบื้องหลังพื้นที่เรียนรู้</p>
        <h2 id="brand-team-title">เริ่มจากคนสามคน<br/>และความตั้งใจร่วมกัน</h2>
        <p>ก่อนจะเป็นคอร์สหรือบทเรียน melearn เริ่มจากคำถามว่า เราจะทำให้การเรียนรู้เข้ากับชีวิตของแต่ละคนได้อย่างไร</p>
        <Link className="home-text-link" to="/about#founders">อ่านเรื่องราวของทีม <ArrowRightOutlined aria-hidden="true" /></Link>
      </StoryReveal>
      <StoryReveal className="brand-team-portraits">
        {founders.map((founder) => <article key={founder.id} className="brand-team-person">
          <Link to={`/about#founder-${founder.id}`} aria-label={`อ่านประวัติ ${founder.name}`}><FounderPortrait founder={founder}/></Link>
          <div className="brand-team-identity"><h3>{founder.name}</h3><p>{founder.role}</p></div>
        </article>)}
      </StoryReveal>
    </div>
  </section>;
}
