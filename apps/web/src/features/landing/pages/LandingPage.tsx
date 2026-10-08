import React, { useEffect } from 'react';
import { ConfigProvider, type ThemeConfig } from 'antd';
import { designTokens, landingTheme } from '@melearn/ui';
export { landingTheme } from '@melearn/ui';
import { useLms } from '@legacy/store';
import { LandingHeader, LandingFooter } from '@legacy/pages/landing/LandingChrome';
import { CourseCollection } from './CourseCollection';
import { LandingFaq } from './LearningSections';
import { LearningStart } from './LearningStart';
import { ReadingCollection } from './ReadingCollection';
import { FounderPreview } from './BrandStory';
import { LandingAnnouncement, LandingHero } from './LandingHero';
import { NewsletterBanner } from './NewsletterBanner';
import { InstructorSpotlight } from './InstructorSpotlight';
import '@legacy/pages/landing/landing.css';
import './landing-hero.css';
import './landing-vivid.css';
import './landing-collections.css';

// Scope the new palette to the landing route; public pages keep their existing theme.
const homePageTheme: ThemeConfig = {
  ...landingTheme,
  token: {
    ...landingTheme.token,
    colorPrimary: designTokens.landing.brand.blue,
    colorInfo: designTokens.landing.brand.blue,
    colorText: designTokens.landing.brand.ink,
    colorTextSecondary: designTokens.landing.brand.muted,
    colorBorder: designTokens.landing.brand.line,
    colorFillAlter: designTokens.landing.brand.sky,
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
        <LandingAnnouncement />
        <LandingHeader />
        <main id="home-main" tabIndex={-1}>
          <LandingHero />
          <CourseCollection courses={courses} data={data} />
          <InstructorSpotlight />
          <ReadingCollection posts={data.blogPosts.filter((post) => post.status === 'published')} />
          <LearningStart />
          <LandingFaq />
          <FounderPreview />
          <NewsletterBanner />
        </main>
        <LandingFooter />
      </div>
    </ConfigProvider>
  );
}
