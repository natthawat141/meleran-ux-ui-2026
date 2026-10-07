import React, { useEffect } from 'react';
import { Alert, Button, Empty, Form, Radio, Result, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined, SendOutlined } from '@ant-design/icons';
import { IconSparkles } from '@tabler/icons-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLms } from '../../store';
import { RichDocument } from '../../components/chapter/RichTextEditor';
import { PageTitle } from '../../components/common';
import { answerIsComplete, WrittenAnswerInput, WrittenAnswerView } from '../../components/WrittenAnswer';
import { assignmentIncludesLearner } from '../../lib/learning-history';
import type { QuizAnswerValue } from '../../types';
import './quiz-ai-entry.css';

const { Title, Text, Paragraph } = Typography;

export function QuizIntroPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { data, currentUser, startAttempt } = useLms();
  const [search] = useSearchParams();
  const assignmentId = search.get('assignmentId');
  const assignment = (data.assignments || []).find((entry) => entry.id === assignmentId);
  const quiz = data.quizzes.find((item) => item.id === quizId);

  if (!quiz) return <Empty description="ไม่พบแบบทดสอบ" />;

  if (assignmentId && (!assignment || assignment.status === 'cancelled' || assignment.quizId !== quiz.id || !assignmentIncludesLearner(assignment, currentUser?.id ?? ''))) return <Alert type="error" showIcon message="งานนี้ไม่ได้มอบหมายให้คุณหรือถูกยกเลิกแล้ว" />;
  const course = data.courses.find((item) => item.id === quiz.courseId);
  const enrolled = data.enrollments.some((entry) => entry.courseId === quiz.courseId && entry.userId === currentUser?.id);
  if (course && !enrolled && currentUser?.role !== 'admin') {
    return <Alert type="warning" showIcon message="แบบทดสอบเปิดหลังสมัครคอร์ส" action={<Link to={`/explore/courses/${course.slug}`}><Button size="small">ดูรายละเอียดและสมัคร</Button></Link>} />;
  }
  const courseItem = course?.chapters
    .flatMap((chapter) => chapter.items)
    .find((item) => 'quizId' in item && item.quizId === quiz.id);
  const latest = data.attempts.find(
    (attempt) =>
      attempt.quizId === quiz.id &&
      attempt.userId === data.currentUserId &&
      (attempt.assignmentId ?? null) === assignmentId &&
      attempt.status === 'submitted'
  );

  const start = () => {
    const draft = data.attempts.find(
      (attempt) =>
        attempt.quizId === quiz.id &&
        attempt.userId === data.currentUserId &&
        (attempt.assignmentId ?? null) === assignmentId &&
        attempt.status === 'in_progress'
    );
    const id = draft?.id ?? startAttempt(quiz, assignmentId);
    if (id) navigate(`/learn/attempts/${id}`);
  };

  return (
    <div className="quiz-intro">
      <Link to={`/learn/courses/${quiz.courseId}`}>
        <ArrowLeftOutlined /> {course?.title}
      </Link>
      <div className="quiz-intro-panel">
        <Tag color="processing">แบบทดสอบ</Tag>
        <Title>{assignment?.title ?? quiz.title}</Title>
        {assignment?.instructions && <Paragraph>{assignment.instructions}</Paragraph>}
        <Paragraph>
          ทบทวนสิ่งที่ได้เรียนรู้ในบทนี้ ส่งคำตอบเมื่อพร้อม
          ผู้สอนจะตรวจคำตอบข้อเขียนและแจ้งผลในระบบ
        </Paragraph>
        <div className="quiz-facts">
          <div>
            <CheckCircleOutlined />
            <span>{quiz.questions.length} ข้อ</span>
          </div>
          <div>
            <ClockCircleOutlined />
            <span>ทำได้ตามจังหวะของคุณ</span>
          </div>
          <div>
            <span className="pass-mark">{quiz.passPercent}%</span>
            <span>เกณฑ์ผ่าน</span>
          </div>
        </div>
        {latest && (
          <Alert
            className="top-space"
            type={
              latest.essayStatus === 'pending'
                ? 'warning'
                : latest.passed
                ? 'success'
                : 'info'
            }
            showIcon
            message={
              latest.essayStatus === 'pending'
                ? 'คำตอบข้อเขียนกำลังรอตรวจ'
                : latest.passed
                ? 'คุณผ่านแบบทดสอบแล้ว'
                : 'ส่งคำตอบแล้ว'
            }
            description={
              latest.essayStatus === 'pending'
                ? 'ผลคะแนนสุดท้ายจะแสดงหลังผู้สอนตรวจ'
                : `คะแนนล่าสุด ${latest.finalPercent ?? latest.percent ?? 0}%`
            }
          />
        )}
        <Button className="top-space" type="primary" size="large" onClick={start} disabled={Boolean(assignmentId && latest?.essayStatus === 'pending')}>
          {latest ? 'ทำแบบทดสอบอีกครั้ง' : 'เริ่มทำแบบทดสอบ'}
        </Button>
      </div>
    </div>
  );
}

