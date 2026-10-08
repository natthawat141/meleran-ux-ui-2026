import { RichDocument } from '@melearn/ui';
import React, { useState } from 'react';
import { Alert, Button, Card, Empty, Input, List, Progress, Result, Space, Spin, Typography, message } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageTitle } from '@melearn/ui';
import { safeCatalogCoverUrl } from '../../courses/api/catalog-display';
import type { LearningItem } from '../api/learning-api';
import { useAuthSession } from '../../auth/api/AuthSessionProvider';
import { useCompleteLearningItem, useLearningCourse, useLearningItem, useMyLearning, useSaveLearningResume } from '../hooks/use-learning';
import { useAttempt, useStartAttempt } from '../hooks/use-assessment';
import { useSaveAttemptAnswers, useSubmitAttempt } from '../hooks/use-assessment';
import { learningApi } from '../api/learning-api';
import { useServerCertificate, useServerCertificates } from '../../certificate/hooks/use-server-certificates';
import { useMutation } from '@tanstack/react-query';
import { certificateApi } from '../../certificate/api/certificate-api';

function QueryState({ loading, error, retry }: { loading: boolean; error: boolean; retry: () => void }) {
  if (loading) return <div className="public-page" role="status"><Spin /> กำลังโหลดข้อมูลจาก API จำลอง</div>;
  if (error) return <Alert type="error" showIcon message="โหลดข้อมูลไม่สำเร็จ" description="ตรวจสอบว่า API จำลองยังทำงานอยู่ แล้วลองอีกครั้ง" action={<Button onClick={retry}>ลองอีกครั้ง</Button>} />;
  return null;
}

export function MyCoursesPage() {
  const query = useMyLearning();
  const session = useAuthSession();
  if (query.isPending || query.isError) return <div className="public-page"><PageTitle eyebrow="พื้นที่ผู้เรียน" title="คอร์สของฉัน" /><QueryState loading={query.isPending} error={query.isError} retry={() => void query.refetch()} /></div>;
  return <div className="public-page">
    <PageTitle eyebrow="พื้นที่ผู้เรียน" title="คอร์สของฉัน" subtitle={`ยินดีต้อนรับ ${session.user?.display_name ?? 'ผู้เรียน'} · ข้อมูลมาจาก API จำลอง`} actions={<Link to="/courses"><Button type="primary">สำรวจคอร์ส</Button></Link>} />
    {query.data.length === 0 ? <Empty description="ยังไม่มีคอร์สที่ลงเรียน"><Link to="/courses"><Button type="primary">เลือกคอร์สแรก</Button></Link></Empty> :
      <List grid={{ gutter: 20, xs: 1, sm: 2, xl: 3 }} dataSource={query.data} renderItem={(entry) => <List.Item><Card hoverable cover={safeCatalogCoverUrl(entry.course.cover_url) ? <img src={safeCatalogCoverUrl(entry.course.cover_url)!} alt="" /> : undefined}>
        <Typography.Text type="secondary">{entry.course.category} · {entry.course.level}</Typography.Text><Typography.Title level={4}>{entry.course.title}</Typography.Title>
        <Typography.Paragraph type="secondary">{entry.course.subtitle}</Typography.Paragraph>
        <Progress percent={entry.progress.total_items ? Math.floor(entry.progress.completed_items / entry.progress.total_items * 100) : 100} />
        <Link to={`/learn/courses/${encodeURIComponent(entry.course.id)}`}><Button type="primary" block>{entry.progress.completed_at ? 'ดูคอร์สที่เรียนจบ' : 'เรียนต่อ'}</Button></Link>
      </Card></List.Item>} />}
  </div>;
}

