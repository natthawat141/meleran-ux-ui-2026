import React, { useState } from 'react';
import { Button, Card, Empty, Select, Space, Table, Tag, Typography } from 'antd';
import type { TableProps } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useLms } from '../store';
import { getInstructorAnalytics } from '../api/analytics';
import { PageTitle } from '../components/common';
import type { AnalyticsCourseRow } from '../types';
import './analytics/analytics.css';

const { Text } = Typography;

export function AnalyticsPage() {
  const { data, currentUser } = useLms();
  const navigate = useNavigate();
  const role = currentUser?.role || 'instructor';
  const isAdmin = role === 'admin';

  const [instructorFilter, setInstructorFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');

  const targetInstructorId = isAdmin
    ? instructorFilter !== 'all'
      ? instructorFilter
      : undefined
    : currentUser?.id;

  const analytics = getInstructorAnalytics(data, targetInstructorId, role);
  const {
    totalEnrolled,
    totalCompleted,
    totalSubmissions,
    totalPendingReview,
    oldestPending,
    courseRows,
  } = analytics;

  const instructors = (data.users || []).filter((u) => u.role === 'instructor');

  const filteredCourseRows = courseRows.filter((row) => {
    if (courseFilter !== 'all' && row.courseId !== courseFilter) return false;
    return true;
  });

  const columns: TableProps<AnalyticsCourseRow>['columns'] = [
    {
      title: 'คอร์ส',
      key: 'course',
      render: (_, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {row.cover ? (
            <img
              src={row.cover}
              alt=""
              style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 6 }}
            />
          ) : null}
          <div>
            <strong style={{ fontSize: 14 }}>{row.title}</strong>
            {isAdmin && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  ผู้สอน: {row.instructorName}
                </Text>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'ผู้เรียนลงทะเบียน',
      dataIndex: 'enrolledCount',
      key: 'enrolledCount',
      render: (val: number) => `${val} คน`,
    },
    {
      title: 'อัตราเรียนจบ',
      key: 'completionRate',
      render: (_, row) => `${row.completionRate}% (${row.completedCount} คน)`,
    },
    {
      title: 'ส่งงานทั้งหมด',
      dataIndex: 'submissionsCount',
      key: 'submissionsCount',
      render: (val: number) => `${val} ครั้ง`,
    },
    {
      title: 'ข้อเขียนรอตรวจ',
      key: 'pendingCount',
      render: (_, row) =>
        row.pendingCount > 0 ? (
          <Link to={`/teach/reviews?course=${row.courseId}`}>
            <Tag color="warning" style={{ fontWeight: 600, cursor: 'pointer' }}>
              {row.pendingCount} งาน
            </Tag>
          </Link>
        ) : (
          <Text type="secondary">0</Text>
        ),
    },
    {
      title: 'อัตราสอบผ่าน',
      dataIndex: 'passRate',
      key: 'passRate',
      render: (val: number) => `${val}%`,
    },
    {
      title: '',
      key: 'actions',
      render: (_, row) => {
        const targetPath = isAdmin
          ? `/admin/analytics/courses/${row.courseId}`
          : `/teach/courses/${row.courseId}/analytics`;
        return (
          <Link to={targetPath}>
            <Button type="primary" ghost size="small">
              ดูผลคอร์ส
            </Button>
          </Link>
        );
      },
    },
  ];

  return (
    <div className="analytics-container">
      <PageTitle
        eyebrow={isAdmin ? 'ผู้ดูแลระบบ' : 'สตูดิโอผู้สอน'}
        title="วิเคราะห์การเรียนรู้ (Analytics)"
        subtitle={
          isAdmin
            ? 'ภาพรวมกิจกรรม อัตราสำเร็จ และผลการประเมินของผู้เรียนทุกคอร์สในระบบ'
            : 'ติดตามผลการเรียน คิวตรวจข้อเขียน และความคืบหน้าของผู้เรียนในคอร์สของคุณ'
        }
        actions={
          <Space>
            {totalPendingReview > 0 && (
              <Link to="/teach/reviews">
                <Button type="primary">
                  ไปที่คิวตรวจงาน ({totalPendingReview})
                </Button>
              </Link>
            )}
            <Link to={isAdmin ? '/admin/assignments' : '/teach/assignments'}>
              <Button>จัดการงานมอบหมาย</Button>
            </Link>
          </Space>
        }
      />

      {/* Filter bar for Admin or Multi-course instructor */}
      <div className="analytics-header-row">
        <Space wrap>
          {isAdmin && (
            <Select
              value={instructorFilter}
              onChange={setInstructorFilter}
              style={{ width: 220 }}
              options={[
                { value: 'all', label: 'ผู้สอนทั้งหมด' },
                ...instructors.map((ins) => ({ value: ins.id, label: ins.name })),
              ]}
            />
          )}

          <Select
            value={courseFilter}
            onChange={setCourseFilter}
            style={{ width: 240 }}
            options={[
              { value: 'all', label: 'ทุกคอร์สที่รับผิดชอบ' },
              ...courseRows.map((c) => ({ value: c.courseId, label: c.title })),
            ]}
          />
        </Space>
      </div>

      {/* Summary KPI Cards */}
      <div className="analytics-stats-grid">
        <div className="analytics-stat-card">
          <div className="analytics-stat-label">ผู้เรียนทั้งหมด</div>
          <div className="analytics-stat-value">{totalEnrolled}</div>
          <div className="analytics-stat-sub">ผู้เรียนที่ลงทะเบียนเรียนจริง</div>
        </div>

        <div className="analytics-stat-card">
          <div className="analytics-stat-label">ผู้เรียนที่เรียนจบ</div>
          <div className="analytics-stat-value">{totalCompleted}</div>
          <div className="analytics-stat-sub">
            {totalEnrolled > 0
              ? `${Math.round((totalCompleted / totalEnrolled) * 100)}% ของผู้เรียนทั้งหมด`
              : 'ยังไม่มีข้อมูล'}
          </div>
        </div>

        <div className="analytics-stat-card">
          <div className="analytics-stat-label">งานที่ส่งทั้งหมด</div>
          <div className="analytics-stat-value">{totalSubmissions}</div>
          <div className="analytics-stat-sub">แบบฝึกหัดและข้อสอบที่ส่งแล้ว</div>
        </div>

        <div
          className={`analytics-stat-card ${totalPendingReview > 0 ? 'is-clickable' : ''}`}
          onClick={() =>
            totalPendingReview > 0 &&
            navigate(courseFilter !== 'all' ? `/teach/reviews?course=${courseFilter}` : '/teach/reviews')
          }
        >
          <div className="analytics-stat-label">ข้อเขียนรอตรวจ</div>
          <div className="analytics-stat-value">{totalPendingReview}</div>
          <div className="analytics-stat-sub">
            {totalPendingReview > 0 ? 'กดเพื่อเปิดคิวตรวจ' : 'ตรวจครบเรียบร้อย'}
          </div>
        </div>
      </div>

      {courseRows.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '40px 0', marginTop: 16 }}>
          <Empty
            description="คุณยังไม่มีคอร์สในความดูแล จึงยังไม่มีข้อมูลสถิติหรือผลการเรียนรู้"
          >
            <Link to="/teach/courses/new">
              <Button type="primary">สร้างคอร์สแรกของคุณ</Button>
            </Link>
          </Empty>
        </Card>
      ) : (
        <>
          {/* Needs Attention Box */}
          {oldestPending.length > 0 && (
            <div className="analytics-attention-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <strong style={{ fontSize: 15, color: '#1e3a8a' }}>
                    <ClockCircleOutlined /> รายการต้องติดตาม: งานรอตรวจเก่าที่สุด
                  </strong>
                  <div style={{ fontSize: 13, color: '#475569' }}>
                    ผู้เรียนกำลังรอการตรวจข้อเขียนเพื่อให้ได้คะแนนและใบรับรอง
                  </div>
                </div>
                <Link to={courseFilter !== 'all' ? `/teach/reviews?course=${courseFilter}` : '/teach/reviews'}>
                  <Button type="primary" size="small">
                    เปิดคิวตรวจทั้งหมด
                  </Button>
                </Link>
              </div>

              <div>
                {oldestPending.map((item) => (
                  <div className="attention-item" key={item.id}>
                    <div>
                      <strong>{item.learner?.name || 'ผู้เรียน'}</strong> ·{' '}
                      <span style={{ color: '#475569' }}>{item.quiz?.title}</span>{' '}
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        ({item.course?.title})
                      </Text>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="review-age-badge">{item.ageText}</span>
                      <Link to={`/teach/attempts/${item.id}/grade?returnTo=/teach/analytics`}>
                        <Button size="small">ตรวจทันที</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Course breakdown Table */}
          <Card title="ภาพรวมผลการเรียนรู้แยกตามคอร์ส">
            <Table
              rowKey="courseId"
              dataSource={filteredCourseRows}
              columns={columns}
              pagination={{ pageSize: 8 }}
              locale={{ emptyText: 'ยังไม่มีคอร์สในรายการ' }}
            />
          </Card>
        </>
      )}
    </div>
  );
}
