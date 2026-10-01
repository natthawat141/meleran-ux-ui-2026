import React from 'react';
import { Alert as AntAlert, Modal as AntModal, message } from 'antd';
import { Avatar, Badge, Button, Progress, Stack, Text, Title } from '@mantine/core';
import { IconBook2, IconFileText, IconInbox, IconPlayerPlay, IconRocket, IconRosetteDiscountCheck } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { formatPrice, instructorFor } from '../data';
import { RichDocument } from './chapter/RichTextEditor';
import type { Course, LmsData, Role } from '../types';

export interface PageTitleProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
}

export function PageTitle({ title, subtitle, actions, eyebrow }: PageTitleProps) {
  return (
    <header className="page-title">
      <div>
        {eyebrow && <Text className="page-eyebrow">{eyebrow}</Text>}
        <Title order={1}>{title}</Title>
        {subtitle && <Text className="page-subtitle">{subtitle}</Text>}
      </div>
      {actions && <div className="page-title-actions">{actions}</div>}
    </header>
  );
}

export interface SectionHeadingProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export function SectionHeading({ title, description, action }: SectionHeadingProps) {
  return (
    <div className="section-heading">
      <div>
        <Title order={3}>{title}</Title>
        {description && <Text c="dimmed">{description}</Text>}
      </div>
      {action}
    </div>
  );
}

export interface CourseCardProps {
  course: Course;
  data: LmsData;
  href?: string;
  compact?: boolean;
}

export function CourseCard({ course, data, href, compact = false }: CourseCardProps) {
  const teacher = instructorFor(data, course);
  const chapterCount = course.chapters?.length ?? 0;
  const lessonCount = course.chapters?.reduce((sum, chapter) => sum + (chapter.items?.length ?? 0), 0) ?? 0;
  return (
    <article className={`course-card${compact ? ' course-card-compact' : ''}`}>
      <Link className="course-cover-link" to={href ?? `/courses/${course.slug}`} aria-label={`ดูคอร์ส ${course.title}`}>
        <div className="course-cover" style={{ backgroundImage: `url("${course.cover}")` }}>
          <Badge className="course-category" color="white" c="dark">
            {course.category}
          </Badge>
        </div>
      </Link>
      <div className="course-card-content">
        <div className="course-card-topline">
          <Badge className={course.price === 0 ? 'course-price-free' : 'course-price-paid'} color="gray" variant="light">
            {course.price === 0 ? 'เรียนฟรี' : formatPrice(course.price)}
          </Badge>
          <Text c="dimmed" size="sm">
            {course.level}
          </Text>
        </div>
        <Link to={href ?? `/courses/${course.slug}`} className="course-title-link">
          <Title order={3}>{course.title}</Title>
        </Link>
        <Text c="dimmed" className="course-summary" lineClamp={2}>
          {course.subtitle}
        </Text>
        <div className="course-card-meta">
          <Avatar size={27} color="gray" radius="xl">
            {teacher?.name?.slice(0, 1) ?? 'ผ'}
          </Avatar>
          <Text size="sm">{teacher?.name ?? 'ผู้สอน'}</Text>
          <span className="meta-spacer" />
          <Text c="dimmed" size="xs">
            {chapterCount} บท · {lessonCount} รายการ
          </Text>
        </div>
      </div>
    </article>
  );
}

export interface ContentTypeIconProps {
  type: string;
  className?: string;
}

export function ContentTypeIcon({ type, className = '' }: ContentTypeIconProps) {
  const icons: Record<string, React.ReactNode> = {
    video: <IconPlayerPlay size={16} />,
    article: <IconFileText size={16} />,
    quiz: <IconRosetteDiscountCheck size={16} />,
  };
  return <span className={`content-type-icon ${type} ${className}`}>{icons[type] ?? <IconBook2 size={16} />}</span>;
}

export interface StatusTagProps {
  status: string;
}

