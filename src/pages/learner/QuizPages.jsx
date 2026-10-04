import React, { useEffect } from 'react';
import { Alert, Button, Empty, Form, Input, Progress, Radio, Result, Space, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined, SendOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLms } from '../../store.jsx';
import { RichDocument } from '../../components/chapter/RichTextEditor.jsx';
import { PageTitle } from '../../components/common.jsx';
import { answerIsComplete, WrittenAnswerInput, WrittenAnswerView } from '../../components/WrittenAnswer.jsx';

const { Title, Text, Paragraph } = Typography;

export function QuizIntroPage() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { data, currentUser, startAttempt } = useLms();
  const quiz = data.quizzes.find((item) => item.id === quizId);
  if (!quiz) return <Empty description="ไม่พบแบบทดสอบ"/>;
  const assignmentId = search.get('assignmentId');
  const assignment = assignmentId ? data.assignments.find((entry) => entry.id === assignmentId) : null;
  const isAssignedLearner = assignment && assignment.status === 'active' && assignment.quizId === quiz.id && assignment.learnerIds.includes(currentUser?.id) && data.enrollments.some((entry) => entry.courseId === quiz.courseId && entry.userId === currentUser?.id);
  if (assignmentId && !isAssignedLearner) return <Result status="403" title="คุณไม่มีสิทธิ์ทำงานนี้" subTitle="งานนี้อาจถูกยกเลิก หรือไม่ได้มอบหมายให้บัญชีของคุณ" extra={<Link to="/learn/assignments"><Button type="primary">กลับไปงานของฉัน</Button></Link>}/>;
  const course = data.courses.find((item) => item.id === quiz.courseId);
  const isThisAssignment = (attempt) => attempt.quizId === quiz.id && attempt.userId === currentUser?.id && (attempt.assignmentId ?? null) === (assignmentId || null);
  const latest = data.attempts.find((attempt) => isThisAssignment(attempt) && attempt.status === 'submitted');
  const start = () => {
    const draft = data.attempts.find((attempt) => isThisAssignment(attempt) && attempt.status === 'in_progress');
    const id = draft?.id ?? startAttempt(quiz, assignmentId);
    if (id) navigate(`/learn/attempts/${id}`);
  };
  const draft = data.attempts.find((attempt) => isThisAssignment(attempt) && attempt.status === 'in_progress');
  const waitingForGrade = assignmentId && latest?.essayStatus === 'pending';
  return <div className="quiz-intro"><Link to={assignmentId ? '/learn/assignments' : `/learn/courses/${quiz.courseId}`}><ArrowLeftOutlined /> {assignmentId ? 'กลับไปงานของฉัน' : course?.title}</Link><div className="quiz-intro-panel"><Tag color="processing">{assignmentId ? 'งานที่ได้รับมอบหมาย' : 'แบบทดสอบ'}</Tag><Title>{assignment?.title ?? quiz.title}</Title><Paragraph>{assignment?.instructions || 'ทบทวนสิ่งที่ได้เรียนรู้ในบทนี้ ส่งคำตอบเมื่อพร้อม ผู้สอนจะตรวจคำตอบข้อเขียนและแจ้งผลในระบบ'}</Paragraph><div className="quiz-facts"><div><CheckCircleOutlined/><span>{quiz.questions.length} ข้อ</span></div><div><ClockCircleOutlined/><span>ทำได้ตามจังหวะของคุณ</span></div><div><span className="pass-mark">{quiz.passPercent}%</span><span>เกณฑ์ผ่าน</span></div></div>{latest && <Alert className="top-space" type={latest.essayStatus === 'pending' ? 'warning' : latest.passed ? 'success' : 'info'} showIcon message={latest.essayStatus === 'pending' ? 'คำตอบข้อเขียนกำลังรอตรวจ' : latest.passed ? 'คุณผ่านแบบทดสอบแล้ว' : 'ส่งคำตอบแล้ว'} description={latest.essayStatus === 'pending' ? 'เริ่มรอบใหม่ได้หลังผู้สอนตรวจคำตอบนี้' : `คะแนนล่าสุด ${latest.finalPercent ?? latest.percent ?? 0}%`}/>}<Button className="top-space" type="primary" size="large" onClick={start} disabled={Boolean(waitingForGrade)}>{draft ? 'ทำต่อจากฉบับร่าง' : latest ? 'เริ่มรอบใหม่' : 'เริ่มทำแบบทดสอบ'}</Button>{assignmentId && latest && !waitingForGrade && <Text className="assignment-retry-note" type="secondary">จำนวนครั้งที่อนุญาตจริงยังไม่กำหนด; การเริ่มรอบใหม่ในหน้านี้เป็นการจำลอง</Text>}</div></div>;
}