export function LearningCoursePage() {
  const { courseId = '' } = useParams();
  const query = useLearningCourse(courseId);
  if (query.isPending || query.isError) return <div className="public-page"><QueryState loading={query.isPending} error={query.isError} retry={() => void query.refetch()} /></div>;
  const course = query.data;
  const progress = course.progress.total_items ? Math.floor(course.progress.completed_items / course.progress.total_items * 100) : 100;
  return <div className="public-page">
    <PageTitle eyebrow="กำลังเรียน" title={course.title} subtitle={`${course.instructor.display_name} · ${course.progress.completed_items}/${course.progress.total_items} รายการเสร็จ`} actions={<Link to="/learn/courses"><Button>คอร์สของฉัน</Button></Link>} />
    <Progress percent={progress} />
    {course.certificate_id && <Alert className="top-space" type="success" showIcon message="เรียนครบและได้รับใบรับรองแล้ว" action={<Link to={`/account/certificates/${course.certificate_id}`}>เปิดใบรับรอง</Link>} />}
    {course.outline.map((chapter, chapterIndex) => <Card key={chapter.id} title={`บทที่ ${chapterIndex + 1} · ${chapter.title}`} className="top-space">
      <List dataSource={chapter.items} locale={{ emptyText: 'บทนี้ยังไม่มีรายการเรียน' }} renderItem={(item: LearningItem) => <List.Item actions={[<Link key="open" to={item.type === 'quiz' ? `/learn/courses/${courseId}/quizzes/${item.id}` : `/learn/courses/${courseId}/${item.type === 'video' ? 'videos' : 'articles'}/${item.id}`}>{item.completed_at ? 'ทบทวน' : 'เปิดรายการ'}</Link>] }>
        <List.Item.Meta title={item.title} description={<>{item.type === 'video' ? 'วิดีโอ' : item.type === 'article' ? 'บทอ่าน' : 'แบบฝึกหัด'} · {item.completed_at ? 'เรียนเสร็จแล้ว' : item.id === course.resume_item_id ? 'เรียนต่อจากรายการนี้' : 'ยังไม่เสร็จ'}</>} />
      </List.Item>} />
    </Card>)}
  </div>;
}

