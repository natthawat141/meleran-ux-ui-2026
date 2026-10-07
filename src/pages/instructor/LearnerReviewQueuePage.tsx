import React from 'react';
import { Button, Empty, Input, Select, Space, Table, Tag, Typography, type TableProps } from 'antd';
import { ArrowRightOutlined, ClockCircleOutlined, FileImageOutlined, FileTextOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLms } from '../../store';
import { getReviewQueue, type ReviewQueueItem } from '../../lib/assessment-review';
import { PageTitle } from '../../components/common';
import { UserAvatar } from '../../components/UserAvatar';
import './review-queue.css';

const { Text } = Typography;

export function LearnerReviewQueuePage() {
  const { data, currentUser } = useLms();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const courseFilter = searchParams.get('course') || searchParams.get('courseId') || 'all';
  const modeFilter = searchParams.get('mode') || 'all';
  const searchText = searchParams.get('q') || '';

  const courses = (data.courses || []).filter(
    (c) => currentUser?.role === 'admin' || c.instructorId === currentUser?.id
  );

  const queueItems = getReviewQueue(data, {
    instructorId: currentUser?.id,
    role: currentUser?.role,
    courseId: courseFilter !== 'all' ? courseFilter : undefined,
  });

  const filteredItems = queueItems.filter((item) => {
    if (modeFilter !== 'all' && item.mode !== modeFilter) return false;
    if (!searchText) return true;
    const term = searchText.toLowerCase();
    return (
      item.learner?.name?.toLowerCase().includes(term) ||
      item.quiz?.title?.toLowerCase().includes(term) ||
      item.course?.title?.toLowerCase().includes(term)
    );
  });

  const columns: TableProps<ReviewQueueItem>['columns'] = [
    {
      title: 'ผู้เรียน',
      key: 'learner',
      width: 230,
      render: (_, row) => (
        <div className="review-learner">
          <UserAvatar user={row.learner} />
          <div>
            <strong>{row.learner?.name || 'ผู้เรียน'}</strong>
            <div>
              <Text type="secondary" className="review-learner-email">
                {row.learner?.email}
              </Text>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'คอร์สและแบบฝึกหัด',
      key: 'courseQuiz',
      render: (_, row) => (
        <div>
          <div className="review-quiz-title">{row.quiz?.title || 'แบบฝึกหัด'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.course?.title}
          </Text>
        </div>
      ),
    },
    {
      title: 'ประเภทคำตอบ',
      key: 'mode',
      render: (_, row) =>
        row.mode === 'image' ? (
          <Tag className="review-answer-type" icon={<FileImageOutlined />}>
            มีรูปภาพแนบ
          </Tag>
        ) : (
          <Tag className="review-answer-type" icon={<FileTextOutlined />}>
            ข้อเขียน
          </Tag>
        ),
    },
    {
      title: 'เวลาที่ส่ง',
      key: 'submittedAt',
      render: (_, row) => (
        <div>
          <div className="review-age-badge">
            <ClockCircleOutlined /> {row.ageText}
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {row.submittedAt ? new Date(row.submittedAt).toLocaleString('th-TH') : '—'}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'ตรวจงาน',
      key: 'actions',
      render: (_, row) => (
        <Button
          icon={<ArrowRightOutlined aria-hidden="true" />}
          onClick={() => {
            const returnUrl = `/teach/reviews${window.location.search}`;
            navigate(`/teach/attempts/${row.id}/grade?returnTo=${encodeURIComponent(returnUrl)}`);
          }}
        >
          ตรวจคำตอบ
        </Button>
      ),
    },
  ];

  return (
    <div className="review-queue">
      <PageTitle
        eyebrow="คิวตรวจงานส่วนกลาง"
        title="งานรอตรวจของผู้เรียน"
        subtitle="ตรวจข้อเขียนและรูปภาพที่ส่งมาจากทุกแบบฝึกหัด เรียงตามลำดับเวลาที่ส่งก่อน"
        actions={
          <Button onClick={() => navigate('/teach/analytics')}>ดูภาพรวม Analytics</Button>
        }
      />

      <div className="review-queue-filter-bar">
        <Space wrap>
          <Select
            value={courseFilter}
            onChange={(val) => {
              const next = new URLSearchParams(searchParams);
              next.delete('courseId');
              if (val === 'all') next.delete('course');
              else next.set('course', val);
              setSearchParams(next);
            }}
            className="review-course-filter"
            aria-label="กรองตามคอร์ส"
            options={[
              { value: 'all', label: currentUser?.role === 'admin' ? 'ทุกคอร์ส' : 'ทุกคอร์สของฉัน' },
              ...courses.map((c) => ({ value: c.id, label: c.title })),
            ]}
          />

          <Select
            value={modeFilter}
            onChange={(val) => {
              const next = new URLSearchParams(searchParams);
              if (val === 'all') next.delete('mode');
              else next.set('mode', val);
              setSearchParams(next);
            }}
            className="review-mode-filter"
            aria-label="กรองประเภทคำตอบ"
            options={[
              { value: 'all', label: 'ทุกประเภทคำตอบ' },
              { value: 'text', label: 'ข้อเขียนเท่านั้น' },
              { value: 'image', label: 'มีรูปภาพแนบ' },
            ]}
          />

          <Input
            placeholder="ค้นหาชื่อผู้เรียนหรือแบบฝึกหัด..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => {
              const next = new URLSearchParams(searchParams);
              if (e.target.value) next.set('q', e.target.value);
              else next.delete('q');
              setSearchParams(next, { replace: true });
            }}
            className="review-search"
            aria-label="ค้นหาชื่อผู้เรียนหรือแบบฝึกหัด"
            allowClear
          />
        </Space>

        {(courseFilter !== 'all' || modeFilter !== 'all' || searchText) && (
          <Button
            onClick={() => {
              setSearchParams({});
            }}
          >
            ล้างตัวกรอง
          </Button>
        )}
      </div>

      <div className="review-queue-table">
        <Table<ReviewQueueItem>
          rowKey="id"
          dataSource={filteredItems}
          columns={columns}
          scroll={{ x: 850 }}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  queueItems.length === 0
                    ? 'ยอดเยี่ยม! ไม่มีงานข้อเขียนหรือรูปภาพรอตรวจในขณะนี้'
                    : 'ไม่พบรายการที่ตรงกับตัวกรอง'
                }
              />
            ),
          }}
        />
      </div>
    </div>
  );
}
