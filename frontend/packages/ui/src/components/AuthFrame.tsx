import React from 'react';
import { Text } from '@mantine/core';
import defaultLoginArtworkUrl from '../assets/melearn-ui/melearn-hero.jpg';

export interface AuthFrameProps {
  children: React.ReactNode;
  variant?: 'entry' | string;
  brand?: React.ReactNode;
  loginArtworkUrl?: string;
}

export function AuthFrame({ children, variant, brand, loginArtworkUrl = defaultLoginArtworkUrl }: AuthFrameProps) {
  if (variant === 'entry') {
    return (
      <div className="auth-frame auth-frame-entry">
        <main className="auth-main auth-main-entry">
          {brand && <div className="auth-entry-brand">{brand}</div>}
          <div className="auth-entry-content">{children}</div>
          <Text className="auth-footnote" size="xs" c="dimmed">
            ระบบเข้าสู่ระบบ Melearn
          </Text>
        </main>
        {loginArtworkUrl && (
          <aside className="auth-entry-cover" aria-hidden="true">
            <img src={loginArtworkUrl} alt="" />
          </aside>
        )}
      </div>
    );
  }
  return (
    <div className="auth-frame">
      <aside className="auth-aside">
        {brand}
        <div className="auth-aside-copy">
          <Text className="auth-aside-kicker">เรียนให้เป็นเรื่องของคุณ</Text>
          <h1>
            ไอเดียที่ดี
            <br />
            เริ่มจากการ
            <br />
            <span>เรียนรู้ต่อ</span>
          </h1>
          <Text className="auth-aside-description" size="sm">
            เลือกเส้นทางที่ใช่ เรียนทีละบท และกลับมาต่อได้ทุกเมื่อ
          </Text>
        </div>
        <Text className="auth-aside-foot">melearn · เรียนรู้ได้ในทุกจังหวะ</Text>
      </aside>
      <main className="auth-main">
        {brand && <div className="auth-mobile-brand">{brand}</div>}
        {children}
        <Text className="auth-footnote" size="xs" c="dimmed">
          ระบบเข้าสู่ระบบ Melearn
        </Text>
      </main>
    </div>
  );
}
