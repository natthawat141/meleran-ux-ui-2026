import React, { useState } from 'react';
import { ActionIcon, AppShell, Burger, Button, Group, Indicator, Menu, NavLink, ScrollArea, Select, Stack, Text, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconAdjustments,
  IconArticle,
  IconBell,
  IconBook2,
  IconCertificate,
  IconChevronDown,
  IconCircleFilled,
  IconCirclePlus,
  IconClipboardCheck,
  IconLayoutDashboard,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLogout,
  IconReceipt,
  IconSchool,
  IconSparkles,
  IconSettings,
  IconShoppingBag,
  IconUsers,
} from '@tabler/icons-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/melearn-ui/logo.PNG';
import { UserAvatar } from './UserAvatar';
import { LandingHeader, LandingFooter } from './LandingChrome';
import type { Role } from '@melearn/contracts';
import '../styles/workspace-shell.css';
import '../styles/workspace-notifications.css';

interface MenuItem {
  key: string;
  icon: React.ReactNode;
  label: string;
}

const roleMenus: Record<Role, MenuItem[]> = {
  learner: [
    { key: '/learn', icon: <IconLayoutDashboard />, label: 'ภาพรวมการเรียน' },
    { key: '/learn/courses', icon: <IconBook2 />, label: 'คอร์สของฉัน' },
    { key: '/learn/redeem', icon: <IconReceipt />, label: 'แลกรหัสคอร์ส' },
    { key: '/learn/ai', icon: <IconSparkles />, label: 'Melearn AI' },
    { key: '/courses', icon: <IconShoppingBag />, label: 'สำรวจคอร์ส' },
    { key: '/account/certificates', icon: <IconCertificate />, label: 'ใบรับรอง' },
    { key: '/account/profile', icon: <IconSettings />, label: 'บัญชีของฉัน' },
  ],
  instructor: [
    { key: '/teach', icon: <IconLayoutDashboard />, label: 'ภาพรวมผู้สอน' },
    { key: '/teach/courses', icon: <IconBook2 />, label: 'คอร์สของฉัน' },
    { key: '/teach/courses/new', icon: <IconCirclePlus />, label: 'สร้างคอร์ส' },
    { key: '/teach/reviews', icon: <IconClipboardCheck />, label: 'คิวตรวจคำตอบ' },
    { key: '/teach/quizzes', icon: <IconArticle />, label: 'แบบทดสอบ' },
    { key: '/teach/learners', icon: <IconUsers />, label: 'ผู้เรียน' },
    { key: '/courses', icon: <IconShoppingBag />, label: 'สำรวจคอร์ส' },
    { key: '/learn/ai', icon: <IconSparkles />, label: 'Melearn AI' },
    { key: '/account/profile', icon: <IconSettings />, label: 'บัญชีของฉัน' },
  ],
  admin: [
    { key: '/admin', icon: <IconLayoutDashboard />, label: 'ภาพรวมระบบ' },
    { key: '/admin/articles', icon: <IconArticle />, label: 'บทความ' },
    { key: '/admin/instructors', icon: <IconSchool />, label: 'ผู้สอน' },
    { key: '/admin/courses', icon: <IconBook2 />, label: 'คอร์สทั้งหมด' },
    { key: '/admin/courses/reviews', icon: <IconClipboardCheck />, label: 'คิวตรวจคอร์ส' },
    { key: '/admin/users', icon: <IconUsers />, label: 'ผู้ใช้งาน' },
    { key: '/admin/access-codes', icon: <IconReceipt />, label: 'รหัสแลกคอร์ส' },
    { key: '/admin/payments', icon: <IconReceipt />, label: 'ตรวจสอบ Payment' },
    { key: '/admin/ai', icon: <IconSparkles />, label: 'Melearn AI และ Transcript' },
    { key: '/courses', icon: <IconShoppingBag />, label: 'สำรวจคอร์ส' },
  ],
};

