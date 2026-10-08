import React from 'react';
import { Avatar, Col, Row, Tag, Typography } from 'antd';
import { useParams } from 'react-router-dom';
import { useLms } from '@legacy/store';
import { CourseCard, PageTitle, SectionHeading } from '@melearn/ui';

const { Title, Paragraph } = Typography;

export function InstructorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useLms();
  const teacher = data.users.find((user) => user.id === id);

  if (!teacher) {
    return (
      <div className="public-page">
        <PageTitle title="ไม่พบโปรไฟล์ผู้สอน" />
      </div>
    );
  }

  const courses = data.courses.filter(
    (course) => course.instructorId === id && course.status === 'published'
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
