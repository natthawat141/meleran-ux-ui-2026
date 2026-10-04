import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Button, Drawer, Input, Select, Tag, Typography, type GetRef } from 'antd';
import {
  IconArrowLeft, IconArrowUp, IconBook2, IconMenu2, IconMessagePlus,
  IconSearch, IconSparkles, IconX,
} from '@tabler/icons-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLms } from '../../store';
import { AiResponse } from './AiResponse';
import {
  AI_MATH_DEMO_PROMPT, createAiThread, getDemoResponse, loadAiThreads, saveAiThreads,
  type AiContext, type AiMessage, type AiThread,
} from './ai-chat-model';
import './learner-ai.css';

const { Text } = Typography;
const prompts = [
  { text: AI_MATH_DEMO_PROMPT, icon: '∑' },
  { text: 'ช่วยสรุปบทเรียนที่กำลังเรียน', icon: '▤' },
  { text: 'ขอคำใบ้แบบฝึกหัดข้อนี้', icon: '✳' },
];

function makeTitle(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, 42) || 'แชตใหม่';
}

function LearnerAiWorkspace({ userId, query }: { userId: string; query: string }) {
  const { data } = useLms();
  const params = new URLSearchParams(query);
  const enrolledCourseIds = data.enrollments
    .filter((entry) => entry.userId === userId)
    .map((entry) => entry.courseId);
  const courses = data.courses.filter((course) => enrolledCourseIds.includes(course.id));
  const incomingAttemptId = params.get('attemptId') ?? undefined;
  const incomingQuestionId = params.get('questionId') ?? undefined;
  const incomingCourseId = params.get('courseId') ?? undefined;
  const incomingAttempt = data.attempts.find((item) => item.id === incomingAttemptId
    && item.userId === userId && item.status === 'in_progress');
  const incomingQuiz = incomingAttempt && data.quizzes.find((item) => item.id === incomingAttempt.quizId
    && item.courseId === incomingAttempt.courseId);
  const incomingAttemptIsEnrolled = Boolean(incomingAttempt && enrolledCourseIds.includes(incomingAttempt.courseId));
  const incomingQuestion = incomingAttemptIsEnrolled && incomingQuiz
    ? incomingQuiz.questions.find((item) => item.id === incomingQuestionId)
    : undefined;
  const incomingCourse = incomingAttemptIsEnrolled
    ? courses.find((course) => course.id === incomingAttempt?.courseId)
    : courses.find((course) => course.id === incomingCourseId);
  const incomingContext: AiContext = {
    ...(incomingCourse ? { courseId: incomingCourse.id } : {}),
    ...(incomingAttemptIsEnrolled && incomingAttempt ? { attemptId: incomingAttempt.id } : {}),
    ...(incomingQuestion && incomingQuiz ? {
      questionId: incomingQuestion.id,
      questionLabel: `ข้อ ${incomingQuiz.questions.indexOf(incomingQuestion) + 1} · ${incomingQuestion.prompt}`,
    } : {}),
  };

  const validateContext = (candidate: AiContext): AiContext => {
    const enrolledCourse = courses.find((item) => item.id === candidate.courseId);
    if (!enrolledCourse) return {};
    const validAttempt = data.attempts.find((item) => item.id === candidate.attemptId
      && item.userId === userId && item.status === 'in_progress'
      && item.courseId === enrolledCourse.id);
    if (!validAttempt) return { courseId: enrolledCourse.id };
    const validQuiz = data.quizzes.find((item) => item.id === validAttempt.quizId
      && item.courseId === validAttempt.courseId);
    const validQuestion = validQuiz?.questions.find((item) => item.id === candidate.questionId);
    return {
      courseId: enrolledCourse.id,
      attemptId: validAttempt.id,
      ...(validQuestion && validQuiz ? {
        questionId: validQuestion.id,
        questionLabel: `ข้อ ${validQuiz.questions.indexOf(validQuestion) + 1} · ${validQuestion.prompt}`,
      } : {}),
    };
  };

  const [initial] = useState(() => {
    const stored = userId ? loadAiThreads(userId) : [];
    const hasIncomingContext = Boolean(incomingContext.courseId || incomingContext.attemptId || incomingContext.questionId);
    const match = hasIncomingContext ? stored.find((thread) => {
      const candidate = validateContext(thread.context);
      return candidate.courseId === incomingContext.courseId
        && candidate.attemptId === incomingContext.attemptId
        && candidate.questionId === incomingContext.questionId;
    }) : undefined;
    const selected = match ?? (!hasIncomingContext ? stored[0] : undefined);
    const thread = selected ?? createAiThread(incomingContext);
    return { threads: selected ? stored : [thread, ...stored], activeId: thread.id };
  });
  const [threads, setThreads] = useState<AiThread[]>(initial.threads);
  const [activeId, setActiveId] = useState(initial.activeId);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<GetRef<typeof Input.TextArea>>(null);
  const active = threads.find((thread) => thread.id === activeId);
  const activeContext = active ? validateContext(active.context) : {};
  const activeAttempt = activeContext.attemptId
    ? data.attempts.find((item) => item.id === activeContext.attemptId && item.userId === userId && item.status === 'in_progress')
    : undefined;
  const activeCourse = courses.find((item) => item.id === activeContext.courseId);
  const returnToAttempt = activeAttempt
    ? `/learn/attempts/${activeAttempt.id}${activeContext.questionId ? `#question-${activeContext.questionId}` : ''}`
    : '';

  useEffect(() => {
    if (!threads.length || !userId) return;
    setStorageWarning(!saveAiThreads(userId, threads));
  }, [threads, userId]);

  useEffect(() => {
    if (active?.messages.length) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [active?.id, active?.messages.length]);

  const visibleThreads = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return [...threads]
      .filter((thread) => thread.messages.length > 0 || Boolean(thread.draft.trim()))
      .filter((thread) => !term || thread.title.toLocaleLowerCase().includes(term) || thread.messages.some((message) => message.blocks.some((block) => block.type === 'text' && block.text.toLocaleLowerCase().includes(term))))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [threads, search]);

  const updateActive = (updater: (thread: AiThread) => AiThread) => {
    setThreads((current) => current.map((thread) => thread.id === activeId ? updater(thread) : thread));
  };

  const newChat = () => {
    const thread = createAiThread(incomingContext);
    setThreads((current) => [thread, ...current]);
    setActiveId(thread.id);
    setDrawerOpen(false);
    window.setTimeout(() => inputRef.current?.focus(), 20);
  };

  const selectThread = (thread: AiThread) => {
    setActiveId(thread.id);
    setDrawerOpen(false);
  };

  const sendMessage = (raw?: string) => {
    const text = (raw ?? active?.draft ?? '').trim();
    if (!active || !text) return;
    const now = new Date().toISOString();
    const userMessage: AiMessage = { id: crypto.randomUUID(), role: 'user', blocks: [{ type: 'text', text }], createdAt: now };
    const assistantMessage: AiMessage = {
      id: crypto.randomUUID(), role: 'assistant', blocks: getDemoResponse(text, activeContext), createdAt: now,
    };
    updateActive((thread) => ({
      ...thread,
      title: thread.messages.length ? thread.title : makeTitle(text),
      updatedAt: now,
      draft: '',
      context: validateContext(thread.context),
      messages: [...thread.messages, userMessage, assistantMessage],
    }));
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !composing && !event.nativeEvent.isComposing) {
      event.preventDefault();
      sendMessage();
    }
  };

  const sidebar = (
    <div className="learn-ai-sidebar-inner">
      <Link to="/learn" className="learn-ai-brand" aria-label="Melearn AI กลับหน้าการเรียน">
        <img src={new URL('../../assets/melearn-ui/logo.PNG', import.meta.url).href} alt="" />
        <span>Melearn <b>AI</b></span>
      </Link>
      <Button className="learn-ai-new-chat" type="primary" block icon={<IconMessagePlus size={17} />} onClick={newChat}>แชตใหม่</Button>
      <Input
        className="learn-ai-search"
        allowClear
        prefix={<IconSearch size={17} />}
        placeholder="ค้นหาแชต"
        aria-label="ค้นหาประวัติแชต"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="learn-ai-history-label">ประวัติการสนทนา</div>
      <nav className="learn-ai-history" aria-label="ประวัติการสนทนา">
        {visibleThreads.length ? visibleThreads.map((thread) => (
          <button type="button" key={thread.id} className={`learn-ai-history-item ${thread.id === activeId ? 'active' : ''}`} onClick={() => selectThread(thread)}>
            <IconMessagePlus size={16} />
            <span>{thread.title}</span>
          </button>
        )) : <div className="learn-ai-history-empty">{search ? 'ไม่พบแชตที่ตรงกัน' : 'ยังไม่มีประวัติ'}</div>}
      </nav>
      <div className="learn-ai-sidebar-bottom">
        {activeAttempt && <Link className="learn-ai-return-attempt" to={returnToAttempt}><IconArrowLeft size={17} /> กลับไปทำแบบฝึกหัด</Link>}
        <Link className="learn-ai-back-learning" to="/learn"><IconBook2 size={17} /> กลับไปหน้าการเรียน</Link>
      </div>
    </div>
  );

  return (
    <main className="learn-ai-app">
      <aside className="learn-ai-sidebar">{sidebar}</aside>
      <Drawer className="learn-ai-mobile-drawer" placement="left" width={292} open={drawerOpen} onClose={() => setDrawerOpen(false)} closable={false}>
        <Button className="learn-ai-drawer-close" type="text" aria-label="ปิดเมนู" icon={<IconX size={20} />} onClick={() => setDrawerOpen(false)} />
        {sidebar}
      </Drawer>
      <section className="learn-ai-main" aria-label="Melearn AI">
        <header className="learn-ai-topbar">
          <Button className="learn-ai-menu-toggle" type="text" aria-label="เปิดเมนูแชต" icon={<IconMenu2 size={21} />} onClick={() => setDrawerOpen(true)} />
          <div className="learn-ai-topbar-title"><IconSparkles size={18} /><span>ผู้ช่วยการเรียน</span><Tag>เดโม</Tag></div>
          {courses.length > 0 && <Select aria-label="คอร์สที่กำลังเรียน" className="learn-ai-course-select" placeholder="เลือกคอร์ส" value={activeCourse?.id} options={courses.map((item) => ({ value: item.id, label: item.title }))} onChange={(courseId) => {
            const nextContext = activeAttempt?.courseId === courseId
              ? { ...activeContext, courseId }
              : { courseId };
            updateActive((thread) => ({ ...thread, context: nextContext }));
          }} />}
        </header>
        {activeAttempt && activeContext.questionLabel && <div className="learn-ai-context-strip"><IconBook2 size={15} /><span>แบบฝึกหัดที่กำลังทำ</span><b>{activeContext.questionLabel}</b><Link to={returnToAttempt}>กลับไปข้อสอบ</Link></div>}
        <div className="learn-ai-thread" ref={scrollRef}>
          {active?.messages.length ? (
            <div className="learn-ai-messages" aria-live="polite">
              {active.messages.map((message) => (
                <article className={`learn-ai-message ${message.role}`} key={message.id}>
                  {message.role === 'assistant' && <span className="learn-ai-message-mark"><IconSparkles size={16} /></span>}
                  <div className="learn-ai-message-body">
                    <Text className="learn-ai-message-author">{message.role === 'user' ? 'คุณ' : 'Melearn AI'}</Text>
                    <AiResponse blocks={message.blocks} />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="learn-ai-welcome">
              <div className="learn-ai-welcome-icon"><IconSparkles size={25} /></div>
              <h1>สวัสดี วันนี้อยากเรียนรู้อะไร?</h1>
              <p>เลือกตัวอย่างเพื่อดูรูปแบบคำตอบของ Melearn AI</p>
              <div className="learn-ai-starters">
                {prompts.map((prompt) => <button type="button" key={prompt.text} onClick={() => sendMessage(prompt.text)}><span className="learn-ai-starter-icon">{prompt.icon}</span><span>{prompt.text}</span><span className="learn-ai-starter-arrow">↗</span></button>)}
              </div>
            </div>
          )}
        </div>
        <div className="learn-ai-composer-dock">
          <div className="learn-ai-composer-wrap">
            <label htmlFor="learn-ai-composer" className="learn-ai-sr-only">พิมพ์คำถามถึง Melearn AI</label>
            <Input.TextArea
              id="learn-ai-composer"
              className="learn-ai-composer-input"
              ref={inputRef}
              value={active?.draft ?? ''}
              onChange={(event) => updateActive((thread) => ({ ...thread, draft: event.target.value }))}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={() => setComposing(false)}
              onKeyDown={onComposerKeyDown}
              placeholder={activeContext.questionLabel ? 'ถามเกี่ยวกับข้อนี้ หรือขอคำใบ้เพิ่ม…' : 'พิมพ์คำถามเกี่ยวกับบทเรียน…'}
              autoSize={{ minRows: 2, maxRows: 5 }}
            />
            <div className="learn-ai-composer-actions"><Text>Enter ส่ง · Shift + Enter ขึ้นบรรทัดใหม่</Text><Button type="primary" aria-label="ส่งคำถาม" icon={<IconArrowUp size={17} />} onClick={() => sendMessage()} disabled={!active?.draft.trim()} /></div>
          </div>
          <div className="learn-ai-demo-note"><IconSparkles size={14} /><span>โหมดตัวอย่าง · ยังไม่เชื่อมต่อ AI จริง</span></div>
          {storageWarning && <div className="learn-ai-storage-warning" role="status">บันทึกประวัติแชตในอุปกรณ์นี้ไม่สำเร็จ</div>}
        </div>
      </section>
    </main>
  );
}

export function LearnerAiPage() {
  const { data } = useLms();
  const [searchParams] = useSearchParams();
  const userId = data.currentUserId ?? '';
  const query = searchParams.toString();
  return <LearnerAiWorkspace key={`${userId}:${query}`} userId={userId} query={query} />;
}