const roleMeta: Record<Role, { label: string; title: string; home: string }> = {
  learner: { label: 'ผู้เรียน', title: 'พื้นที่เรียนรู้', home: '/learn' },
  instructor: { label: 'ผู้สอน', title: 'สตูดิโอผู้สอน', home: '/teach' },
  admin: { label: 'แอดมิน', title: 'จัดการระบบ', home: '/admin' },
};

function activeMenuKey(path: string, items: MenuItem[]): string {
  const exact = items.find((item) => path === item.key);
  if (exact) return exact.key;
  return [...items].sort((a, b) => b.key.length - a.key.length).find((item) => path.startsWith(`${item.key}/`))?.key ?? items[0].key;
}

export function Brand() {
  return (
    <Link to="/" className="brand-lockup" aria-label="melearn หน้าแรก">
      <span className="brand-logo-crop">
        <img src={logo} alt="" width="1920" height="1080" />
      </span>
    </Link>
  );
}

export function PublicShell({ children, currentUser }: { children: React.ReactNode; currentUser?: { role?: Role | string; [k: string]: any } | null }) {
  return (
    <div className="public-shell">
      <LandingHeader currentUser={currentUser} />
      <main className="public-main" id="public-main">
        {children}
      </main>
      <LandingFooter />
    </div>
  );
}

export interface ShellNotificationItem {
  id: string;
  title: string;
  description: string;
  createdAt?: string;
  readAt?: string | null;
  target?: string;
}