function useLessonParams() { return useParams<{ courseId: string; itemId: string }>(); }
export function LessonPage({ expectedType }: { expectedType: 'video' | 'article' }) {
  const { courseId = '', itemId = '' } = useLessonParams();
  const course = useLearningCourse(courseId); const item = useLearningItem(courseId, itemId);
  const complete = useCompleteLearningItem(courseId); const saveResume = useSaveLearningResume(courseId);
  const [position, setPosition] = useState(0);
  const savedPosition = course.data?.outline.flatMap((chapter) => chapter.items).find((entry) => entry.id === itemId)?.resume?.position_seconds;
  React.useEffect(() => { if (savedPosition !== undefined) setPosition(savedPosition); }, [savedPosition]);
  if (course.isPending || item.isPending || course.isError || item.isError) return <div className="public-page"><QueryState loading={course.isPending || item.isPending} error={course.isError || item.isError} retry={() => { void course.refetch(); void item.refetch(); }} /></div>;
  if (item.data.type !== expectedType) return <div className="public-page"><Alert type="warning" message="รายการนี้เป็นเนื้อหาคนละประเภท" action={<Link to={`/learn/courses/${courseId}`}>กลับไปที่คอร์ส</Link>} /></div>;
  const youtubeId = item.data.type === 'video' ? item.data.video_url?.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=))([\w-]{11})/)?.[1] : undefined;
  return <div className="public-page">
    <PageTitle eyebrow={course.data.title} title={item.data.title} actions={<Link to={`/learn/courses/${courseId}`}><Button>กลับไปที่เนื้อหาคอร์ส</Button></Link>} />
    {expectedType === 'video' ? youtubeId ? <div className="lesson-video-frame"><iframe title={item.data.title} src={`https://www.youtube-nocookie.com/embed/${youtubeId}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div> : <Alert type="info" message="ไม่มีวิดีโอที่เปิดได้ในตัวอย่างนี้" /> : <Card><RichDocument document={item.data.body_doc} text={item.data.body??''} /></Card>}
    {expectedType === 'video' && <Card className="top-space"><Typography.Text>บันทึกตำแหน่งวิดีโอ (วินาที)</Typography.Text><Space><Input type="number" min={0} value={position} onChange={(event) => setPosition(Math.max(0, Number(event.target.value) || 0))} /><Button loading={saveResume.isPending} onClick={() => saveResume.mutate({ itemId, positionSeconds: position }, { onSuccess: () => void message.success('บันทึกตำแหน่งแล้ว') })}>บันทึกตำแหน่ง</Button></Space></Card>}
    <div className="top-space"><Button type="primary" loading={complete.isPending} disabled={Boolean(item.data.id && course.data.outline.flatMap((chapter) => chapter.items).find((entry) => entry.id === itemId)?.completed_at)} onClick={() => complete.mutate(itemId, { onSuccess: () => void message.success('บันทึกว่าเรียนรายการนี้เสร็จแล้ว') })}>ทำรายการนี้เสร็จ</Button>{complete.isError && <Alert className="top-space" type="error" message="บันทึกความคืบหน้าไม่สำเร็จ" />}</div>
  </div>;
}

export function QuizStartPage() {
  const { courseId = '', itemId = '', quizId = '' } = useParams(); const item = useLearningItem(courseId, itemId || quizId); const enrollments = useMyLearning(); const start = useStartAttempt(); const navigate = useNavigate();
  const [resolveError, setResolveError] = useState(false);
  React.useEffect(() => {
    if (courseId || !quizId || !enrollments.data) return;
    let active = true;
    void Promise.all(enrollments.data.map(async (entry) => ({ id: entry.course.id, course: await learningApi.course(entry.course.id) })))
      .then((courses) => {
        if (!active) return;
        const match = courses.find(({ course }) => course.outline.some((chapter) => chapter.items.some((candidate) => candidate.id === quizId && candidate.type === 'quiz')));
        if (match) navigate(`/learn/courses/${encodeURIComponent(match.id)}/quizzes/${encodeURIComponent(quizId)}`, { replace: true });
        else setResolveError(true);
      }).catch(() => { if (active) setResolveError(true); });
    return () => { active = false; };
  }, [courseId, quizId, enrollments.data]);
  if (!courseId && !quizId) return <Alert type="error" message="ไม่พบแบบฝึกหัด" />;
  if (!courseId) return <div className="public-page" role="status">{resolveError ? <Alert type="error" message="ไม่พบแบบฝึกหัดในคอร์สที่ลงเรียน" /> : <Spin tip="กำลังค้นหาแบบฝึกหัด" />}</div>;
  if (item.isPending || item.isError) return <div className="public-page"><QueryState loading={item.isPending} error={item.isError} retry={() => void item.refetch()} /></div>;
  return <div className="public-page"><PageTitle eyebrow="แบบฝึกหัด" title={item.data.title} subtitle={item.data.quiz ? `${item.data.quiz.question_count} ข้อ · คะแนนเต็ม ${item.data.quiz.max_score}` : undefined} />
    <Card><Typography.Paragraph>คำตอบและผลคะแนนจะบันทึกใน API จำลอง แบบฝึกหัดที่มีข้อเขียนต้องรอผู้สอนตรวจ</Typography.Paragraph><Button type="primary" loading={start.isPending} onClick={() => start.mutate(itemId, { onSuccess: (attempt) => navigate(`/learn/attempts/${attempt.id}`) })}>เริ่มทำแบบฝึกหัด</Button>{start.isError && <Alert className="top-space" type="error" message="เริ่มแบบฝึกหัดไม่สำเร็จ" />}</Card>
  </div>;
}

export function QuizAttemptPage() {
  const { attemptId = '' } = useParams(); const query = useAttempt(attemptId); const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, { option_ids?: string[]; text?: string; image_url?: string }>>({});
  const [initialized, setInitialized] = useState(false);
  React.useEffect(() => { if (query.data && !initialized) { setAnswers(query.data.answers); setInitialized(true); } }, [query.data, initialized]);
  const saveMutation = useSaveAttemptAnswers(); const submitMutation = useSubmitAttempt();
  if (query.isPending || query.isError) return <div className="public-page"><QueryState loading={query.isPending} error={query.isError} retry={() => void query.refetch()} /></div>;
  const attempt = query.data;
  if (attempt.status !== 'in_progress') return <div className="public-page"><Result status="info" title="ส่งคำตอบแล้ว" subTitle={attempt.status === 'pending_review' ? 'มีคำตอบข้อเขียนรอผู้สอนตรวจ' : 'เปิดดูผลการทำแบบฝึกหัด'} extra={<Button type="primary" onClick={() => navigate(`/learn/attempts/${attemptId}/result`)}>ดูผล</Button>} /></div>;
  const setAnswer = (id: string, value: { option_ids?: string[]; text?: string; image_url?: string }) => setAnswers((current) => ({ ...current, [id]: value }));
  return <div className="public-page"><PageTitle eyebrow={`ครั้งที่ ${attempt.number}`} title="ทำแบบฝึกหัด" subtitle={`คะแนนเต็ม ${attempt.max}`} />
    <Space direction="vertical" size="large" className="w-full">{attempt.questions.map((question) => <Card key={question.id} title={<><RichDocument document={question.prompt_doc} text={question.prompt} /><span>{question.points} คะแนน</span></>}>
      {(question.type === 'single_choice' || question.type === 'multiple_choice') && question.options.map((option) => <div key={option.id} className="top-space"><label><input type={question.type === 'single_choice' ? 'radio' : 'checkbox'} name={question.id} checked={(answers[question.id]?.option_ids ?? []).includes(option.id)} onChange={(event) => {
        if (question.type === 'single_choice') setAnswer(question.id, { option_ids: [option.id] });
        else { const selected = new Set(answers[question.id]?.option_ids ?? []); event.target.checked ? selected.add(option.id) : selected.delete(option.id); setAnswer(question.id, { option_ids: [...selected] }); }
      }} /> {option.text}</label></div>)}
      {question.type === 'essay' && <Input.TextArea rows={4} value={answers[question.id]?.text ?? ''} onChange={(event) => setAnswer(question.id, { text: event.target.value })} />}
      {question.type === 'image' && <Input value={answers[question.id]?.image_url ?? ''} placeholder="URL รูปคำตอบ" onChange={(event) => setAnswer(question.id, { image_url: event.target.value })} />}
    </Card>)}
    <Space><Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate({ attemptId, answers })}>บันทึกคำตอบ</Button><Button type="primary" loading={submitMutation.isPending} onClick={() => submitMutation.mutate({ attemptId, answers }, { onSuccess: (result) => navigate(`/learn/attempts/${attemptId}/result`) })}>ส่งคำตอบ</Button></Space>
    {(saveMutation.isError || submitMutation.isError) && <Alert type="error" message="บันทึกหรือส่งคำตอบไม่สำเร็จ ตรวจว่าตอบครบทุกข้อแล้วลองอีกครั้ง" />}</Space>
  </div>;
}

export function QuizResultPage() {
  const { attemptId = '' } = useParams(); const query = useAttempt(attemptId);
  if (query.isPending || query.isError) return <div className="public-page"><QueryState loading={query.isPending} error={query.isError} retry={() => void query.refetch()} /></div>;
  const attempt = query.data;
  return <div className="public-page"><PageTitle eyebrow={`ครั้งที่ ${attempt.number}`} title="ผลแบบฝึกหัด" />
    {attempt.status === 'pending_review' ? <Alert type="info" showIcon message="ส่งคำตอบแล้ว กำลังรอผู้สอนตรวจข้อเขียน" /> : <Card><Typography.Title level={3}>{attempt.earned}/{attempt.max} คะแนน</Typography.Title><Typography.Paragraph>{attempt.passed ? 'ผ่านเกณฑ์' : 'ยังไม่ผ่านเกณฑ์'}</Typography.Paragraph>{attempt.question_results?.map((result) => <p key={result.question_id}>ข้อ {result.question_id}: {result.score}/{result.max}{result.comment ? ` · ${result.comment}` : ''}</p>)}</Card>}
  </div>;
}

export function ServerCertificatesPage() {
  const query = useServerCertificates();
  if (query.isPending || query.isError) return <div className="public-page"><PageTitle eyebrow="บัญชีของฉัน" title="ใบรับรอง" /><QueryState loading={query.isPending} error={query.isError} retry={() => void query.refetch()} /></div>;
  return <div className="public-page"><PageTitle eyebrow="บัญชีของฉัน" title="ใบรับรอง" subtitle="ใบรับรองที่ออกให้จากผลการเรียนบน API จำลอง" />
    {query.data.length ? <List dataSource={query.data} renderItem={(certificate) => <List.Item actions={[<Link key="open" to={`/account/certificates/${certificate.id}`}>เปิดใบรับรอง</Link>] }><List.Item.Meta title={certificate.course_title} description={`${certificate.learner_name} · ${new Date(certificate.issued_at).toLocaleDateString('th-TH')}`} /></List.Item>} /> : <Empty description="ยังไม่มีใบรับรองที่ออกให้" />}
  </div>;
}

export function ServerCertificateDetailPage() {
  const { certificateId = '' } = useParams(); const query = useServerCertificate(certificateId);
  const download = useMutation({ mutationFn: () => certificateApi.download(certificateId), onSuccess: (file) => {
    const url = URL.createObjectURL(new Blob([file.content], { type: file.content_type }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } });
  if (query.isPending || query.isError) return <div className="public-page"><QueryState loading={query.isPending} error={query.isError} retry={() => void query.refetch()} /></div>;
  const certificate = query.data;
  return <div className="public-page"><PageTitle eyebrow="ใบรับรอง" title={certificate.course_title} actions={<Link to="/account/certificates"><Button>กลับไปใบรับรอง</Button></Link>} />
    <Card className="certificate-paper"><Typography.Text>CERTIFICATE OF COMPLETION</Typography.Text><Typography.Title level={2}>{certificate.learner_name}</Typography.Title><Typography.Paragraph>ผ่านการเรียนหลักสูตร {certificate.course_title}</Typography.Paragraph><Typography.Text>รหัส {certificate.code}</Typography.Text><br /><Typography.Text>{new Date(certificate.issued_at).toLocaleDateString('th-TH')}</Typography.Text><div className="top-space"><Button loading={download.isPending} onClick={() => download.mutate()}>ดาวน์โหลดใบรับรองตัวอย่าง</Button></div>{download.isError && <Alert className="top-space" type="error" message="ดาวน์โหลดใบรับรองไม่สำเร็จ" />}</Card>
  </div>;
}
