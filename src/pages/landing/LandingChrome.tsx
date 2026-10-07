import React, { useState } from 'react';
import { Button, Drawer } from 'antd';
import { ArrowRightOutlined, MenuOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useLms } from '../../store';
import logo from '../../assets/melearn-ui/logo.PNG';
import type { Role } from '../../types';

function MelearnLogo() {
  return (
    <Link to="/" className="home-brand" aria-label="melearn หน้าแรก">
      <span className="home-logo-crop">
        <img src={logo} alt="melearn" width="1920" height="1080" />
      </span>
    </Link>
  );
}

function MainNavigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <Link to="/courses" onClick={onNavigate}>
        คอร์สเรียน
      </Link>
      <a href="/#how-it-works" onClick={onNavigate}>
        วิธีเรียน
      </a>
      <Link to="/articles" onClick={onNavigate}>
        บทความ
      </Link>
      <Link to="/about" onClick={onNavigate}>
        รู้จักเรา
      </Link>
    </>
  );
}

export function LandingHeader() {
  const { currentUser } = useLms();
  const [menuOpen, setMenuOpen] = useState(false);
  const workspaceMap: Record<Role, string> = { learner: '/learn', instructor: '/teach', admin: '/admin' };
  const workspace = currentUser?.role ? workspaceMap[currentUser.role] ?? '/login' : '/login';

  return (
    <header className="home-header">
      <div className="home-container home-header-inner">
        <MelearnLogo />
        <nav className="home-desktop-nav" aria-label="เมนูหลัก">
          <MainNavigation />
        </nav>
        <div className="home-account-actions">
          <div className="home-desktop-account">
            {!currentUser && (
              <Link className="home-login" to="/login">
                เข้าสู่ระบบ
              </Link>
            )}
            <Button href={currentUser ? workspace : '/register'} type="primary">
              {currentUser ? 'พื้นที่ของฉัน' : 'สมัครสมาชิก'}
            </Button>
          </div>
          <Button
            className="home-menu-trigger"
            type="text"
            icon={<MenuOutlined aria-hidden="true" />}
            aria-label="เปิดเมนู"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          />
        </div>
      </div>
      <Drawer
        title="เมนู melearn"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        size={310}
        rootClassName="home-mobile-drawer"
      >
        <nav aria-label="เมนูบนมือถือ" className="home-mobile-nav">
          <MainNavigation onNavigate={() => setMenuOpen(false)} />
          <div className="home-mobile-account">
            {currentUser ? (
              <Link className="home-mobile-primary" to={workspace} onClick={() => setMenuOpen(false)}>
                พื้นที่ของฉัน <ArrowRightOutlined aria-hidden="true" />
              </Link>
            ) : (
              <>
                <Link to="/login" onClick={() => setMenuOpen(false)}>
                  เข้าสู่ระบบ
                </Link>
                <Link className="home-mobile-primary" to="/register" onClick={() => setMenuOpen(false)}>
                  สมัครสมาชิก <ArrowRightOutlined aria-hidden="true" />
                </Link>
              </>
            )}
          </div>
        </nav>
      </Drawer>
    </header>
  );
}

export function LandingFooter() {
  return (
    <footer className="home-footer">
      <div className="home-container">
        <div className="home-footer-grid">
          <div className="home-footer-brand">
            <MelearnLogo />
            <p>
              ทุกทักษะใหม่
              <br />
              เริ่มจากความอยากเรียนรู้ของคุณ
            </p>
          </div>
          <nav aria-label="สำรวจ melearn">
            <h2>เริ่มเรียนรู้</h2>
            <Link to="/courses">คอร์สทั้งหมด</Link>
            <a href="/#how-it-works">วิธีเรียนกับเรา</a>
            <Link to="/articles">บทความทั้งหมด</Link>
            <Link to="/about">เรื่องราวของ melearn</Link>
            <a href="/#newsletter">รับข่าวสารจาก melearn</a>
          </nav>
          <nav aria-label="ช่วยเหลือผู้เรียน">
            <h2>สำหรับผู้เรียน</h2>
            <Link to="/login">เข้าสู่ระบบ</Link>
            <Link to="/register">สมัครสมาชิก</Link>
            <a href="/#faq">คำถามที่พบบ่อย</a>
          </nav>
        </div>
        <div className="home-footer-bottom">
          <span>© {new Date().getFullYear()} melearn</span>
          <span>เรียนรู้ได้ ในแบบของคุณ</span>
        </div>
      </div>
    </footer>
  );
}
