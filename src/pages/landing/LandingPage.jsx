import React, { useEffect } from 'react';
import { ConfigProvider } from 'antd';
import { useLms } from '../../store.jsx';
import { LandingHeader, LandingFooter } from './LandingChrome.jsx';
import { CourseCollection } from './CourseCollection.jsx';
import { LandingFaq } from './LearningSections.jsx';
import { LearningGuide } from './LearningGuide.jsx';
import { ReadingCollection } from './ReadingCollection.jsx';
import { PartnerPreview } from './PartnerPreview.jsx';
import { LandingHero } from './LandingHero.jsx';
import { NewsletterBanner } from './NewsletterBanner.jsx';
import './landing.css';

export const landingTheme = {
  inherit: false,
  token: {
    colorPrimary: '#0074e8', colorInfo: '#0074e8', colorText: '#233e53',
    colorTextSecondary: '#546e81', colorBgContainer: '#ffffff',
    colorBorder: '#d5e7f2', colorFillAlter: '#f0f8fd',
    fontFamily: '"Anuphan Variable", sans-serif', fontSize: 16,
    borderRadius: 12, controlHeight: 44,
  },
  components: {
    Button: { primaryShadow: 'none', defaultShadow: 'none', fontWeight: 500 },
    Tabs: { horizontalItemGutter: 28, titleFontSize: 15 },
    Collapse: { headerBg: '#ffffff', contentBg: '#ffffff', headerPadding: '22px 0' },
  },
};

export function LandingPage() {
  const { data } = useLms();
  const courses = data.courses.filter((course) => course.status === 'published');

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const previousColor = meta?.content;
    if (meta) meta.content = '#ffffff';
    return () => { if (meta && previousColor) meta.content = previousColor; };
  }, []);

  return <ConfigProvider theme={landingTheme}>
    <div className="home-v3">
      <a className="home-skip" href="#home-main">ข้ามไปเนื้อหาหลัก</a>
      <LandingHeader />
      <main id="home-main" tabIndex={-1}>
        <LandingHero />
        <CourseCollection courses={courses} data={data} />
        <LearningGuide />
        <PartnerPreview />
        <ReadingCollection posts={data.blogPosts.filter((post) => post.status === 'published')} />
        <LandingFaq />
        <NewsletterBanner />
      </main>
      <LandingFooter />
    </div>
  </ConfigProvider>;
}
