import React, { useEffect } from 'react';
import { Alert, ConfigProvider, type ThemeConfig } from 'antd';
import { LandingFooter, LandingHeader, designTokens, landingTheme } from '@melearn/ui';
export { landingTheme } from '@melearn/ui';
import { usePublicBlog } from '../../blog/hooks/usePublicBlog';
import { useAuthSession } from '../../auth/api/AuthSessionProvider';
import { CourseCollection } from './CourseCollection';
import { LandingFaq } from './LearningSections';
import { LearningStart } from './LearningStart';
import { ReadingCollection } from './ReadingCollection';
import { FounderPreview } from './BrandStory';
import { LandingAnnouncement, LandingHero } from './LandingHero';
import { NewsletterBanner } from './NewsletterBanner';
import { InstructorSpotlight } from './InstructorSpotlight';
import '@melearn/ui/styles/landing.css';
import '../styles/landing-hero.css';
import '../styles/landing-vivid.css';
import '../styles/landing-collections.css';

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
  const blog = usePublicBlog();
  const { user } = useAuthSession();

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
        <LandingHeader currentUser={user ? { id: user.id, name: user.display_name, role: user.roles.includes('instructor') ? 'instructor' : 'learner' } : null} />
        <main id="home-main" tabIndex={-1}>
          <LandingHero />
          <CourseCollection />
          <InstructorSpotlight />
          <ReadingCollection posts={blog.data ?? []} />
          {blog.isError && <Alert type="warning" message="โหลดบทความไม่ได้" action={<button onClick={() => void blog.refetch()}>ลองอีกครั้ง</button>} />}
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
