import React, { useEffect, useRef, useState } from 'react';
import { Button, Form, Input } from 'antd';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import newsletterBackground from '../../assets/generated/newsletter-learning-path-v3.png';
import './newsletter.css';

export function NewsletterBanner() {
  const [form] = Form.useForm();
  const [submitted, setSubmitted] = useState(false);
  const emailRef = useRef(null);
  const successRef = useRef(null);
  const retrying = useRef(false);
  const sectionRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });
  const backgroundY = useTransform(scrollYProgress, [0, 1], ['-12%', '12%']);

  useEffect(() => {
    if (submitted) successRef.current?.focus();
    else if (retrying.current) {
      emailRef.current?.focus();
      retrying.current = false;
    }
  }, [submitted]);

  // UI-only prototype: do not persist the email or send it to a mailing service.
  const subscribe = () => {
    form.resetFields();
    setSubmitted(true);
  };

  return <section ref={sectionRef} id="newsletter" className="home-newsletter" aria-labelledby="home-newsletter-title">
    <motion.div className="home-newsletter-background" aria-hidden="true" style={{ y: reducedMotion ? 0 : backgroundY }}>
      <img src={newsletterBackground} alt="" loading="lazy" decoding="async" width="2172" height="724" />
    </motion.div>
    <div className="home-newsletter-content">
      <h2 id="home-newsletter-title">รับข่าวสารจาก melearn</h2>
      <div className="home-newsletter-form-area">
        {submitted ? <div className="home-newsletter-success">
          <h3 ref={successRef} tabIndex={-1}>ทดลองสมัครสำเร็จแล้ว</h3>
          <p>ตัวอย่างเท่านั้น ยังไม่มีการเก็บอีเมลหรือส่งข่าวสารจริง</p>
          <Button onClick={() => { retrying.current = true; setSubmitted(false); }}>ลองกรอกอีกครั้ง</Button>
        </div> : <Form form={form} layout="vertical" name="landing-newsletter" onFinish={subscribe} requiredMark={false} className="home-newsletter-form">
          <div className="home-newsletter-input-row">
          <Form.Item name="email" validateTrigger="onBlur" normalize={(value) => value.trim()} rules={[
            { required: true, message: 'กรุณากรอกอีเมลก่อนสมัคร' },
            { type: 'email', message: 'ตรวจสอบรูปแบบอีเมล เช่น name@example.com' },
          ]}>
            <Input ref={emailRef} type="email" size="large" aria-label="อีเมลสำหรับรับข่าวสาร" placeholder="อีเมลของคุณ" autoComplete="email" maxLength={254} aria-describedby="home-newsletter-note" />
          </Form.Item>
          <Button type="primary" size="large" htmlType="submit">รับข่าวสาร</Button>
          </div>
          <p id="home-newsletter-note" className="home-newsletter-note">แบบจำลองเท่านั้น ไม่เก็บหรือส่งอีเมลจริง</p>
        </Form>}
      </div>
    </div>
  </section>;
}
