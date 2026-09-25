import React, { useState } from 'react';
import { AppShell, Avatar, Burger, Button, Group, Menu, NavLink, Select, Stack, Text } from '@mantine/core';
import { IconAdjustments, IconArticle, IconBook2, IconCertificate, IconChevronDown, IconCirclePlus, IconClipboardCheck, IconLayoutDashboard, IconLogout, IconReceipt, IconSchool, IconSettings, IconShoppingBag, IconUsers } from '@tabler/icons-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLms } from '../store.jsx';
import { LandingHeader, LandingFooter } from '../pages/landing/LandingChrome.jsx';
import logo from '../assets/melearn-ui/logo.PNG';
import loginArtwork from '../assets/generated/guide-learning-path-v2.png';

const roleMenus = {
  learner: [
    { key: '/learn', icon: <IconLayoutDashboard />, label: 'ภาพรวมการเรียน' },
    { key: '/learn/courses', icon: <IconBook2 />, label: 'คอร์สของฉัน' },
    { key: '/courses', icon: <IconShoppingBag />, label: 'สำรวจคอร์ส' },
    { key: '/account/orders', icon: <IconReceipt />, label: 'รายการสั่งซื้อ' },
    { key: '/account/certificates', icon: <IconCertificate />, label: 'ใบรับรอง' },
    { key: '/account/profile', icon: <IconSettings />, label: 'บัญชีของฉัน' },
  ],
  instructor: [
    { key: '/teach', icon: <IconLayoutDashboard />, label: 'ภาพรวมผู้สอน' },
    { key: '/teach/courses', icon: <IconBook2 />, label: 'คอร์สของฉัน' },
    { key: '/teach/courses/new', icon: <IconCirclePlus />, label: 'สร้างคอร์ส' },
    { key: '/teach/quizzes', icon: <IconClipboardCheck />, label: 'งานตรวจคำตอบ' },
    { key: '/teach/learners', icon: <IconUsers />, label: 'ผู้เรียน' },
    { key: '/account/profile', icon: <IconSettings />, label: 'บัญชีของฉัน' },
  ],
  admin: [
    { key: '/admin', icon: <IconLayoutDashboard />, label: 'ภาพรวมระบบ' },
    { key: '/admin/articles', icon: <IconArticle />, label: 'บทความ' },
    { key: '/admin/instructors', icon: <IconSchool />, label: 'ผู้สอนและคำขอ' },
    { key: '/admin/courses', icon: <IconBook2 />, label: 'คอร์สทั้งหมด' },
    { key: '/admin/users', icon: <IconUsers />, label: 'ผู้ใช้งาน' },
    { key: '/admin/orders', icon: <IconReceipt />, label: 'รายการสั่งซื้อ' },
    { key: '/admin/certificates', icon: <IconCertificate />, label: 'ใบรับรอง' },
  ],
};

const roleMeta = {
  learner: { label: 'ผู้เรียน', title: 'พื้นที่เรียนรู้', home: '/learn' },
  instructor: { label: 'ผู้สอน', title: 'สตูดิโอผู้สอน', home: '/teach' },
  admin: { label: 'แอดมิน', title: 'จัดการระบบ', home: '/admin' },
};

function activeMenuKey(path, items) {
  const exact = items.find((item) => path === item.key);
  if (exact) return exact.key;
  return [...items].sort((a, b) => b.key.length - a.key.length).find((item) => path.startsWith(`${item.key}/`))?.key ?? items[0].key;
}

function Brand() {
  return <Link to="/" className="brand-lockup" aria-label="melearn หน้าแรก"><span className="brand-logo-crop"><img src={logo} alt="" width="1920" height="1080" /></span></Link>;
}

export function PublicShell({ children }) {
  return <div className="public-shell">
    <LandingHeader />
    <main className="public-main" id="public-main">{children}</main>
    <LandingFooter />
  </div>;
}

