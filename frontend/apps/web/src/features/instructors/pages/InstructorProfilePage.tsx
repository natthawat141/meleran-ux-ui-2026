import React from 'react';
import { Avatar, Col, Row, Tag, Typography } from 'antd';
import { useParams } from 'react-router-dom';
import { useSuspenseQuery } from '@tanstack/react-query';
import { resource, resourceList } from '../../../shared/api/resources';
import type { PublicInstructorDto, CourseDetail, Course } from '@melearn/contracts';
import { CourseCard, PageTitle, SectionHeading } from '@melearn/ui';

const { Title, Paragraph } = Typography;

export function InstructorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data: result } = useSuspenseQuery({
    queryKey: ['public-instructor', id],
    queryFn: async ({ signal }) => ({
      profile: await resource<PublicInstructorDto>(
        'instructors/' + encodeURIComponent(id!),
        'GET',
        undefined,
        signal,
      ),
      courses: await resourceList<CourseDetail>(
        'instructors/' + encodeURIComponent(id!) + '/courses',
        signal,
      ),
    }),
  });
  const data = {
    users: [
      {
        id: result.profile.id,
        name: result.profile.display_name,
        email: '',
        role: 'instructor' as const,
        bio: result.profile.bio ?? '',
        avatar: result.profile.avatar_url ?? undefined,
      },
    ],
    courses: result.courses
      .filter((c) => c.instructor.id === id)
      .map((c): Course => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        subtitle: c.subtitle ?? undefined,
        cover: c.cover_url ?? '',
        category: c.category,
        level: c.level,
        price: (c.price?.amount_minor ?? 0) / 100,
        instructorId: c.instructor.id,
        status: 'published',
        chapters: c.outline.map((ch) => ({
          id: ch.id,
          title: ch.title,
          items: ch.items.map((i) =>
            i.type === 'quiz'
              ? { ...i, type: 'quiz', quizId: i.id }
              : i.type === 'video'
                ? { ...i, type: 'video' }
                : { ...i, type: 'article' },
          ),
        })),
      })),
  };
  const teacher = data.users.find((user) => user.id === id);

  if (!teacher) {
    return (
      <div className="public-page">
        <PageTitle title="ไม่พบโปรไฟล์ผู้สอน" />
      </div>
    );
  }

  const courses = data.courses.filter(
    (course) => course.instructorId === id && course.status === 'published',
  );

  return (
    <div className="public-page instructor-profile">
      <section className="instructor-profile-head">
        <Avatar size={88}>{teacher.name.slice(0, 1)}</Avatar>
        <div>
          <Tag>ผู้สอน</Tag>
          <Title>{teacher.name}</Title>
          <Paragraph>{teacher.bio || 'ผู้สอนที่ร่วมแบ่งปันความรู้และประสบการณ์'}</Paragraph>
        </div>
      </section>
      <SectionHeading title="คอร์สที่สอน" description={`${courses.length} คอร์ส`} />
      <Row gutter={[22, 22]}>
        {courses.map((course) => (
          <Col xs={24} sm={12} lg={8} key={course.id}>
            <CourseCard course={course} data={data} />
          </Col>
        ))}
      </Row>
    </div>
  );
}
