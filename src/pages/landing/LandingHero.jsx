import React, { useRef } from 'react';
import { Button } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import heroImage from '../../assets/melearn-ui/melearn-hero.jpg';

const reveal = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 20 } },
};

export function LandingHero() {
  const heroRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '8%']);

  return <section ref={heroRef} className="home-hero" aria-labelledby="home-title">
    <motion.div className="home-hero-background" aria-hidden="true" style={{ y: reducedMotion ? 0 : backgroundY }}>
      <img src={heroImage} alt="" fetchPriority="high" width="1440" height="842" />
    </motion.div>
    <div className="home-hero-scrim" aria-hidden="true" />
    <div className="home-container home-hero-layout">
      <motion.div className="home-hero-copy"
        initial={reducedMotion ? false : 'hidden'}
        whileInView="visible" viewport={{ once: true, amount: 0.2 }}
        variants={{ visible: { transition: { staggerChildren: 0.09 } } }}>
        <motion.p variants={reducedMotion ? undefined : reveal} className="home-eyebrow">พื้นที่เรียนรู้ ที่เป็นของคุณ</motion.p>
        <motion.h1 variants={reducedMotion ? undefined : reveal} id="home-title">เรียนรู้สิ่งใหม่<br/><span>ในจังหวะของคุณ</span></motion.h1>
        <motion.p variants={reducedMotion ? undefined : reveal} className="home-intro">ค่อย ๆ เพิ่มทักษะที่อยากมี ผ่านคอร์สออนไลน์ที่เลือกเวลาเรียนได้เอง พร้อมผู้สอนที่ช่วยให้คุณไปต่อ</motion.p>
        <motion.div variants={reducedMotion ? undefined : reveal} className="home-hero-actions">
          <Button href="/courses" type="primary" size="large">สำรวจคอร์ส <ArrowRightOutlined aria-hidden="true" /></Button>
          <a className="home-secondary-link" href="#how-it-works">เรียนกับ melearn อย่างไร <ArrowRightOutlined aria-hidden="true" /></a>
        </motion.div>
      </motion.div>
    </div>
  </section>;
}
