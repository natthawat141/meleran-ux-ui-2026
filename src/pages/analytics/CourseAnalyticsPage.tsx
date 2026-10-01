import React, { useState } from 'react';
import { Breadcrumb, Button, Card, Empty, Progress, Segmented, Space, Table, Tag, Typography } from 'antd';
import type { TableProps } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLms } from '../../store';
import { getCourseAnalytics } from '../../api/analytics';
import { PrePostComparisonPanel } from './PrePostComparisonPanel';
import { PageTitle } from '../../components/common';
import { UserAvatar } from '../../components/UserAvatar';
import type { CourseAssessmentRow, CourseLearnerRow } from '../../types';
import './analytics.css';

const { Text } = Typography;

export function CourseAnalyticsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { data, currentUser } = useLms();
  const navigate = useNavigate();
  const [tab, setTab] = useState<string>('overview');

  const isAdmin = currentUser?.role === 'admin';
  const analytics = getCourseAnalytics(data, courseId ?? '');

  if (!analytics || !analytics.course) {
    return <Empty description="ไม่พบคอร์สนี้" />;
  }

  const {
    course,
    enrolledCount,
    activeCount,
    completedCount,
    completionRate,
    pendingCount,
    avgScore,
    medianScore,
    assessmentRows,
    learnerRows,
  } = analytics;

  const resolvedCourseId = courseId ?? course.id;
  const basePath = isAdmin ? `/admin/analytics/courses/${resolvedCourseId}` : `/teach/courses/${resolvedCourseId}/analytics`;
  const backAnalyticsPath = isAdmin ? '/admin/analytics' : '/teach/analytics';

  const assessmentColumns: TableProps<CourseAssessmentRow>['columns'] = [
    {
      title: 'แบบฝึกหัด / ข้อสอบ',
      key: 'title',
      render: (_, row) => (
        <div>
          <strong>{row.title}</strong>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.stage === 'pre_test' ? 'ก่อนเรียน (Pre-test)' : row.stage === 'post_test' ? 'หลังเรียน (Post-test)' : 'แบบฝึกหัด'}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'ส่งแล้ว / ผู้มีสิทธิ์',
      key: 'submissions',
      render: (_, row) => `${row.submittedCount}/${row.eligibleCount}`,
    },
    {
      title: 'รอตรวจข้อเขียน',
      key: 'pending',
      render: (_, row) =>
        row.pendingCount > 0 ? (
          <Tag color="warning">{row.pendingCount} งาน</Tag>
        ) : (
          <Text type="secondary">0</Text>
        ),
    },
    {
      title: 'คะแนนเฉลี่ย',
      key: 'avgScore',
      render: (_, row) => (row.validN > 0 ? `${row.avgScore}%` : <Text type="secondary">—</Text>),
    },
    {
      title: 'มัธยฐาน',
      key: 'medScore',
      render: (_, row) => (row.validN > 0 ? `${row.medScore}%` : <Text type="secondary">—</Text>),
    },
    {
      title: 'อัตราผ่าน',
      key: 'passRate',
      render: (_, row) => (row.validN > 0 ? `${row.passRate}%` : <Text type="secondary">—</Text>),
    },
    {
      title: '',
      key: 'actions',
      render: (_, row) => (
        <Link to={`/teach/quizzes/${row.quizId}/attempts`}>
          <Button size="small">ดูคำตอบ</Button>
        </Link>
      ),
    },
  ];

  const learnerColumns: TableProps<CourseLearnerRow>['columns'] = [
    {
      title: 'ผู้เรียน',
      key: 'learner',
      render: (_, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <UserAvatar user={row.learner} />
          <div>
            <strong>{row.learner?.name || 'ผู้เรียน'}</strong>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {row.learner?.email}
              </Text>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'ความคืบหน้าคอร์ส',
      key: 'progress',
      render: (_, row) => (
        <div style={{ minWidth: 120 }}>
          <Progress percent={row.progressPercent} size="small" />
          <Text type="secondary" style={{ fontSize: 12 }}>
            ทำเสร็จ {row.completedItems}/{row.totalItems} รายการ
          </Text>
        </div>
      ),
    },
    {
      title: 'งานรอตรวจ',
      key: 'pendingReviews',
      render: (_, row) =>
        row.pendingReviews > 0 ? <Tag color="warning">{row.pendingReviews} งาน</Tag> : <Text type="secondary">0</Text>,
    },
    {
      title: 'คะแนนล่าสุด',
      key: 'latestScore',
      render: (_, row) =>
        row.latestScore !== null ? <strong>{row.latestScore}%</strong> : <Text type="secondary">—</Text>,
    },
    {
      title: 'กิจกรรมล่าสุด',
      key: 'lastActivity',
      render: (_, row) =>
        row.lastActivity ? (
          new Date(row.lastActivity).toLocaleDateString('th-TH')
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '',
      key: 'actions',
      render: (_, row) => (
        <Link to={`${basePath}/learners/${row.learnerId}`}>
          <Button type="primary" size="small" ghost>
            ดูรายละเอียด
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="analytics-container">
      <Breadcrumb
        items={[
          { title: <Link to={backAnalyticsPath}>วิเคราะห์การเรียนรู้</Link> },
          { title: course.title },
        ]}
      />

      <PageTitle
        eyebrow="วิเคราะห์ผลการเรียนรู้รายคอร์ส"
        title={course.title}
        subtitle={
          isAdmin
            ? `ผู้สอน: ${data.users?.find((u) => u.id === course.instructorId)?.name || 'ผู้สอน'} · ผู้เรียน ${enrolledCount} คน`
            : `ผู้เรียนที่ลงทะเบียน ${enrolledCount} คน · มีความเคลื่อนไหว ${activeCount} คน`
        }
        actions={
          <Space>
            <Link to={`/teach/courses/${course.id}`}>
              <Button>ไปยังหน้าคอร์ส</Button>
            </Link>
            {pendingCount > 0 && (
              <Link to={`/teach/reviews?course=${course.id}`}>
                <Button type="primary">ตรวจงานคอร์สนี้ ({pendingCount})</Button>
              </Link>
            )}
          </Space>
        }
      />

      <Segmented
        size="large"
        value={tab}
        onChange={(val) => setTab(String(val))}
        options={[
          { value: 'overview', label: 'ภาพรวมคอร์ส' },
          { value: 'assessments', label: 'คะแนนและแบบฝึกหัด' },
          { value: 'learners', label: `ผู้เรียน (${enrolledCount})` },
          { value: 'prepost', label: 'เปรียบเทียบ Pre/Post' },
        ]}
      />

      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="analytics-stats-grid">
            <div className="analytics-stat-card">
              <div className="analytics-stat-label">ผู้เรียนที่ลงทะเบียน</div>
              <div className="analytics-stat-value">{enrolledCount}</div>
              <div className="analytics-stat-sub">มีกิจกรรมจริง {activeCount} คน</div>
            </div>

            <div className="analytics-stat-card">
              <div className="analytics-stat-label">อัตราเรียนจบ (Completion)</div>
              <div className="analytics-stat-value">{completionRate}%</div>
              <div className="analytics-stat-sub">เรียนครบทุกบทเรียน {completedCount} คน</div>
            </div>

            <div
              className={`analytics-stat-card ${pendingCount > 0 ? 'is-clickable' : ''}`}
              onClick={() => pendingCount > 0 && navigate(`/teach/reviews?course=${course.id}`)}
            >
              <div className="analytics-stat-label">ข้อเขียนรอตรวจ</div>
              <div className="analytics-stat-value">{pendingCount}</div>
              <div className="analytics-stat-sub">
                {pendingCount > 0 ? 'กดเพื่อไปยังคิวตรวจ' : 'ไม่มีงานค้างตรวจ'}
              </div>
            </div>

            <div className="analytics-stat-card">
              <div className="analytics-stat-label">คะแนนเฉลี่ย / มัธยฐาน</div>
              <div className="analytics-stat-value">
                {avgScore}% <span style={{ fontSize: 16, color: '#64748b', fontWeight: 500 }}>/ {medianScore}%</span>
              </div>
              <div className="analytics-stat-sub">คำนวณจากข้อสอบที่ตรวจเสร็จแล้ว</div>
            </div>
          </div>

          <Card
            title="ภาพรวมแบบฝึกหัดในคอร์ส"
            extra={
              <Link to={`/teach/courses/${course.id}/quizzes`}>
                <Button size="small">จัดการแบบทดสอบ</Button>
              </Link>
            }
          >
            <Table
              rowKey="quizId"
              dataSource={assessmentRows}
              columns={assessmentColumns}
              pagination={false}
            />
          </Card>
        </div>
      )}

      {tab === 'assessments' && (
        <Card title="คะแนนและผลการประเมินแยกตามแบบฝึกหัด">
          <Table
            rowKey="quizId"
            dataSource={assessmentRows}
            columns={assessmentColumns}
            pagination={{ pageSize: 8 }}
          />
        </Card>
      )}

      {tab === 'learners' && (
        <Card title="รายชื่อและผลการเรียนของผู้เรียนในคอร์สนี้">
          <Table
            rowKey="learnerId"
            dataSource={learnerRows}
            columns={learnerColumns}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      )}

      {tab === 'prepost' && <PrePostComparisonPanel courseId={resolvedCourseId} />}
    </div>
  );
}
