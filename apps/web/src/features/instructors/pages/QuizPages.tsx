import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Empty, Form, Input, InputNumber, Space, Table, Typography, message } from 'antd';
import type { TableProps } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useManagedData } from '../api/useManagedData';
import { PageTitle, RichDocument, StatusTag, UserAvatar, WrittenAnswerView, writtenAnswer } from '@melearn/ui';
import type { Course, Question, Quiz, QuizAttempt, Role, User } from '@melearn/contracts';
import '@melearn/ui/styles/grading-workspace.css';

const { Text } = Typography;
const LOCAL_ORIGIN = 'https://melearn.local';

export interface LmsData {
  courses: Course[];
  quizzes: Quiz[];
  attempts: QuizAttempt[];
  users: User[];
}

export function getGradingReturnTo(returnTo: string | null | undefined, fallbackQuizId?: string): string {
  const fallback = fallbackQuizId
    ? `/teach/quizzes/${encodeURIComponent(fallbackQuizId)}/attempts`
    : '/teach/quizzes';

  if (!returnTo?.startsWith('/') || returnTo.startsWith('//') || returnTo.includes('\\')) return fallback;

  try {
    const url = new URL(returnTo, LOCAL_ORIGIN);
    const isReviewQueue = url.pathname === '/teach/reviews';
    const isQuizAttempts = /^\/teach\/quizzes\/[^/]+\/attempts$/.test(url.pathname);
    if (url.origin !== LOCAL_ORIGIN || (!isReviewQueue && !isQuizAttempts)) return fallback;

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export interface ReviewQueueOptions {
  instructorId?: string;
  role?: Role;
  courseId?: string;
  quizId?: string;
  responseMode?: 'all' | 'text' | 'image' | string;
}

export interface ReviewQueueItem extends QuizAttempt {
  course?: Course;
  quiz?: Quiz;
  learner?: User;
  essayQuestions: Question[];
  mode: 'text' | 'image';
  ageDays: number;
  ageText: string;
}

export function getReviewQueue(data: LmsData, options: ReviewQueueOptions = {}): ReviewQueueItem[] {
  const { courseId, quizId, responseMode } = options;
  const instructorId = options.instructorId?.trim();
  if (options.role !== 'instructor' || !instructorId) return [];

  const courses = data.courses || [];
  const quizzes = data.quizzes || [];
  const attempts = data.attempts || [];
  const users = data.users || [];

  const ownedCourses = courses.filter((course: Course) => course.instructorId === instructorId);
  const ownedCoursesById = new Map<string, Course>(ownedCourses.map((course: Course) => [course.id, course]));
  const quizzesById = new Map<string, Quiz>(quizzes.map((quiz: Quiz) => [quiz.id, quiz]));

  const filtered = attempts.filter((attempt: QuizAttempt) => {
    if (attempt.status !== 'submitted') return false;
    if (attempt.essayStatus !== 'pending') return false;
    const course = ownedCoursesById.get(attempt.courseId);
    const quiz = quizzesById.get(attempt.quizId);
    if (!course || !quiz || quiz.courseId !== course.id) return false;
    if (courseId && attempt.courseId !== courseId) return false;
    if (quizId && attempt.quizId !== quizId) return false;
    return true;
  });

  const enriched: ReviewQueueItem[] = filtered.map((attempt: QuizAttempt) => {
    const course = courses.find((item: Course) => item.id === attempt.courseId);
    const quiz = quizzes.find((item: Quiz) => item.id === attempt.quizId);
    const learner = users.find((item: User) => item.id === attempt.userId);
    const essayQuestions = (quiz?.questions || []).filter((question: Question) => question.type === 'essay');

    let mode: 'text' | 'image' = 'text';
    const hasImage = Object.values(attempt.answers || {}).some((answer: unknown) => {
      if (typeof answer === 'object' && answer !== null) {
        const answerObject = answer as { image?: string; images?: unknown[] };
        if (answerObject.image || (Array.isArray(answerObject.images) && answerObject.images.length > 0)) {
          return true;
        }
      }
      return typeof answer === 'string' && answer.startsWith('data:image');
    });
    if (hasImage) mode = 'image';

    const submittedDate = attempt.submittedAt ? new Date(attempt.submittedAt) : new Date();
    const ageDays = Math.max(0, Math.floor((Date.now() - submittedDate.getTime()) / (1000 * 60 * 60 * 24)));
    const ageHours = Math.max(0, Math.floor((Date.now() - submittedDate.getTime()) / (1000 * 60 * 60)));

    let ageText = 'เพิ่งส่งมา';
    if (ageDays >= 1) ageText = `${ageDays} วันที่แล้ว`;
    else if (ageHours >= 1) ageText = `${ageHours} ชั่วโมงที่แล้ว`;

    return {
      ...attempt,
      course,
      quiz,
      learner,
      essayQuestions,
      mode,
      ageDays,
      ageText,
    };
  });

  const filteredByMode =
    responseMode && responseMode !== 'all' ? enriched.filter((item) => item.mode === responseMode) : enriched;

  return filteredByMode.sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());
}

export function QuizAttemptsPage() {
  const { quizId } = useParams<{ quizId?: string }>();
  const { data, currentUser } = useManagedData('attempts');
  const quiz = data.quizzes.find((item) => item.id === quizId);
  const attempts = data.attempts.filter((attempt) => attempt.quizId === quizId && attempt.status === 'submitted');
  if (!quiz) return <Empty description="ไม่พบแบบทดสอบ" />;
  const isInstructorOwner =
    currentUser?.role === 'instructor' &&
    data.courses.some((course) => course.id === quiz.courseId && course.instructorId === currentUser.id);

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
        attempt.essayStatus === 'pending' && isInstructorOwner ? (
          <Link to={`/teach/attempts/${attempt.id}/grade`}>
            <Button type="primary">ตรวจข้อเขียน</Button>
          </Link>
        ) : (
          <Text type="secondary">
            {attempt.essayStatus === 'pending' ? 'รอผู้สอนตรวจ' : `${attempt.finalPercent ?? attempt.percent}%`}
          </Text>
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
  const { data, currentUser } = useManagedData('grade');
  const navigate = useNavigate();
  const attempt = data.attempts.find((item) => item.id === attemptId);
  const quiz = attempt?.quizSnapshot ?? data.quizzes.find((item) => item.id === attempt?.quizId);
  const returnTo = getGradingReturnTo(search.get('returnTo'), quiz?.id);
  const ownsCourse =
    currentUser?.role === 'instructor' &&
    data.courses.some((course) => course.id === attempt?.courseId && course.instructorId === currentUser.id);
  if (!attempt || !quiz || !ownsCourse) return <Empty description="ไม่พบคำตอบนี้" />;
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
  scores?: Record<string,number>;
  feedback?: string;
}

function GradingWorkspace({ attempt, quiz, returnTo }: GradingWorkspaceProps) {
  const { data, currentUser, gradeAttempt, attempt: wireAttempt } = useManagedData('grade');
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
        scores: {...(saved.scores&&typeof saved.scores==='object'?saved.scores:{}),...Object.fromEntries(Object.entries(wireAttempt?.grades??{}).map(([id,g])=>[id,g.score]))},
        feedback: typeof saved.feedback === 'string' ? saved.feedback : '',
      };
    } catch {
      return { feedback: '' };
    }
  });
  const [dirty, setDirty] = useState(Boolean(initialDraft.scores && Object.keys(initialDraft.scores).length) || Boolean(initialDraft.feedback));
  const [draftError, setDraftError] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const scores = Form.useWatch('scores', form) as Record<string,number> | undefined;
  const score = Object.values(scores??{}).reduce((n,x)=>n+Number(x||0),0);
  const validScore = questions.every(q=>typeof scores?.[q.id]==='number' && scores[q.id]>=0 && scores[q.id]<=q.points);
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
  const submit = async (values: GradingFormValues) => {
    if (!values.scores) return;
    const result = await gradeAttempt(attempt.id, { scores: values.scores, feedback: values.feedback });
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
          <p className="grading-panel-description">ให้คะแนนแต่ละข้อของข้อเขียนและภาพงาน {questions.length} ข้อ</p>
          <Form form={form} layout="vertical" initialValues={initialDraft} onFinish={submit} onValuesChange={preserveDraft}>
            {questions.map((question,index) => <Form.Item key={question.id} name={['scores',question.id]} label={`ข้อ ${index+1} · ${question.points} คะแนน`} rules={[{required:true,message:'ระบุคะแนนข้อนี้'},{type:'number',min:0,max:question.points,message:'คะแนนเกินช่วงที่กำหนด'}]}>
              <InputNumber min={0} max={question.points} step={0.5} disabled={Boolean(wireAttempt?.grades[question.id])} aria-label={`คะแนนข้อ ${index+1}`} />
            </Form.Item>)}
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
              <p>รวมคะแนนเพื่อตัดสินผลผ่านตามเกณฑ์มากกว่า {quiz.passPercent}% และเงื่อนไขใบรับรองของคอร์ส</p>
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
