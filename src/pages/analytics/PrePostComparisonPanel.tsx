import React, { useState } from 'react';
import { Avatar, Button, Empty, Select, Space, Table, Tag, Typography } from 'antd';
import type { TableProps } from 'antd';
import { Link } from 'react-router-dom';
import { useLms } from '../../store';
import { getPrePostComparison } from '../../api/analytics';
import type { PrePostLearnerResult } from '../../types';
import './analytics.css';

const { Title, Text } = Typography;

export interface PrePostComparisonPanelProps {
  courseId: string;
}

export function PrePostComparisonPanel({ courseId }: PrePostComparisonPanelProps) {
  const { data } = useLms();
  const comparisonSets = (data.comparisonSets || []).filter((cs) => cs.courseId === courseId);
  const [selectedSetId, setSelectedSetId] = useState(comparisonSets[0]?.id);

  const activeSetId = selectedSetId || comparisonSets[0]?.id;
  const analysis = getPrePostComparison(data, courseId, activeSetId);

  if (!comparisonSets.length) {
    return (
      <Empty
        description="ยังไม่มีชุดประเมิน Pre/Post สำหรับคอร์สนี้"
        style={{ padding: '40px 0' }}
      />
    );
  }

  if (!analysis) {
    return <Empty description="ไม่พบข้อมูลชุดประเมิน" />;
  }

  const {
    set,
    preQuiz,
    postQuiz,
    totalEnrolled,
    matchedN,
    pendingCount,
    unmatchedCount,
    preAvg,
    postAvg,
    avgDiff,
    learnerResults,
  } = analysis;

  const diffColorClass = avgDiff > 0 ? 'diff-positive' : avgDiff < 0 ? 'diff-negative' : 'diff-neutral';
  const diffSign = avgDiff > 0 ? `+${avgDiff}%` : `${avgDiff}%`;

  const columns: TableProps<PrePostLearnerResult>['columns'] = [
    {
      title: 'ผู้เรียน',
      key: 'learner',
      render: (_, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar style={{ backgroundColor: '#2563eb' }}>
            {row.learner?.name?.slice(0, 1) || 'L'}
          </Avatar>
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
      title: `Pre-test (${preQuiz?.title || 'ก่อนเรียน'})`,
      key: 'preScore',
      render: (_, row) => {
        if (row.preAttempt?.essayStatus === 'pending') {
          return <Tag color="warning">รอตรวจข้อเขียน</Tag>;
        }
        return row.preScore !== null ? <strong>{row.preScore}%</strong> : <Text type="secondary">— (ยังไม่ทำ)</Text>;
      },
    },
    {
      title: `Post-test (${postQuiz?.title || 'หลังเรียน'})`,
      key: 'postScore',
      render: (_, row) => {
        if (row.postAttempt?.essayStatus === 'pending') {
          return <Tag color="warning">รอตรวจข้อเขียน</Tag>;
        }
        return row.postScore !== null ? <strong>{row.postScore}%</strong> : <Text type="secondary">— (ยังไม่ทำ)</Text>;
      },
    },
    {
      title: 'ส่วนต่างคะแนน (จุด %)',
      key: 'diff',
      render: (_, row) => {
        if (row.status === 'pending_grading') {
          return <Text type="secondary">รอผลตรวจ</Text>;
        }
        if (row.diff === null) return <Text type="secondary">—</Text>;
        const color = row.diff > 0 ? 'green' : row.diff < 0 ? 'red' : 'default';
        const sign = row.diff > 0 ? `+${row.diff}%` : `${row.diff}%`;
        return <Tag color={color} style={{ fontWeight: 600 }}>{sign}</Tag>;
      },
    },
    {
      title: 'สถานะการเปรียบเทียบ',
      key: 'status',
      render: (_, row) => {
        switch (row.status) {
          case 'matched':
            return <Tag color="success">จับคู่สมบูรณ์</Tag>;
          case 'pending_grading':
            return <Tag color="warning">มีข้อเขียนรอตรวจ</Tag>;
          case 'pre_only':
            return <Tag color="processing">ทำเฉพาะก่อนเรียน</Tag>;
          case 'post_only':
            return <Tag color="processing">ทำเฉพาะหลังเรียน</Tag>;
          default:
            return <Tag>ยังไม่ทำทั้งคู่</Tag>;
        }
      },
    },
    {
      title: '',
      key: 'action',
      render: (_, row) => (
        <Space>
          <Link to={`/teach/courses/${courseId}/analytics/learners/${row.learnerId}`}>
            <Button size="small" type="primary" ghost>
              ดูประวัติ
            </Button>
          </Link>
          {row.status === 'pending_grading' && (
            <Link
              to={
                row.postAttempt?.essayStatus === 'pending'
                  ? `/teach/attempts/${row.postAttempt.id}/grade?returnTo=${encodeURIComponent(`/teach/courses/${courseId}/analytics`)}`
                  : `/teach/attempts/${row.preAttempt?.id}/grade?returnTo=${encodeURIComponent(`/teach/courses/${courseId}/analytics`)}`
              }
            >
              <Button size="small" type="primary">
                ตรวจข้อเขียน
              </Button>
            </Link>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="prepost-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {set?.title}
          </Title>
          <Text type="secondary">
            เปรียบเทียบคะแนน Pre-test และ Post-test ของผู้เรียนคนเดียวกันในคอร์ส
          </Text>
        </div>
        {comparisonSets.length > 1 && (
          <Select
            value={activeSetId}
            onChange={setSelectedSetId}
            style={{ width: 280 }}
            options={comparisonSets.map((cs) => ({ value: cs.id, label: cs.title }))}
          />
        )}
      </div>

      <div className="prepost-summary-grid">
        <div className="prepost-stat-pill">
          <div className="analytics-stat-label">ส่วนต่างเฉลี่ย (Paired Gain)</div>
          <div className={diffColorClass}>{matchedN > 0 ? diffSign : '—'}</div>
          <div className="analytics-stat-sub">คำนวณจาก {matchedN} ผู้เรียนที่มีผลครบ</div>
        </div>
        <div className="prepost-stat-pill">
          <div className="analytics-stat-label">คะแนนเฉลี่ย Pre-test</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>
            {matchedN > 0 ? `${preAvg}%` : '—'}
          </div>
          <div className="analytics-stat-sub">{preQuiz?.title}</div>
        </div>
        <div className="prepost-stat-pill">
          <div className="analytics-stat-label">คะแนนเฉลี่ย Post-test</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>
            {matchedN > 0 ? `${postAvg}%` : '—'}
          </div>
          <div className="analytics-stat-sub">{postQuiz?.title}</div>
        </div>
        <div className="prepost-stat-pill">
          <div className="analytics-stat-label">ความครอบคลุม (Coverage)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>
            {matchedN}/{totalEnrolled}
          </div>
          <div className="analytics-stat-sub">
            {pendingCount > 0 && <span style={{ color: '#b45309' }}>รอตรวจ {pendingCount} · </span>}
            ขาดผล {unmatchedCount}
          </div>
        </div>
      </div>

      <Table
        rowKey="learnerId"
        dataSource={learnerResults}
        columns={columns}
        pagination={{ pageSize: 8 }}
      />

      <div className="prepost-formula-callout">
        <strong>หลักเกณฑ์และการคำนวณ:</strong>
        <ul style={{ margin: '6px 0 0 0', paddingLeft: 20 }}>
          <li>
            สูตรส่วนต่างรายคน = <code>Post% - Pre%</code> (จุดเปอร์เซ็นต์)
          </li>
          <li>
            ส่วนต่างเฉลี่ยคำนวณเฉพาะผู้เรียนที่ส่งผลครบทั้งคู่และตรวจสมบูรณ์แล้ว (<code>matched n = {matchedN}</code>)
          </li>
          <li>
            คำตอบข้อเขียนที่ยังรอตรวจจะไม่ถูกนับเป็น 0 และยังไม่ถูกรวมในการคำนวณส่วนต่างเฉลี่ยจนกว่าจะตรวจเสร็จ
          </li>
          <li>
            ตัวเลขนี้แสดงการเปลี่ยนแปลงผลการประเมินในชุดตัวอย่าง ไม่สามารถอ้างเป็นข้อพิสูจน์สาเหตุการเรียนรู้ (causal effect) ได้โดยตรง
          </li>
        </ul>
      </div>
    </div>
  );
}