export function WorkspaceNotifications({
  notifications = [],
  onNotificationClick,
}: {
  notifications?: ShellNotificationItem[];
  onNotificationClick?: (id: string, target?: string) => void;
}) {
  const navigate = useNavigate();
  const unreadCount = notifications.filter((entry) => !entry.readAt).length;

  return (
    <Menu position="bottom-end" withinPortal shadow="md" width={340}>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size={42}
          aria-label={`แจ้งเตือน${unreadCount ? ` มี ${unreadCount} รายการที่ยังไม่อ่าน` : ''}`}
        >
          <Indicator disabled={!unreadCount} label={unreadCount > 99 ? '99+' : unreadCount} size={17} color="cobalt" offset={2}>
            <IconBell size={21} aria-hidden="true" />
          </Indicator>
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown className="workspace-notifications">
        <Menu.Label>แจ้งเตือน{unreadCount ? ` · ยังไม่อ่าน ${unreadCount}` : ''}</Menu.Label>
        {notifications.length ? (
          <ScrollArea.Autosize mah={380}>
            {notifications.map((entry) => (
              <Menu.Item
                key={entry.id}
                className="workspace-notification-item"
                onClick={() => {
                  if (onNotificationClick) onNotificationClick(entry.id, entry.target);
                  else if (entry.target) navigate(entry.target);
                }}
                leftSection={
                  !entry.readAt ? (
                    <IconCircleFilled size={7} color="var(--primary)" aria-hidden="true" />
                  ) : (
                    <span className="notification-read-spacer" />
                  )
                }
              >
                <strong>{entry.title}</strong>
                <span>{entry.description}</span>
                <small>{entry.createdAt ? new Date(entry.createdAt).toLocaleString('th-TH') : ''}</small>
              </Menu.Item>
            ))}
          </ScrollArea.Autosize>
        ) : (
          <Text className="notification-empty" size="sm" c="dimmed">
            ยังไม่มีการแจ้งเตือน
          </Text>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

export type ShellIdentity = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  emailVerified?: boolean;
  roles?: Role[];
};

export function WorkspaceShell({
  children,
  availableRoles,
  identity,
  onLogout,
  notifications = [],
}: {
  children: React.ReactNode;
  availableRoles?: Role[];
  identity?: ShellIdentity | null;
  onLogout?: () => void | Promise<void>;
  notifications?: ShellNotificationItem[];
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [opened, setOpened] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 62em)', false);
  const compact = desktopCollapsed && isDesktop;

  const defaultIdentity: ShellIdentity = {
    id: 'user',
    name: 'ผู้ใช้งาน',
    email: '',
    role: 'learner',
    roles: ['learner'],
  };
  const currentUser = identity ?? defaultIdentity;
  const roleOptions = availableRoles ?? identity?.roles ?? ['learner', 'instructor', 'admin'];
  const role: Role = identity && location.pathname.startsWith('/teach') && identity.roles?.includes('instructor')
    ? 'instructor'
    : (currentUser.role as Role) ?? 'learner';
  const meta = roleMeta[role] ?? roleMeta.learner;
  const items = roleMenus[role] ?? roleMenus.learner;
  const selected =
    role === 'admin' && location.pathname.startsWith('/teach/')
      ? '/admin/courses'
      : role === 'instructor' && location.pathname.startsWith('/teach/attempts/')
        ? (new URLSearchParams(location.search).get('returnTo')?.startsWith('/teach/reviews')
            ? '/teach/reviews'
            : '/teach/quizzes')
        : activeMenuKey(location.pathname, items);

  const toWorkspace = (nextRole: Role) => {
    if (!roleOptions.includes(nextRole)) return;
    navigate(roleMeta[nextRole].home);
  };

  const navLinks = items.map((item) => {
    return (
      <Tooltip
        key={item.key}
        label={item.label}
        position="right"
        disabled={!compact}
        openDelay={200}
        events={{ hover: true, focus: true, touch: false }}
      >
        <NavLink
          component={Link}
          to={item.key}
          aria-label={item.label}
          aria-current={selected === item.key ? 'page' : undefined}
          label={compact ? null : item.label}
          leftSection={item.icon}
          active={selected === item.key}
          onClick={() => setOpened(false)}
        />
      </Tooltip>
    );
  });

  return (
    <AppShell
      className="workspace-shell"
      data-sidebar-collapsed={compact || undefined}
      header={{ height: 72 }}
      navbar={{
        width: { base: 258, md: desktopCollapsed ? 72 : 258 },
        breakpoint: 'md',
        collapsed: { mobile: !opened, desktop: false },
      }}
      padding="xl"
    >
      <AppShell.Header className="workspace-header">
        <Group h="100%" px="lg" justify="space-between" wrap="nowrap">
          <Group gap="md" wrap="nowrap">
            <Burger
              opened={opened}
              onClick={() => setOpened((value) => !value)}
              hiddenFrom="md"
              size="sm"
              aria-label={opened ? 'ปิดเมนู' : 'เปิดเมนู'}
              aria-expanded={opened}
              aria-controls="workspace-sidebar"
            />
            {compact ? (
              <Tooltip label="แสดงเมนูด้านข้าง" openDelay={200} events={{ hover: true, focus: true, touch: false }}>
                <ActionIcon
                  className="workspace-rail-logo-button"
                  variant="subtle"
                  color="gray"
                  size={48}
                  onClick={() => setDesktopCollapsed(false)}
                  aria-label="แสดงเมนูด้านข้าง"
                  aria-expanded={false}
                  aria-controls="workspace-sidebar"
                >
                  <span className="workspace-rail-logo" aria-hidden="true">
                    <img src={logo} alt="" width="1920" height="1080" />
                  </span>
                  <IconLayoutSidebarLeftExpand className="workspace-rail-expand" size={24} aria-hidden="true" />
                </ActionIcon>
              </Tooltip>
            ) : (
              <Brand />
            )}
            <span className="header-divider" />
            <Text className="workspace-context" size="sm">
              {meta.title}
            </Text>
          </Group>
          <Group gap="md" wrap="nowrap" className="workspace-header-actions">
            {roleOptions.length > 1 && (
              <Select
                aria-label="ดูตัวอย่างในบทบาท"
                className="role-switch"
                value={role}
                onChange={(value) => value && toWorkspace(value as Role)}
                data={roleOptions.map((availableRole) => ({
                  value: availableRole,
                  label: roleMeta[availableRole].label,
                }))}
                leftSection={<IconAdjustments size={16} />}
                rightSection={<IconChevronDown size={14} />}
                allowDeselect={false}
                searchable={false}
              />
            )}
            <WorkspaceNotifications notifications={notifications} />
            <Menu position="bottom-end" shadow="md" width={210} withinPortal>
              <Menu.Target>
                <Button
                  variant="subtle"
                  color="dark"
                  className="profile-trigger"
                  leftSection={<UserAvatar user={currentUser} size={32} />}
                  rightSection={<IconChevronDown size={14} />}
                >
                  {currentUser?.name ?? 'ผู้ใช้งาน'}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>บัญชีผู้ใช้</Menu.Label>
                <Menu.Item component={Link} to="/account/profile" leftSection={<IconSettings size={16} />}>
                  บัญชีของฉัน
                </Menu.Item>
                {roleOptions.length > 1 && (
                  <div className="profile-mobile-roles">
                    <Menu.Divider />
                    <Menu.Label>ดูตัวอย่างในบทบาท</Menu.Label>
                    {roleOptions.map((key) => (
                      <Menu.Item key={key} onClick={() => toWorkspace(key as Role)}>
                        {roleMeta[key].label}
                      </Menu.Item>
                    ))}
                  </div>
                )}
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconLogout size={16} />}
                  onClick={() => {
                    if (onLogout) void onLogout();
                    navigate('/');
                  }}
                >
                  ออกจากระบบ
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar id="workspace-sidebar" className="workspace-navbar" p={compact ? 8 : 'md'}>
        {!compact && (
          <div className="workspace-nav-heading">
            <Text size="xs" fw={700} tt="uppercase" c="dimmed" lts={1.2}>
              เมนูหลัก
            </Text>
            <Group gap={8} wrap="nowrap">
              <Text size="xs" c="dimmed">
                {meta.label}
              </Text>
              <Tooltip label="พับเมนูด้านข้าง" events={{ hover: true, focus: true, touch: false }}>
                <ActionIcon
                  className="workspace-sidebar-collapse"
                  visibleFrom="md"
                  variant="subtle"
                  color="gray"
                  size={28}
                  onClick={() => setDesktopCollapsed(true)}
                  aria-label="พับเมนูด้านข้าง"
                  aria-expanded={true}
                  aria-controls="workspace-sidebar"
                >
                  <IconLayoutSidebarLeftCollapse size={18} aria-hidden="true" />
                </ActionIcon>
              </Tooltip>
            </Group>
          </div>
        )}
        <Stack gap={5} className="workspace-nav-links">
          {navLinks}
        </Stack>
        {role !== 'admin' && (
          <div className="workspace-nav-bottom">
            {compact ? (
              <Tooltip label="กลับไปหน้าคอร์ส" position="right" events={{ hover: true, focus: true, touch: false }}>
                <ActionIcon
                  component={Link}
                  to="/courses"
                  aria-label="กลับไปหน้าคอร์ส"
                  variant="light"
                  color="gray"
                  size={44}
                >
                  <IconShoppingBag size={20} />
                </ActionIcon>
              </Tooltip>
            ) : (
              <>
                <Button
                  component={Link}
                  to="/courses"
                  variant="light"
                  color="gray"
                  leftSection={<IconShoppingBag size={17} />}
                  fullWidth
                >
                  กลับไปหน้าคอร์ส
                </Button>
                <Text size="xs" c="dimmed">
                  melearn
                </Text>
              </>
            )}
          </div>
        )}
      </AppShell.Navbar>
      <AppShell.Main className="workspace-content">
        <div className="workspace-content-inner">{children}</div>
      </AppShell.Main>
    </AppShell>
  );
}