export function WorkspaceShell({ children }) {
  const { currentUser, signInDemo, signOut } = useLms();
  const location = useLocation();
  const navigate = useNavigate();
  const [opened, setOpened] = useState(false);
  const role = currentUser?.role ?? 'learner';
  const meta = roleMeta[role] ?? roleMeta.learner;
  const items = roleMenus[role] ?? roleMenus.learner;
  const selected = role === 'admin' && location.pathname.startsWith('/teach/')
    ? '/admin/courses'
    : role === 'instructor' && location.pathname.startsWith('/teach/attempts/')
      ? '/teach/quizzes'
      : activeMenuKey(location.pathname, items);
  const toWorkspace = (nextRole) => {
    const result = signInDemo(nextRole);
    if (result.ok) navigate(roleMeta[nextRole].home);
  };
  const navLinks = items.map((item) => <NavLink key={item.key} component={Link} to={item.key} label={item.label} leftSection={item.icon} active={selected === item.key} onClick={() => setOpened(false)} />);
  const profileInitial = currentUser?.name?.trim()?.slice(0, 1) || meta.label.slice(0, 1);

  return <AppShell className="workspace-shell" header={{ height: 72 }} navbar={{ width: 258, breakpoint: 'md', collapsed: { mobile: !opened } }} padding="xl">
    <AppShell.Header className="workspace-header">
      <Group h="100%" px="lg" justify="space-between" wrap="nowrap">
        <Group gap="md" wrap="nowrap"><Burger opened={opened} onClick={() => setOpened((value) => !value)} hiddenFrom="md" size="sm" aria-label={opened ? 'ปิดเมนู' : 'เปิดเมนู'} /><Brand /><span className="header-divider"/><Text className="workspace-context" size="sm">{meta.title}</Text></Group>
        <Group gap="md" wrap="nowrap" className="workspace-header-actions">
          <Select aria-label="ดูตัวอย่างในบทบาท" className="role-switch" value={role} onChange={(value) => value && toWorkspace(value)} data={[{ value: 'learner', label: 'ผู้เรียน' }, { value: 'instructor', label: 'ผู้สอน' }, { value: 'admin', label: 'แอดมิน' }]} leftSection={<IconAdjustments size={16} />} rightSection={<IconChevronDown size={14} />} allowDeselect={false} searchable={false} />
          <Menu position="bottom-end" shadow="md" width={210} withinPortal>
            <Menu.Target><Button variant="subtle" color="dark" className="profile-trigger" leftSection={<Avatar src={currentUser?.avatar || null} size={32} color="cobalt" radius="xl">{profileInitial}</Avatar>} rightSection={<IconChevronDown size={14} />}>{currentUser?.name ?? 'ผู้ใช้งาน'}</Button></Menu.Target>
            <Menu.Dropdown><Menu.Label>บัญชีผู้ใช้</Menu.Label><Menu.Item component={Link} to="/account/profile" leftSection={<IconSettings size={16} />}>บัญชีของฉัน</Menu.Item><Menu.Divider/><Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={() => { signOut(); navigate('/'); }}>ออกจากระบบ</Menu.Item></Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
    </AppShell.Header>
    <AppShell.Navbar className="workspace-navbar" p="md">
      <div className="workspace-nav-heading"><Text size="xs" fw={700} tt="uppercase" c="dimmed" lts={1.2}>เมนูหลัก</Text><Text size="xs" c="dimmed">{meta.label}</Text></div>
      <Stack gap={5} className="workspace-nav-links">{navLinks}</Stack>
      <div className="workspace-nav-bottom"><Button component={Link} to="/courses" variant="light" color="gray" leftSection={<IconShoppingBag size={17} />} fullWidth>กลับไปหน้าคอร์ส</Button><Text size="xs" c="dimmed">melearn · รุ่นทดลอง</Text></div>
    </AppShell.Navbar>
    <AppShell.Main className="workspace-content"><div className="workspace-content-inner">{children}</div></AppShell.Main>
  </AppShell>;
}

export function AuthFrame({ children, variant }) {
  if (variant === 'entry') return <div className="auth-frame auth-frame-entry">
    <main className="auth-main auth-main-entry">
      <div className="auth-entry-brand"><Brand /></div>
      <div className="auth-entry-content">{children}</div>
      <Text className="auth-footnote" size="xs" c="dimmed">บัญชีในหน้านี้ใช้สำหรับทดลองต้นแบบเท่านั้น</Text>
    </main>
    <aside className="auth-entry-cover" aria-hidden="true"><img src={loginArtwork} alt="" /></aside>
  </div>;
  return <div className="auth-frame">
    <aside className="auth-aside"><Brand /><div className="auth-aside-copy"><Text className="auth-aside-kicker">เรียนให้เป็นเรื่องของคุณ</Text><h1>ไอเดียที่ดี<br/>เริ่มจากการ<br/><span>เรียนรู้ต่อ</span></h1><Text className="auth-aside-description" size="sm">เลือกเส้นทางที่ใช่ เรียนทีละบท และกลับมาต่อได้ทุกเมื่อ</Text></div><Text className="auth-aside-foot">melearn · เรียนรู้ได้ในทุกจังหวะ</Text></aside>
    <main className="auth-main"><div className="auth-mobile-brand"><Brand /></div>{children}<Text className="auth-footnote" size="xs" c="dimmed">บัญชีในหน้านี้ใช้สำหรับทดลองต้นแบบเท่านั้น</Text></main>
  </div>;
}
