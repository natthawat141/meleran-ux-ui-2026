import React, { useEffect } from 'react';
import { ConfigProvider, type ThemeConfig } from 'antd';
import { useLms } from '../../store';
import { LandingHeader, LandingFooter } from './LandingChrome';
import { CourseCollection } from './CourseCollection';
import { LearningInvitation } from './LearningInvitation';
import { LandingFaq } from './LearningSections';
import { LearningGuide } from './LearningGuide';
import { ReadingCollection } from './ReadingCollection';
import { BrandIntroduction, FounderPreview } from './BrandStory';
import { LandingHero } from './LandingHero';
import { NewsletterBanner } from './NewsletterBanner';
import { InstructorSpotlight } from './InstructorSpotlight';
import './landing.css';

export const landingTheme: ThemeConfig = {
  inherit: false,
  token: {
    colorPrimary: '#0074e8',
    colorInfo: '#0074e8',
    colorText: '#233e53',
    colorTextSecondary: '#546e81',
    colorBgContainer: '#ffffff',
    colorBorder: '#d5e7f2',
    colorFillAlter: '#f0f8fd',
    fontFamily: '"Anuphan Variable", sans-serif',
    fontSize: 16,
    borderRadius: 12,
    controlHeight: 44,
  },
  components: {
    Button: { primaryShadow: 'none', defaultShadow: 'none', fontWeight: 500 },
    Tabs: { horizontalItemGutter: 28, titleFontSize: 15 },
    Collapse: { headerBg: '#ffffff', contentBg: '#ffffff', headerPadding: '22px 0' },
  },
};

// Scope the new palette to the landing route; public pages keep their existing theme.
const homePageTheme: ThemeConfig = {
  ...landingTheme,
  token: {
    ...landingTheme.token,
    colorPrimary: '#0066ff',
    colorInfo: '#0066ff',
    colorText: '#0b1f46',
    colorTextSecondary: '#626d82',
    colorBorder: '#e1e9f5',
    colorFillAlter: '#f7f9ff',
  },
};

export function LandingPage() {
  const { data } = useLms();
  const courses = data.courses.filter((course) => course.status === 'published');

  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousColor = meta?.content;
    if (meta) meta.content = '#ffffff';
    return () => {
      if (meta && previousColor) meta.content = previousColor;
    };
  }, []);

  return (
    <ConfigProvider theme={homePageTheme}>
      <div className="home-v3">
        <a className="home-skip" href="#home-main">ข้ามไปเนื้อหาหลัก</a>
        <LandingHeader />
        <main id="home-main" tabIndex={-1}>
          <LandingHero />
          <InstructorSpotlight />
          <BrandIntroduction />
          <LearningInvitation />
          <ReadingCollection posts={data.blogPosts.filter((post) => post.status === 'published')} />
          <LearningGuide />
          <CourseCollection courses={courses} data={data} />
          <LandingFaq />
          <FounderPreview />
          <NewsletterBanner />
        </main>
        <LandingFooter />
      </div>
    </ConfigProvider>
  );
}
