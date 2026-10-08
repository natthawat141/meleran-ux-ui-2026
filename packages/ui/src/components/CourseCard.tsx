import React from 'react';
import { Avatar, Badge, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { Course, User } from '@melearn/contracts';
import { formatPrice, instructorFor } from '../lib/formatters.ts';

export interface CourseCardProps {
  course: Course;
  data: { users: User[] };
  href?: string;
  compact?: boolean;
  action?: React.ReactNode;
}

export function CourseCard({ course, data, href, compact = false, action }: CourseCardProps) {
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
        {action && <div className="course-card-actions">{action}</div>}
      </div>
    </article>
  );
}
