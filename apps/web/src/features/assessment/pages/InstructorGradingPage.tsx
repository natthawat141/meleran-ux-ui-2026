import React, { useState } from 'react';
import { Alert, Button, Card, Empty, Input, InputNumber, List, Space, Typography, message } from 'antd';
import { PageTitle } from '@melearn/ui';
import { useGradeQuestion, useGradingQueue } from '../../learning/hooks/use-assessment';

export function InstructorGradingPage() {
  const queue = useGradingQueue(); const grade = useGradeQuestion();
  const [scores, setScores] = useState<Record<string, number>>({}); const [comments, setComments] = useState<Record<string, string>>({});
  if (queue.isPending || queue.isError) return <div className="public-page"><PageTitle eyebrow="พื้นที่ผู้สอน" title="คิวตรวจคำตอบ" />{queue.isPending ? <Typography.Text>กำลังโหลดคิวตรวจ</Typography.Text> : <Alert type="error" message="โหลดคิวตรวจไม่สำเร็จ" action={<Button onClick={() => void queue.refetch()}>ลองอีกครั้ง</Button>} />}</div>;
  return <div className="public-page"><PageTitle eyebrow="พื้นที่ผู้สอน" title="คิวตรวจคำตอบ" subtitle="รายการนี้มาจาก API จำลองและจำกัดเฉพาะคอร์สที่คุณเป็นเจ้าของ" />
    {!queue.data.length ? <Empty description="ไม่มีคำตอบที่รอตรวจ" /> : <List dataSource={queue.data} renderItem={(attempt) => <List.Item><Card className="w-full" title={`ผู้เรียน ${attempt.learner_display_name}`} extra={<Typography.Text type="secondary">ส่งเมื่อ {new Date(attempt.submitted_at).toLocaleString('th-TH')}</Typography.Text>}>
      {attempt.questions_to_grade.map((question) => {
        const key = `${attempt.attempt_id}:${question.question_id}`;
        return <Card type="inner" key={question.question_id} title={`${question.type === 'essay' ? 'ข้อเขียน' : 'รูปภาพ'} · ${question.max} คะแนน`} className="top-space">
          <Typography.Paragraph>{question.prompt}</Typography.Paragraph>
          {question.answer.text && <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{question.answer.text}</Typography.Paragraph>}
          {question.answer.image_url && <a href={question.answer.image_url} target="_blank" rel="noreferrer">เปิดรูปคำตอบ</a>}
          <Space wrap className="top-space"><InputNumber min={0} max={question.max} step={0.5} value={scores[key] ?? 0} onChange={(value) => setScores((current) => ({ ...current, [key]: value ?? 0 }))} aria-label="คะแนน" /><Input value={comments[key] ?? ''} onChange={(event) => setComments((current) => ({ ...current, [key]: event.target.value }))} placeholder="ข้อเสนอแนะ (ไม่บังคับ)" aria-label="ข้อเสนอแนะ" /><Button type="primary" loading={grade.isPending} onClick={() => grade.mutate({ attemptId: attempt.attempt_id, questionId: question.question_id, score: scores[key] ?? 0, comment: comments[key]?.trim() || null }, { onSuccess: () => { void message.success('บันทึกคะแนนแล้ว'); void queue.refetch(); } })}>บันทึกคะแนน</Button></Space>
        </Card>;
      })}
    </Card></List.Item>} />}
    {grade.isError && <Alert className="top-space" type="error" message="บันทึกคะแนนไม่สำเร็จ ตรวจสิทธิ์เจ้าของคอร์สและช่วงคะแนน" />}
  </div>;
}
