import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Select, Space, Spin, Switch, Typography, message } from 'antd';
import { PageTitle } from '@melearn/ui';
import { useAdminAiAuthoring, useAdminAiCourses, useAdminTranscript, useSaveAdminTranscript, useSetCourseAiEnabled } from '../hooks/use-admin-ai';

export function ProvisionalAiAdminPage() {
  const courses = useAdminAiCourses(); const [courseId, setCourseId] = useState('');
  const authoring = useAdminAiAuthoring(courseId);
  const videos = useMemo(() => authoring.data?.chapters.flatMap((chapter) => chapter.items.filter((item) => item.type === 'video').map((item) => ({ ...item, chapterTitle: chapter.title }))) ?? [], [authoring.data]);
  const [itemId, setItemId] = useState(''); const selected = videos.find((item) => item.id === itemId) ?? videos[0];
  const transcript = useAdminTranscript(courseId, selected?.id ?? ''); const [draft, setDraft] = useState('');
  const save = useSaveAdminTranscript(); const toggle = useSetCourseAiEnabled();
  useEffect(() => { if (selected && selected.id !== itemId) setItemId(selected.id); }, [itemId, selected]);
  useEffect(() => { if (transcript.data) setDraft(transcript.data.text); }, [transcript.data]);
  return <div className="public-page">
    <PageTitle eyebrow="ผู้ดูแลระบบ · R9 mock" title="Melearn AI และ Transcript" subtitle="ตั้งค่า AI ต่อคอร์สและแก้ Transcript ที่ API จำลองเก็บไว้" />
    <Alert showIcon type="warning" message="เฉพาะ provisional mock ในเครื่อง" description="การเปลี่ยนแปลงจะอยู่ใน memory ของ mock server เท่านั้น ไม่เปลี่ยน Production และไม่ยืนยันว่า AI จริงพร้อมใช้งาน" />
    {courses.isError && <Alert className="top-space" type="error" message="โหลดคอร์สไม่ได้" description={courses.error.message} />}
    <Card className="top-space" title="คอร์ส">
      <Select className="w-full" aria-label="คอร์สที่ต้องการตั้งค่า AI" placeholder="เลือกคอร์ส" value={courseId || undefined} onChange={setCourseId} loading={courses.isPending} options={(courses.data ?? []).map((course) => ({ value: course.id, label: `${course.title} · ${course.status}` }))} />
      {authoring.isPending && courseId && <div className="top-space"><Spin /></div>}
      {authoring.isError && <Alert className="top-space" type="error" message="อ่านรายละเอียดคอร์สไม่ได้" description={authoring.error.message} />}
      {authoring.data && <div className="top-space"><Space><Typography.Text strong>เปิด AI สำหรับคอร์สนี้</Typography.Text><Switch checked={authoring.data.ai_enabled} loading={toggle.isPending} onChange={(enabled) => toggle.mutate({ courseId, enabled }, { onSuccess: () => void message.success(enabled ? 'เปิด AI แล้ว' : 'ปิด AI แล้ว'), onError: (error) => void message.error(error.message) })} /></Space>
        <Typography.Paragraph type="secondary">ผู้เรียนต้องมีสิทธิ์ในคอร์ส และ Backend ยังต้องตรวจสิทธิ์กับ AI provider จริง</Typography.Paragraph>
      </div>}
    </Card>
    {authoring.data && <Card className="top-space" title="Transcript วิดีโอ">
      {!videos.length ? <Empty description="คอร์สนี้ยังไม่มีวิดีโอ" /> : <>
        <Select className="w-full" aria-label="เลือกวิดีโอ" value={selected?.id} onChange={setItemId} options={videos.map((item) => ({ value: item.id, label: `${item.chapterTitle} · ${item.title}` }))} />
        {transcript.isPending ? <div className="top-space"><Spin /></div> : transcript.isError ? <Alert className="top-space" type="error" message="อ่าน Transcript ไม่ได้" description={transcript.error.message} action={<Button onClick={() => void transcript.refetch()}>ลองอีกครั้ง</Button>} /> : <>
          <label className="block top-space" htmlFor="admin-ai-transcript">AI Transcript</label>
          <textarea id="admin-ai-transcript" className="w-full min-h-64 top-space" maxLength={200000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="วาง Transcript สำหรับใช้เป็นความรู้ AI" />
          <Typography.Paragraph type="secondary">บันทึกแยกจาก course draft · {transcript.data?.edited_at ? `แก้ล่าสุด ${new Date(transcript.data.edited_at).toLocaleString('th-TH')}` : 'ยังไม่มี Transcript'}</Typography.Paragraph>
          <Button type="primary" disabled={draft === transcript.data?.text} loading={save.isPending} onClick={() => save.mutate({ courseId, itemId: selected!.id, text: draft }, { onSuccess: () => void message.success('บันทึก Transcript แล้ว'), onError: (error) => void message.error(error.message) })}>บันทึก Transcript</Button>
        </>}
      </>}
    </Card>}
  </div>;
}
