import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Empty, Form, Input, InputNumber, Popconfirm, Space, Table, Typography, message } from 'antd';
import type { TableProps } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLms } from '../../store';
import { RichDocument } from '../../components/chapter/RichTextEditor';
import { PageTitle, StatusTag } from '../../components/common';
import { WrittenAnswerView, writtenAnswer } from '../../components/WrittenAnswer';
import { UserAvatar } from '../../components/UserAvatar';
import { getReviewQueue } from '../../lib/assessment-review';
import type { Quiz, QuizAttempt } from '../../types';
import './grading-workspace.css';

const { Text } = Typography;

export function QuizManagerPage() {
  const { data, currentUser, removeQuiz } = useLms();
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId?: string }>();
  const myCourses = data.courses.filter(
    (course) => (currentUser?.role === 'admin' || course.instructorId === currentUser?.id) && (!courseId || course.id === courseId)
  );
  const quizzes = data.quizzes.filter((quiz) => myCourses.some((course) => course.id === quiz.courseId));

  const columns: TableProps<Quiz>['columns'] = [
    {
      title: 'แบบทดสอบ',
      render: (_, quiz) => (
        <div className="table-course-name">
          <strong>{quiz.title}</strong>
          <Text type="secondary">
            {quiz.questions.length} ข้อ · เกณฑ์ผ่าน {quiz.passPercent}%
          </Text>
        </div>
      ),
    },
    {
      title: 'คอร์ส',
      render: (_, quiz) => myCourses.find((course) => course.id === quiz.courseId)?.title,
    },
    {
      title: 'คำตอบ',
      render: (_, quiz) => data.attempts.filter((attempt) => attempt.quizId === quiz.id).length,
    },
    {
      title: 'จัดการ',
      render: (_, quiz) => (
        <Space>
          <Button onClick={() => navigate(`/teach/quizzes/${quiz.id}/attempts`)}>ดูคำตอบ</Button>
          <Button type="primary" onClick={() => navigate(`/teach/quizzes/${quiz.id}`)}>
            แก้ไข
          </Button>
          <Popconfirm
            title="ลบแบบทดสอบนี้หรือไม่"
            okText="ลบ"
            cancelText="ยกเลิก"
            onConfirm={() => {
              const result = removeQuiz(quiz.id);
              result.ok ? message.success('ลบแบบทดสอบแล้ว') : message.error(result.message);
            }}
          >
            <Button danger>ลบ</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageTitle
        eyebrow="ผู้สอน"
        title="แบบทดสอบและงานตรวจ"
        subtitle="แก้คำถาม ดูคำตอบ และตรวจงานข้อเขียนจากแบบทดสอบที่คุณสร้าง"
        actions={
          <Link to="/teach/courses">
            <Button>ไปยังคอร์ส</Button>
          </Link>
        }
      />
      <Table rowKey="id" dataSource={quizzes} columns={columns} pagination={{ pageSize: 8 }} locale={{ emptyText: 'ยังไม่มีแบบทดสอบในคอร์สของคุณ' }} />
    </>
  );
}

export { QuizEditorPage } from './QuizEditorPage';

export function QuizAttemptsPage() {
  const { quizId } = useParams<{ quizId?: string }>();
  const { data } = useLms();
  const quiz = data.quizzes.find((item) => item.id === quizId);
  const attempts = data.attempts.filter((attempt) => attempt.quizId === quizId && attempt.status === 'submitted');
  if (!quiz) return <Empty description="ไม่พบแบบทดสอบ" />;

  const columns: TableProps<QuizAttempt>['columns'] = [
    {
      title: 'ผู้เรียน',
      render: (_, attempt) => data.users.find((user) => user.id === attempt.userId)?.name,
    },
    {
      title: 'วันที่ส่ง',
      dataIndex: 'submittedAt',
      render: (date: string | undefined) => (date ? new Date(date).toLocaleDateString('th-TH') : '—'),
    },
    {
      title: 'คะแนนตัวเลือก',
      render: (_, attempt) => `${attempt.score ?? 0}/${attempt.maxChoice ?? 0}`,
    },
    {
      title: 'ข้อเขียน',
      render: (_, attempt) => (
        <StatusTag status={attempt.essayStatus === 'pending' ? 'pending' : attempt.essayStatus === 'graded' ? 'graded' : '—'} />
      ),
    },
    {
      title: '',
      render: (_, attempt) =>
        attempt.essayStatus === 'pending' ? (
          <Link to={`/teach/attempts/${attempt.id}/grade`}>
            <Button type="primary">ตรวจข้อเขียน</Button>
          </Link>
        ) : (
          <Text type="secondary">{attempt.finalPercent ?? attempt.percent}%</Text>
        ),
    },
  ];

  return (
    <>
      <PageTitle
        eyebrow="ผลแบบทดสอบ"
        title={quiz.title}
        subtitle="คำตอบข้อเขียนที่ยังไม่ตรวจจะแสดงไว้ก่อน"
        actions={
          <Link to={`/teach/quizzes/${quiz.id}`}>
            <Button>แก้แบบทดสอบ</Button>
          </Link>
        }
      />
      <Table rowKey="id" dataSource={attempts} columns={columns} pagination={{ pageSize: 10 }} locale={{ emptyText: 'ยังไม่มีผู้เรียนส่งคำตอบ' }} />
    </>
  );
}

export function GradeEssayPage() {
  const { attemptId } = useParams<{ attemptId?: string }>();
  const [search] = useSearchParams();
  const { data, currentUser } = useLms();
  const navigate = useNavigate();
  const attempt = data.attempts.find((item) => item.id === attemptId);
  const quiz = attempt?.quizSnapshot ?? data.quizzes.find((item) => item.id === attempt?.quizId);
  const returnTo = search.get('returnTo') || `/teach/quizzes/${quiz?.id}/attempts`;
  if (!attempt || !quiz || (currentUser?.role !== 'admin' && data.courses.find((entry) => entry.id === attempt.courseId)?.instructorId !== currentUser?.id)) return <Empty description="ไม่พบคำตอบนี้" />;
  if (attempt.essayStatus !== 'pending')
    return (
      <Alert
        type="info"
        showIcon
        message="คำตอบนี้ตรวจแล้ว"
        description={`ผลคะแนน ${attempt.finalPercent ?? attempt.percent}%`}
        action={<Button onClick={() => navigate(returnTo)}>กลับ</Button>}
      />
    );
  return <GradingWorkspace key={attempt.id} attempt={attempt} quiz={quiz} returnTo={returnTo} />;
}

interface GradingWorkspaceProps {
  attempt: QuizAttempt;
  quiz: Quiz;
  returnTo: string;
}

interface GradingFormValues {
  score?: number;
  feedback?: string;
}

function GradingWorkspace({ attempt, quiz, returnTo }: GradingWorkspaceProps) {
  const { data, currentUser, gradeAttempt } = useLms();
  const navigate = useNavigate();
  const [form] = Form.useForm<GradingFormValues>();
  const learner = data.users.find((item) => item.id === attempt.userId);
  const course = data.courses.find((item) => item.id === quiz.courseId);
  const questions = quiz.questions.filter((question) => question.type === 'essay');
  const hasImages = questions.some((question) => writtenAnswer(attempt.answers?.[question.id]).images.length > 0);
  const max = questions.reduce((sum, question) => sum + Number(question.points || 1), 0);
  const draftKey = `melearn-grading-draft:${currentUser?.id || 'anon'}:${attempt.id}`;
  const [initialDraft] = useState<GradingFormValues>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey) || '{}');
      return {
        score: typeof saved.score === 'number' && Number.isFinite(saved.score) ? saved.score : undefined,
        feedback: typeof saved.feedback === 'string' ? saved.feedback : '',
      };
    } catch {
      return { feedback: '' };
    }
  });
  const [dirty, setDirty] = useState(initialDraft.score !== undefined || Boolean(initialDraft.feedback));
  const [draftError, setDraftError] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const score = Form.useWatch('score', form);
  const validScore = typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= max;
  const totalMax = Number(attempt.maxChoice || 0) + max;

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);

  const preserveDraft = (_: unknown, values: GradingFormValues) => {
    setDirty(true);
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(values));
      setDraftError(false);
    } catch {
      setDraftError(true);
    }
  };
  const leave = (path: string) => {
    if (dirty && draftError && !window.confirm('ยังเก็บคะแนนและความคิดเห็นฉบับร่างไม่ได้ ต้องการออกและทิ้งข้อมูลที่กรอกหรือไม่?')) return;
    navigate(path);
  };
  const submit = (values: GradingFormValues) => {
    if (values.score === undefined) return;
    const result = gradeAttempt(attempt.id, { score: values.score, feedback: values.feedback });
    if (!result.ok) { message.error(result.message); return; }
    dirtyRef.current = false;
    try {
      sessionStorage.removeItem(draftKey);
    } catch {
      /* A stale draft is ignored for graded attempts. */
    }
    message.success('บันทึกคะแนนและความคิดเห็นแล้ว');
    navigate(returnTo);
  };

  const origin = new URL(returnTo, window.location.origin);
  const fromQueue = origin.pathname === '/teach/reviews';
  const queue = getReviewQueue(data, {
    instructorId: currentUser?.id,
    role: currentUser?.role || 'instructor',
    courseId: fromQueue ? origin.searchParams.get('course') || origin.searchParams.get('courseId') || undefined : undefined,
    quizId: fromQueue ? undefined : quiz.id,
  }).filter((entry) => {
    if (!fromQueue) return true;
    const mode = origin.searchParams.get('mode');
    if (mode && mode !== 'all' && entry.mode !== mode) return false;
    const term = (origin.searchParams.get('q') || '').toLowerCase();
    return !term || [entry.learner?.name, entry.quiz?.title, entry.course?.title].some((text) => text?.toLowerCase().includes(term));
  });
  const position = queue.findIndex((entry) => entry.id === attempt.id);
  const goToAttempt = (entry: (typeof queue)[number]) => leave(`/teach/attempts/${entry.id}/grade?returnTo=${encodeURIComponent(returnTo)}`);

  return (
    <div className="grading-workspace">
      <header className="grading-heading">
        <div>
          <span className="page-eyebrow">ตรวจคำตอบและภาพงาน</span>
          <h1>ตรวจงานผู้เรียน</h1>
          <p>
            {course?.title} · {quiz.title}
          </p>
        </div>
        <Button icon={<ArrowLeftOutlined aria-hidden="true" />} onClick={() => leave(returnTo)}>
          กลับรายการงาน
        </Button>
      </header>

      <div className="grading-context">
        <div className="grading-learner">
          <UserAvatar user={learner} size={44} />
          <div>
            <strong>{learner?.name || 'ผู้เรียน'}</strong>
            <span>{attempt.submittedAt ? `ส่งเมื่อ ${new Date(attempt.submittedAt).toLocaleString('th-TH')}` : 'ไม่ระบุเวลาส่ง'}</span>
          </div>
        </div>
        <div className="grading-navigation">
          {position >= 0 && <span>งาน {position + 1} จาก {queue.length} ในคิว</span>}
          <Button icon={<ArrowLeftOutlined aria-hidden="true" />} disabled={position <= 0} onClick={() => goToAttempt(queue[position - 1])}>
            งานก่อนหน้า
          </Button>
          <Button
            icon={<ArrowRightOutlined aria-hidden="true" />}
            disabled={position < 0 || position >= queue.length - 1}
            onClick={() => goToAttempt(queue[position + 1])}
          >
            งานถัดไป
          </Button>
        </div>
      </div>

      <div className="grading-workspace-layout">
        <section className="grading-answers" aria-labelledby="grading-answers-title">
          <div className="grading-section-heading">
            <h2 id="grading-answers-title">คำตอบของผู้เรียน</h2>
            <span>{questions.length} ข้อที่ต้องตรวจ</span>
          </div>
          {questions.map((question) => (
            <article className="grading-response" key={question.id}>
              <div className="grading-question-meta">
                <span>ข้อ {quiz.questions.findIndex((item) => item.id === question.id) + 1}</span>
                <span>คะแนนเต็ม {question.points} คะแนน</span>
              </div>
              {question.promptDoc ? <RichDocument document={question.promptDoc} /> : <h3>{question.prompt}</h3>}
              {question.rubric && (
                <div className="grading-rubric">
                  <strong>เกณฑ์ตรวจ</strong>
                  <p>{question.rubric}</p>
                </div>
              )}
              <div className="grading-answer-label">คำตอบที่ส่ง</div>
              <WrittenAnswerView value={attempt.answers?.[question.id]} />
            </article>
          ))}
          {hasImages && <p className="grading-image-hint">กดที่รูปภาพเพื่อขยายและซูมดูรายละเอียด</p>}
        </section>

        <aside className="grading-score-panel" aria-labelledby="grading-score-title">
          <h2 id="grading-score-title">ให้คะแนนและความคิดเห็น</h2>
          <p className="grading-panel-description">คะแนนรวมของข้อเขียนและภาพงาน {questions.length} ข้อ</p>
          <Form form={form} layout="vertical" initialValues={initialDraft} onFinish={submit} onValuesChange={preserveDraft}>
            <Form.Item
              name="score"
              label="คะแนนที่ให้"
              rules={[
                { required: true, message: 'กรอกคะแนนก่อนบันทึก' },
                { type: 'number', min: 0, max, message: `คะแนนต้องอยู่ระหว่าง 0 ถึง ${max}` },
              ]}
            >
              <InputNumber
                className="grading-score-input"
                aria-label="คะแนนที่ให้"
                min={0}
                max={max}
                suffix={<span>/ {max} คะแนน</span>}
                placeholder="ระบุคะแนน"
                controls={false}
              />
            </Form.Item>
            <Form.Item name="feedback" label="ความคิดเห็นถึงผู้เรียน">
              <Input.TextArea rows={7} placeholder="ระบุจุดที่ทำได้ดีและสิ่งที่ควรปรับปรุง" />
            </Form.Item>
            <div className="grading-score-summary">
              <div>
                <span>คะแนนเลือกตอบ</span>
                <strong>
                  {attempt.score ?? 0} / {attempt.maxChoice ?? 0}
                </strong>
              </div>
              <div>
                <span>คะแนนรวมหลังตรวจ</span>
                <strong>{validScore && score !== undefined ? `${Number(attempt.score || 0) + score} / ${totalMax}` : 'รอระบุคะแนน'}</strong>
              </div>
              <p>รวมคะแนนเพื่อตัดสินผลผ่านตามเกณฑ์ {quiz.passPercent}% และเงื่อนไขใบรับรองของคอร์ส</p>
            </div>
            {draftError && <Alert type="warning" showIcon title="เก็บฉบับร่างในแท็บนี้ไม่ได้ กรุณาบันทึกคะแนนก่อนออกจากหน้า" />}
            <div className="grading-submit-area">
              <span className="grading-draft-status" role="status">
                {dirty ? 'ยังไม่ได้บันทึกคะแนน' : 'ยังไม่ให้คะแนนงานนี้'}
              </span>
              {dirty && !draftError && <small>เก็บข้อมูลที่กรอกไว้เมื่อสลับงานในแท็บนี้</small>}
              <Button type="primary" block htmlType="submit">
                บันทึกคะแนนและความคิดเห็น
              </Button>
            </div>
          </Form>
        </aside>
      </div>
    </div>
  );
}