export function QuizAttemptPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { data, currentUser, saveAttemptDraft, submitAttempt } = useLms();
  const attempt = data.attempts.find((item) => item.id === attemptId);
  const quiz = attempt?.quizSnapshot ?? data.quizzes.find((item) => item.id === attempt?.quizId);
  const [form] = Form.useForm();
  useEffect(() => { if (attempt?.answers) form.setFieldsValue(attempt.answers); }, [attempt?.id]);
  if (!attempt || !quiz || attempt.userId !== currentUser?.id || attempt.status !== 'in_progress') return <Result status="404" title="ไม่พบแบบทดสอบที่กำลังทำ" extra={<Link to="/learn/assignments"><Button type="primary">กลับไปงานของฉัน</Button></Link>}/>;
  const finish = (values) => {
    const missingEssay = quiz.questions.some((question) => question.type === 'essay' && !answerIsComplete(question, values[question.id]));
    if (missingEssay) return;
    const submittedId = submitAttempt(quiz, values, attempt.id);
    if (submittedId) navigate(`/learn/attempts/${submittedId}/result`);
  };
  return <div className="quiz-take"><Link to={`/learn/quizzes/${quiz.id}`}><ArrowLeftOutlined/> ออกจากแบบทดสอบ</Link><PageTitle eyebrow="แบบฝึกหัด" title={quiz.title} subtitle="ตอบทุกข้อก่อนส่ง คำตอบข้อเขียนและภาพงานจะส่งให้ผู้สอนตรวจ"/>
    <Form form={form} layout="vertical" onValuesChange={(_, values) => saveAttemptDraft(attempt.id, values)} onFinish={finish} className="quiz-question-list">
      {quiz.questions.map((question, index) => <section className="question-panel" key={question.id}>
        <div className="question-title"><Tag>ข้อ {index + 1}</Tag><Text type="secondary">{question.type === 'choice' ? 'เลือกหนึ่งคำตอบ' : question.responseMode === 'text' ? 'ข้อเขียน' : question.responseMode === 'image' ? 'ส่งภาพงาน' : 'ข้อเขียนหรือภาพงาน'} · {question.points} คะแนน</Text></div>{question.promptDoc ? <RichDocument document={question.promptDoc}/> : <Title level={4}>{question.prompt}</Title>}
        {question.type === 'choice' ? <Form.Item name={question.id} rules={[{ required: true, message: 'เลือกคำตอบหนึ่งข้อ' }]}><Radio.Group className="answer-options">{question.options.map((option, optionIndex) => <Radio className="answer-option" value={optionIndex} key={option}>{option}</Radio>)}</Radio.Group></Form.Item> : <Form.Item name={question.id} rules={[{ validator: (_, value) => answerIsComplete(question, value) ? Promise.resolve() : Promise.reject(new Error(question.responseMode === 'image' ? 'แนบภาพงานก่อนส่ง' : question.responseMode === 'text' ? 'เขียนคำตอบก่อนส่ง' : 'เขียนคำตอบหรือแนบภาพอย่างน้อยหนึ่งภาพ')) }]}><WrittenAnswerInput mode={question.responseMode ?? 'either'}/></Form.Item>}
      </section>)}
      <div className="quiz-submit-row"><Text type="secondary">ส่งแล้วจะแก้คำตอบไม่ได้ในรอบนี้</Text><Button type="primary" size="large" htmlType="submit" icon={<SendOutlined/>}>ส่งคำตอบ</Button></div>
    </Form>
  </div>;
}

export function QuizResultPage() {
  const { attemptId } = useParams();
  const { data, currentUser } = useLms();
  const attempt = data.attempts.find((item) => item.id === attemptId);
  const quiz = attempt?.quizSnapshot ?? data.quizzes.find((item) => item.id === attempt?.quizId);
  if (!attempt || !quiz || attempt.userId !== currentUser?.id) return <Empty description="ไม่พบผลแบบทดสอบ"/>;
  const pending = attempt.essayStatus === 'pending';
  const percent = attempt.finalPercent ?? attempt.percent ?? 0;
  const submittedWork = quiz.questions.filter((question) => question.type === 'essay');
  return <div className="quiz-result"><Result status={pending ? 'info' : attempt.passed ? 'success' : 'warning'} title={pending ? 'ส่งคำตอบแล้ว รอผู้สอนตรวจ' : attempt.passed ? 'ผ่านแบบทดสอบแล้ว' : 'ยังไม่ถึงเกณฑ์ผ่าน'} subTitle={pending ? 'ข้อเขียนและภาพงานจะแสดงผลคะแนนเมื่อผู้สอนตรวจแล้ว' : `คะแนน ${percent}% · เกณฑ์ผ่าน ${quiz.passPercent}%`}/>{pending && <Alert showIcon type="info" message="งานของคุณอยู่ในคิวตรวจ" description="เมื่อผู้สอนบันทึกคะแนนและความคิดเห็น ผลสุดท้ายจะปรากฏที่นี่"/>}{attempt.essayStatus === 'graded' && <Alert showIcon type={attempt.passed ? 'success' : 'info'} message={`คะแนนรวม ${attempt.totalScore} / ${attempt.maxScore}`} description={attempt.essayFeedback || 'ผู้สอนไม่ได้เพิ่มความคิดเห็น'}/>}<div className="submitted-work">{submittedWork.map((question) => { const grade = attempt.questionGrades?.find((entry) => entry.questionId === question.id); return <section className="essay-response" key={question.id}>{question.promptDoc ? <RichDocument document={question.promptDoc}/> : <h3>{question.prompt}</h3>}<WrittenAnswerView value={attempt.answers[question.id]}/>{grade && <Alert className="top-space" type="info" message={`คะแนนข้อนี้ ${grade.score} / ${grade.maxScore}`} description={grade.feedback || 'ผู้สอนไม่ได้เพิ่มความเห็นรายข้อ'}/>}</section>; })}</div><div className="quiz-result-actions"><Link to={attempt.assignmentId ? '/learn/assignments' : `/learn/quizzes/${quiz.id}`}><Button>{attempt.assignmentId ? 'กลับไปงานของฉัน' : 'กลับไปหน้าแบบทดสอบ'}</Button></Link><Link to={`/learn/courses/${quiz.courseId}`}><Button type="primary">กลับไปคอร์ส</Button></Link></div></div>;
}