export function StatusTag({ status }: StatusTagProps) {
  const values: Record<string, [string, string]> = {
    published: ['cobalt', 'เผยแพร่แล้ว'],
    draft: ['gray', 'ฉบับร่าง'],
    pending: ['gray', 'รอตรวจ'],
    paid: ['cobalt', 'ชำระแล้ว'],
    failed: ['red', 'ไม่สำเร็จ'],
    approved: ['cobalt', 'อนุมัติแล้ว'],
    rejected: ['red', 'ส่งกลับ'],
    graded: ['cobalt', 'ตรวจแล้ว'],
  };
  const [color, label] = values[status] ?? ['gray', status ?? '—'];
  return (
    <Badge color={color} variant="light" className="status-tag">
      {label}
    </Badge>
  );
}

export interface EmptyStateProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Stack align="center" gap="xs">
        <IconInbox size={34} stroke={1.4} color="var(--ink-tertiary)" />
        <Text fw={600}>{title}</Text>
        {description && (
          <Text c="dimmed" ta="center">
            {description}
          </Text>
        )}
        {action}
      </Stack>
    </div>
  );
}

export interface CourseProgressProps {
  course: Course;
  data: LmsData;
  userId?: string;
}

export function CourseProgress({ course, data, userId }: CourseProgressProps) {
  const items = course.chapters?.flatMap((chapter) => chapter.items ?? []) ?? [];
  const done = items.filter((item) =>
    item.type === 'quiz'
      ? data.attempts.some(
          (attempt) => attempt.quizId === item.quizId && attempt.userId === userId && attempt.passed === true
        )
      : userId
        ? Boolean(data.progress[`${course.id}:${item.id}`]?.[userId])
        : false
  ).length;
  const percent = items.length ? Math.round((done / items.length) * 100) : 0;
  return (
    <div className="progress-copy">
      <Progress value={percent} color="cobalt" size="sm" />
      <Text c="dimmed" size="sm">
        {done} จาก {items.length} รายการ
      </Text>
    </div>
  );
}

export interface ConfirmDeleteOptions {
  title: React.ReactNode;
  content?: React.ReactNode;
  onConfirm?: () => void;
}

export function confirmDelete({ title, content, onConfirm }: ConfirmDeleteOptions) {
  AntModal.confirm({
    title,
    content,
    okText: 'ลบรายการ',
    cancelText: 'ยกเลิก',
    okButtonProps: { danger: true },
    onOk: onConfirm,
  });
}

export function showSaved(text = 'บันทึกแล้ว') {
  message.success(text);
}
export function showError(text: string) {
  message.error(text);
}

export function RolePill({ role }: { role: Role | string }) {
  const label: Record<string, string> = { learner: 'ผู้เรียน', instructor: 'ผู้สอน', admin: 'แอดมิน' };
  return (
    <Badge color="cobalt" variant="light" className="role-pill">
      {label[role] ?? role}
    </Badge>
  );
}

export function DemoNote({ children }: { children: React.ReactNode }) {
  return <AntAlert className="demo-note" type="info" showIcon message={children} />;
}

export function LearningEmptyAction({
  to = '/courses',
  children = 'เลือกคอร์สที่สนใจ',
}: {
  to?: string;
  children?: React.ReactNode;
}) {
  return (
    <Button component={Link} to={to} color="cobalt" leftSection={<IconRocket size={16} />}>
      {children}
    </Button>
  );
}

export function StoryParagraphs({ text, document }: { text?: string; document?: unknown }) {
  if (document) return <RichDocument document={document} text={text} />;
  return (
    <div className="story-prose">
      {String(text ?? '')
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((line, index) => (
          <p key={index}>{line}</p>
        ))}
    </div>
  );
}

export interface StatLineProps {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
}

export function StatLine({ label, value, icon }: StatLineProps) {
  return (
    <div className="stat-line">
      {icon && <span className="stat-icon">{icon}</span>}
      <div>
        <Text c="dimmed">{label}</Text>
        <div className="stat-value">{value}</div>
      </div>
    </div>
  );
}

export const appBrand = {
  name: 'melearn',
  tagline: 'พื้นที่เรียนรู้ที่ไปต่อได้จริง',
  icon: <IconBook2 size={18} />,
};
