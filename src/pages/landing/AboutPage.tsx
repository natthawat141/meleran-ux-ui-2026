import React, { useEffect } from 'react';
import { Button, ConfigProvider } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRightOutlined } from '@ant-design/icons';
import { LandingHeader, LandingFooter } from './LandingChrome';
import { landingTheme } from './LandingPage';
import { founders, FounderPortrait, StoryReveal } from './BrandStory';
import './landing.css';
import './brand-story.css';

interface Principle {
  title: string;
  text: string;
}

const principles: Principle[] = [
  { title: 'เริ่มจากความสนใจ', text: 'มีพื้นที่ให้สำรวจเรื่องที่อยากรู้ ก่อนเลือกคอร์สที่เหมาะกับสิ่งที่อยากทำ' },
  { title: 'เรียนแล้วได้ลองทำ', text: 'เชื่อมบทเรียนกับแบบฝึกหัด ให้ความเข้าใจค่อย ๆ เกิดขึ้นจากการลงมือทำ' },
  { title: 'ไปต่อในจังหวะของตัวเอง', text: 'กลับมาเรียนและทบทวนได้ เพื่อให้การเรียนรู้เป็นส่วนหนึ่งของชีวิตประจำวัน' },
];

export function AboutPage() {
  const { hash } = useLocation();
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'รู้จักเรา — Melearn';
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
    return () => {
      document.title = previousTitle;
    };
  }, [hash]);

  return (
    <ConfigProvider theme={landingTheme}>
      <div className="home-v3 about-page">
        <a className="home-skip" href="#about-main">ข้ามไปเนื้อหาหลัก</a>
        <LandingHeader />
        <main id="about-main" tabIndex={-1}>
          <section className="home-container about-hero" aria-labelledby="about-title">
            <StoryReveal className="about-hero-copy">
              <p className="brand-kicker">รู้จัก melearn</p>
              <h1 id="about-title">
                การเรียนรู้ที่ดี<br />เริ่มจาก<span>ความเข้าใจคน</span>
              </h1>
              <p className="about-hero-intro">
                เรากำลังสร้างพื้นที่ที่ความอยากรู้ได้กลายเป็นการลงมือทำ และทุกคนมีพื้นที่ให้เติบโตในแบบของตัวเอง
              </p>
              <a className="home-text-link" href="#our-story">
                เรื่องราวของเรา <ArrowRightOutlined aria-hidden="true" />
              </a>
            </StoryReveal>
            <StoryReveal className="about-hero-portraits">
              {founders.map((founder) => (
                <FounderPortrait key={founder.id} founder={founder} eager />
              ))}
            </StoryReveal>
            <p className="about-photo-caption">สามคน สามมุมมอง หนึ่งพื้นที่เรียนรู้ร่วมกัน</p>
          </section>

          <section id="our-story" className="about-story-surface" aria-labelledby="about-story-title">
            <div className="home-container about-story-layout">
              <StoryReveal>
                <p className="brand-kicker">ทำไมถึงมี melearn</p>
                <h2 id="about-story-title">ความอยากรู้<br />ควรมีที่ให้ไปต่อ</h2>
              </StoryReveal>
              <StoryReveal className="about-story-text">
                <p className="about-lead">
                  บางครั้งจุดเริ่มต้นของการเรียนรู้ ไม่ใช่เป้าหมายที่ยิ่งใหญ่ แต่เป็นคำถามเล็ก ๆ ว่า “เราลองทำสิ่งนี้ได้ไหม”
                </p>
                <p>
                  เราอยากให้ melearn ช่วยเชื่อมความสนใจนั้นกับบทเรียนที่เข้าใจง่าย เปิดพื้นที่ให้ลองทำ ทบทวน และค่อย ๆ ค้นพบสิ่งที่เหมาะกับตัวเอง
                </p>
                <p>
                  ทั้งคอร์ส บทความ และแบบฝึกหัด จึงเป็นส่วนหนึ่งของพื้นที่เดียวกัน เป็นทางเลือกให้คุณได้เรียนรู้มากกว่าหนึ่งรูปแบบ
                </p>
              </StoryReveal>
            </div>
          </section>

          <section className="home-container about-principles" aria-labelledby="about-principles-title">
            <div className="home-section-heading">
              <div>
                <p className="brand-kicker">สิ่งที่เราอยากให้เกิดขึ้น</p>
                <h2 id="about-principles-title">เรียนรู้ได้ แล้วนำไปใช้ได้</h2>
              </div>
            </div>
            <div className="about-principle-grid">
              {principles.map((principle) => (
                <StoryReveal key={principle.title} className="about-principle">
                  <h3>{principle.title}</h3>
                  <p>{principle.text}</p>
                </StoryReveal>
              ))}
            </div>
          </section>

          <section id="founders" className="home-container about-founders" aria-labelledby="about-founders-title">
            <div className="about-founders-heading">
              <div>
                <p className="brand-kicker">ทีมผู้ก่อตั้ง</p>
                <h2 id="about-founders-title">คนที่กำลังสร้าง melearn</h2>
              </div>
              <p className="about-content-note">
                ร่วมกันดูแลทิศทางองค์กร การดำเนินงาน<br />และเทคโนโลยีของพื้นที่เรียนรู้แห่งนี้
              </p>
            </div>
            <div className="about-founder-grid">
              {founders.map((founder) => (
                <StoryReveal key={founder.id} className="about-founder">
                  <article id={`founder-${founder.id}`}>
                    <FounderPortrait founder={founder} />
                    <p className="founder-label">ผู้ร่วมก่อตั้ง</p>
                    <h3>{founder.name}</h3>
                    <p className="founder-role">{founder.role}</p>
                  </article>
                </StoryReveal>
              ))}
            </div>
          </section>

          <section className="about-closing" aria-labelledby="about-closing-title">
            <StoryReveal className="home-container">
              <p className="brand-kicker">เริ่มจากสิ่งที่คุณอยากรู้</p>
              <h2 id="about-closing-title">ก้าวต่อไปของคุณ<br />อาจเริ่มจากเรื่องเล็ก ๆ วันนี้</h2>
              <div className="about-closing-actions">
                <Button type="primary" size="large" href="/courses">
                  สำรวจคอร์ส <ArrowRightOutlined aria-hidden="true" />
                </Button>
                <Link className="home-text-link" to="/articles">
                  เริ่มจากอ่านบทความ <ArrowRightOutlined aria-hidden="true" />
                </Link>
              </div>
            </StoryReveal>
          </section>
        </main>
        <LandingFooter />
      </div>
    </ConfigProvider>
  );
}