export function QuizAttemptPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { data, currentUser, saveAttemptDraft, submitAttempt } = useLms();
  const attempt = data.attempts.find((item) => item.id === attemptId);
  const quiz = attempt?.quizSnapshot ?? data.quizzes.find((item) => item.id === attempt?.quizId);
  const [form] = Form.useForm<Record<string, QuizAnswerValue>>();

  useEffect(() => {
    if (attempt?.answers) {
      form.setFieldsValue(attempt.answers);
    }
  }, [attempt?.id, attempt?.answers, form]);

  if (!attempt || !quiz || attempt.userId !== currentUser?.id || attempt.status !== 'in_progress') {
    return (
      <Result
        status="404"
        title="ไม่พบแบบทดสอบที่กำลังทำ"
        extra={
          <Link to="/learn/courses">
            <Button type="primary">กลับไปคอร์สของฉัน</Button>
          </Link>
        }
      />
    );
  }

  const course = data.courses.find((entry) => entry.id === quiz.courseId);
  const courseItem = course?.chapters
    .flatMap((chapter) => chapter.items)
    .find((item) => 'quizId' in item && item.quizId === quiz.id);

  const finish = (values: Record<string, QuizAnswerValue>) => {
    const missingEssay = quiz.questions.some(
      (question) => question.type === 'essay' && !answerIsComplete(question, values[question.id])
    );
    if (missingEssay) return;
    const id = submitAttempt(quiz, values, attempt.id);
    if (id) navigate(`/learn/attempts/${id}/result`);
  };

  return (
    <div className="quiz-take">
      <Link to={`/learn/quizzes/${quiz.id}`}>
        <ArrowLeftOutlined /> ออกจากแบบทดสอบ
      </Link>
      <PageTitle
        eyebrow="แบบฝึกหัด"
        title={quiz.title}
        subtitle="ตอบทุกข้อก่อนส่ง คำตอบข้อเขียนและภาพงานจะส่งให้ผู้สอนตรวจ"
        actions={
          <div className="quiz-attempt-actions">
            <Link to={`/learn/ai?courseId=${encodeURIComponent(quiz.courseId)}&attemptId=${encodeURIComponent(attempt.id)}&quizId=${encodeURIComponent(quiz.id)}`}>
              <Button icon={<IconSparkles size={16} />}>ถาม Melearn AI</Button>
            </Link>
          </div>
        }
      />
      <Form
        form={form}
        layout="vertical"
        onValuesChange={(_, values) => saveAttemptDraft(attempt.id, values)}
        onFinish={finish}
        className="quiz-question-list"
      >
        {quiz.questions.map((question, index) => (
          <section className="question-panel" key={question.id} id={`question-${question.id}`}>
            <div className="question-title">
              <Tag>ข้อ {index + 1}</Tag>
              <Text type="secondary">
                {question.type === 'choice'
                  ? 'เลือกหนึ่งคำตอบ'
                  : question.responseMode === 'text'
                  ? 'ข้อเขียน'
                  : question.responseMode === 'image'
                  ? 'ส่งภาพงาน'
                  : 'ข้อเขียนหรือภาพงาน'}{' '}
                · {question.points} คะแนน
              </Text>
            </div>
            {question.promptDoc ? (
              <RichDocument document={question.promptDoc} />
            ) : (
              <Title level={4}>{question.prompt}</Title>
            )}
            <Link
              className="quiz-question-ai-link"
              to={`/learn/ai?courseId=${encodeURIComponent(quiz.courseId)}&attemptId=${encodeURIComponent(attempt.id)}&quizId=${encodeURIComponent(quiz.id)}&questionId=${encodeURIComponent(question.id)}`}
            >
              <IconSparkles size={15} /> ถาม AI เพื่อขอคำอธิบายหรือคำใบ้
            </Link>
            {question.type === 'choice' ? (
              <Form.Item
                name={question.id}
                rules={[{ required: true, message: 'เลือกคำตอบหนึ่งข้อ' }]}
              >
                <Radio.Group className="answer-options">
                  {question.options.map((option, optionIndex) => (
                    <Radio className="answer-option" value={optionIndex} key={option}>
                      {option}
                    </Radio>
                  ))}
                </Radio.Group>
              </Form.Item>
            ) : (
              <Form.Item
                name={question.id}
                rules={[
                  {
                    validator: (_, value) =>
                      answerIsComplete(question, value)
                        ? Promise.resolve()
                        : Promise.reject(
                            new Error(
                              question.responseMode === 'image'
                                ? 'แนบภาพงานก่อนส่ง'
                                : question.responseMode === 'text'
                                ? 'เขียนคำตอบก่อนส่ง'
                                : 'เขียนคำตอบหรือแนบภาพอย่างน้อยหนึ่งภาพ'
                            )
                          ),
                  },
                ]}
              >
                <WrittenAnswerInput mode={question.responseMode ?? 'either'} />
              </Form.Item>
            )}
          </section>
        ))}
        <div className="quiz-submit-row">
          <Text type="secondary">ส่งแล้วจะแก้คำตอบไม่ได้ในรอบนี้</Text>
          <Button type="primary" size="large" htmlType="submit" icon={<SendOutlined />}>
            ส่งคำตอบ
          </Button>
        </div>
      </Form>
    </div>
  );
}

