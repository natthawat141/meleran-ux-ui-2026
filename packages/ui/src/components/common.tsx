import React from 'react';
import { Alert as AntAlert, Modal as AntModal, message } from 'antd';
import { Badge, Button, Progress, Stack, Text, Title } from '@mantine/core';
import { IconBook2, IconFileText, IconInbox, IconPlayerPlay, IconRocket, IconRosetteDiscountCheck } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import type { Course, Role, QuizAttempt } from '@melearn/contracts';
import { RichDocument } from '../RichDocument.tsx';

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
  data?: any;
  attempts?: QuizAttempt[];
  userId?: string;
  progressMap?: Record<string, Record<string, boolean>>;
}

export function CourseProgress({ course, data, attempts = [], userId, progressMap = {} }: CourseProgressProps) {
  const actualAttempts = attempts.length ? attempts : (data?.attempts ?? []);
  const actualProgressMap = Object.keys(progressMap).length ? progressMap : (data?.progress ?? {});
  const items = course.chapters?.flatMap((chapter) => chapter.items ?? []) ?? [];
  const done = items.filter((item) =>
    item.type === 'quiz'
      ? actualAttempts.some(
          (attempt: any) => attempt.quizId === item.quizId && attempt.userId === userId && attempt.passed === true
        )
      : userId
        ? Boolean(actualProgressMap[`${course.id}:${item.id}`]?.[userId])
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
