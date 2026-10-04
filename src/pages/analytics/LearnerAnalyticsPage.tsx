import React from 'react';
import { Breadcrumb, Button, Card, Empty, Progress, Table, Tag, Timeline, Typography } from 'antd';
import type { TableProps } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useLms } from '../../store';
import { getLearnerCourseAnalytics } from '../../api/analytics';
import { UserAvatar } from '../../components/UserAvatar';
import type { LearnerAssessmentItem } from '../../types';
import './analytics.css';

const { Title, Text } = Typography;

export function LearnerAnalyticsPage() {
  const { courseId, learnerId } = useParams<{ courseId: string; learnerId: string }>();
  const location = useLocation();
  const { data, currentUser } = useLms();

  const isAdmin = currentUser?.role === 'admin';
  const analytics = getLearnerCourseAnalytics(data, courseId ?? '', learnerId ?? '');

  if (!analytics) {
    return <Empty description="ไม่พบข้อมูลผู้เรียนหรือคอร์สนี้" />;
  }

  const {
    course,
    learner,
    enrollment,
    progressPercent,
    completedItems,
    totalItems,
    pendingCount,
    timeline,
    assessmentHistory,
  } = analytics;

  const courseAnalyticsPath = isAdmin
    ? `/admin/analytics/courses/${courseId}`
    : `/teach/courses/${courseId}/analytics`;

  const columns: TableProps<LearnerAssessmentItem>['columns'] = [
    {
      title: 'แบบฝึกหัด / ข้อสอบ',
      key: 'title',
      render: (_, row) => (
        <div>
          <strong>{row.title}</strong>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.stage === 'pre_test' ? 'Pre-test (ก่อนเรียน)' : row.stage === 'post_test' ? 'Post-test (หลังเรียน)' : 'แบบฝึกหัด'}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'คะแนนที่ได้',
      key: 'score',
      render: (_, row) => {
        if (row.essayStatus === 'pending') {
          return <Tag color="warning">รอตรวจข้อเขียน</Tag>;
        }
        return <span>{row.score}/{row.maxScore}</span>;
      },
    },
    {
      title: 'คิดเป็น %',
      key: 'percent',
      render: (_, row) => {
        if (row.essayStatus === 'pending') return <Text type="secondary">—</Text>;
        return <strong>{row.percent}%</strong>;
      },
    },
    {
      title: 'ผลการประเมิน',
      key: 'passed',
      render: (_, row) => {
        if (row.essayStatus === 'pending') return <Tag color="warning">รอตรวจ</Tag>;
        return row.passed ? <Tag color="success">ผ่าน</Tag> : <Tag color="error">ยังไม่ผ่าน</Tag>;
      },
    },
    {
      title: 'วันที่ส่ง',
      key: 'submittedAt',
      render: (date: string | undefined) => {
        if (!date) return '—';
        const d = new Date(date);
        return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('th-TH');
      },
    },
    {
      title: '',
      key: 'actions',
      render: (_, row) =>
        row.essayStatus === 'pending' ? (
          <Link to={`/teach/attempts/${row.attemptId}/grade?returnTo=${encodeURIComponent(location.pathname)}`}>
            <Button type="primary" size="small">
              ตรวจข้อเขียน
            </Button>
          </Link>
        ) : (
          <Link to={`/learn/attempts/${row.attemptId}/result`}>
            <Button size="small">ดูคำตอบ</Button>
          </Link>
        ),
    },
  ];

  return (
    <div className="analytics-container">
      <Breadcrumb
        items={[
          { title: <Link to={isAdmin ? '/admin/analytics' : '/teach/analytics'}>วิเคราะห์การเรียนรู้</Link> },
          { title: <Link to={courseAnalyticsPath}>{course.title}</Link> },
          { title: learner.name },
        ]}
      />

      <div className="learner-profile-header">
        <div className="learner-profile-info">
          <UserAvatar user={learner} size={54} />
          <div>
            <Title level={3} style={{ margin: 0 }}>
              {learner.name}
            </Title>
            <Text type="secondary">{learner.email}</Text>
            <div style={{ marginTop: 4 }}>
              <Tag color="blue">คอร์ส: {course.title}</Tag>
              {enrollment && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  ลงทะเบียนเมื่อ {new Date(enrollment.createdAt).toLocaleDateString('th-TH')}
                </Text>
              )}
            </div>
          </div>
        </div>

        <Link to={courseAnalyticsPath}>
          <Button icon={<ArrowLeftOutlined />}>กลับหน้ารายคอร์ส</Button>
        </Link>
      </div>

      <div className="analytics-stats-grid">
        <div className="analytics-stat-card">
          <div className="analytics-stat-label">ความคืบหน้าในคอร์ส</div>
          <div className="analytics-stat-value">{progressPercent}%</div>
          <Progress percent={progressPercent} size="small" showInfo={false} style={{ marginTop: 8 }} />
          <div className="analytics-stat-sub">เรียนสำเร็จ {completedItems} จาก {totalItems} รายการ</div>
        </div>

        <div className="analytics-stat-card">
          <div className="analytics-stat-label">งานที่ส่งแล้ว</div>
          <div className="analytics-stat-value">{assessmentHistory.length}</div>
          <div className="analytics-stat-sub">แบบฝึกหัดและข้อสอบ</div>
        </div>

        <div className="analytics-stat-card">
          <div className="analytics-stat-label">งานรอตรวจ</div>
          <div className="analytics-stat-value">{pendingCount}</div>
          <div className="analytics-stat-sub">คำตอบข้อเขียนที่ต้องให้คะแนน</div>
        </div>
      </div>

      <Card title="ประวัติการส่งงานและคะแนนประเมิน">
        <Table
          rowKey="attemptId"
          dataSource={assessmentHistory}
          columns={columns}
          pagination={false}
          locale={{ emptyText: 'ยังไม่มีประวัติการทำแบบทดสอบในคอร์สนี้' }}
        />
      </Card>

      <div className="timeline-card">
        <Title level={4}>ลำดับกิจกรรมการเรียนรู้ (Timeline)</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
          แสดงบันทึกเวลาจริงจากกิจกรรมที่เกิดขึ้นในระบบ
        </Text>

        <Timeline
          items={timeline.map((event) => ({
            color: event.type === 'graded' ? 'green' : event.type === 'submitted' ? 'blue' : 'gray',
            children: (
              <div>
                <strong>{event.title}</strong>
                <div style={{ fontSize: 13, color: '#475569' }}>{event.desc}</div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {new Date(event.date).toLocaleString('th-TH')}
                </Text>
              </div>
            ),
          }))}
        />
      </div>
    </div>
  );
}