export function QuizResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { data, currentUser } = useLms();
  const attempt = data.attempts.find((item) => item.id === attemptId);
  const quiz = attempt?.quizSnapshot ?? data.quizzes.find((item) => item.id === attempt?.quizId);

  if (!attempt || !quiz || attempt.userId !== currentUser?.id) return <Empty description="ไม่พบผลแบบทดสอบ" />;

  const pending = attempt.essayStatus === 'pending';
  const percent = attempt.finalPercent ?? attempt.percent ?? 0;
  const submittedWork = quiz.questions.filter((question) => question.type === 'essay');

  return (
    <div className="quiz-result">
      <Result
        status={pending ? 'info' : attempt.passed ? 'success' : 'warning'}
        title={
          pending
            ? 'ส่งคำตอบแล้ว รอผู้สอนตรวจ'
            : attempt.passed
            ? 'ผ่านแบบทดสอบแล้ว'
            : 'ยังไม่ถึงเกณฑ์ผ่าน'
        }
        subTitle={
          pending
            ? 'ข้อเขียนและภาพงานจะแสดงผลคะแนนเมื่อผู้สอนตรวจแล้ว'
            : `คะแนน ${percent}% · เกณฑ์ผ่าน ${quiz.passPercent}%`
        }
      />
      {pending && (
        <Alert
          showIcon
          type="info"
          message="งานของคุณอยู่ในคิวตรวจ"
          description="เมื่อผู้สอนบันทึกคะแนนและความคิดเห็น ผลสุดท้ายจะปรากฏที่นี่"
        />
      )}
      {attempt.essayStatus === 'graded' && (
        <Alert
          showIcon
          type={attempt.passed ? 'success' : 'info'}
          message={`คะแนนรวม ${attempt.totalScore} / ${attempt.maxScore}`}
          description={attempt.essayFeedback || 'ผู้สอนไม่ได้เพิ่มความคิดเห็น'}
        />
      )}
      <div className="submitted-work">
        {submittedWork.map((question) => (
          <section className="essay-response" key={question.id}>
            {question.promptDoc ? (
              <RichDocument document={question.promptDoc} />
            ) : (
              <h3>{question.prompt}</h3>
            )}
            <WrittenAnswerView value={attempt.answers[question.id]} />
          </section>
        ))}
      </div>
      <div className="quiz-result-actions">
        <Link to={`/learn/quizzes/${quiz.id}`}>
          <Button>กลับไปหน้าแบบทดสอบ</Button>
        </Link>
        <Link to={`/learn/courses/${quiz.courseId}`}>
          <Button type="primary">กลับไปคอร์ส</Button>
        </Link>
      </div>
    </div>
  );
}
