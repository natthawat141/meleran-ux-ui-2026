import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Button, Drawer, Input, Modal, Select, Tag, Typography, type GetRef } from 'antd';
import { ActionIcon, Button as MantineButton, Menu, NavLink, Stack, Text as MantineText } from '@mantine/core';
import {
  IconArrowLeft, IconArrowUp, IconArrowUpRight, IconBook2, IconBrain, IconBulb,
  IconDots, IconHome2, IconInfoCircle, IconMathFunction, IconMenu2,
  IconMessageChatbot, IconMessagePlus, IconNotes, IconPencil, IconSearch, IconTrash, IconX,
} from '@tabler/icons-react';
import { Link, useSearchParams } from 'react-router-dom';
import logo from '../../assets/melearn-ui/logo.PNG';
import { useLms } from '../../store';
import { AiResponse } from './AiResponse';
import {
  AI_MATH_DEMO_PROMPT, createAiThread, getDemoResponse, loadAiThreads, saveAiThreads,
  type AiContext, type AiMessage, type AiThread,
} from './ai-chat-model';
import './learner-ai.css';

const { Text } = Typography;
const prompts = [
  { text: AI_MATH_DEMO_PROMPT, icon: <IconMathFunction size={17} aria-hidden="true" /> },
  { text: 'ช่วยสรุปบทเรียนที่กำลังเรียน', icon: <IconNotes size={17} aria-hidden="true" /> },
  { text: 'ขอคำใบ้แบบฝึกหัดข้อนี้', icon: <IconBulb size={17} aria-hidden="true" /> },
];

function BrandLogo({ className = '' }: { className?: string }) {
  return <span className={`brand-logo-crop learn-ai-logo-crop ${className}`} aria-hidden="true"><img src={logo} alt="" width="1920" height="1080" /></span>;
}

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
  const [renameThreadId, setRenameThreadId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [deleteThreadId, setDeleteThreadId] = useState<string | null>(null);
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
      .filter((thread) => thread.messages.length > 0 || Boolean(thread.draft.trim()) || thread.titleEdited === true)
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

  const beginRename = (thread: AiThread) => {
    setRenameThreadId(thread.id);
    setRenameTitle(thread.title);
  };

  const saveThreadTitle = () => {
    const title = renameTitle.trim();
    if (!renameThreadId || !title) return;
    const updatedAt = new Date().toISOString();
    setThreads((current) => current.map((thread) => thread.id === renameThreadId
      ? { ...thread, title, titleEdited: true, updatedAt }
      : thread));
    setRenameThreadId(null);
  };

  const deleteThread = (threadId: string) => {
    let remaining = threads.filter((thread) => thread.id !== threadId);
    if (!remaining.length) remaining = [createAiThread(incomingContext)];
    const latest = [...remaining].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    setThreads(remaining);
    if (activeId === threadId && latest) setActiveId(latest.id);
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
      title: thread.titleEdited || thread.messages.length ? thread.title : makeTitle(text),
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
      <Link to="/learn" className="learn-ai-brand" aria-label="Melearn AI หน้าหลัก">
        <BrandLogo className="learn-ai-brand-logo-img" />
        <span>Melearn <b>AI</b></span>
      </Link>
      <MantineButton className="learn-ai-new-chat" fullWidth leftSection={<IconMessagePlus size={17} aria-hidden="true" />} onClick={newChat}>แชตใหม่</MantineButton>
      <Input
        className="learn-ai-search"
        allowClear
        prefix={<IconSearch size={17} />}
        placeholder="ค้นหาแชต"
        aria-label="ค้นหาประวัติแชต"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <MantineText className="learn-ai-history-label" size="xs" fw={700} tt="uppercase" c="dimmed" lts={1.2}>ประวัติการสนทนา</MantineText>
      <Stack component="nav" className="learn-ai-history" gap={5} aria-label="ประวัติการสนทนา">
        {visibleThreads.length ? visibleThreads.map((thread) => (
          <div className="learn-ai-history-row" key={thread.id}>
            <NavLink
              component="button"
              type="button"
              className="learn-ai-history-item"
              active={thread.id === activeId}
              aria-current={thread.id === activeId ? 'page' : undefined}
              aria-label={thread.title}
              label={thread.title}
              leftSection={<IconMessagePlus size={17} aria-hidden="true" />}
              onClick={() => selectThread(thread)}
            />
            <Menu position="bottom-end" shadow="md" width={164} withinPortal zIndex={1100}>
              <Menu.Target>
                <ActionIcon className="learn-ai-thread-menu-trigger" variant="subtle" color="gray" size={32} aria-label={`ตัวเลือกแชต ${thread.title}`}>
                  <IconDots size={18} aria-hidden="true" />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconPencil size={16} aria-hidden="true" />} onClick={() => beginRename(thread)}>เปลี่ยนชื่อ</Menu.Item>
                <Menu.Item color="red" leftSection={<IconTrash size={16} aria-hidden="true" />} onClick={() => setDeleteThreadId(thread.id)}>ลบแชต</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </div>
        )) : <div className="learn-ai-history-empty">{search ? 'ไม่พบแชตที่ตรงกัน' : 'ยังไม่มีประวัติ'}</div>}
      </Stack>
      <div className="learn-ai-sidebar-bottom">
        {activeAttempt && <NavLink component={Link} to={returnToAttempt} className="learn-ai-return-attempt" label="กลับไปทำแบบฝึกหัด" leftSection={<IconArrowLeft size={17} aria-hidden="true" />} />}
        <NavLink component={Link} to="/learn" className="learn-ai-back-learning" label="กลับไปหน้าหลัก" leftSection={<IconHome2 size={17} aria-hidden="true" />} />
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
          <div className="learn-ai-topbar-title"><IconBrain size={18} aria-hidden="true" /><span>ผู้ช่วยการเรียน</span><Tag>เดโม</Tag></div>
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
                  {message.role === 'assistant' && <span className="learn-ai-message-mark"><IconMessageChatbot size={17} aria-hidden="true" /></span>}
                  <div className="learn-ai-message-body">
                    <Text className="learn-ai-message-author">{message.role === 'user' ? 'คุณ' : 'Melearn AI'}</Text>
                    <AiResponse blocks={message.blocks} />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="learn-ai-welcome">
              <BrandLogo className="learn-ai-welcome-logo" />
              <h1>สวัสดี วันนี้อยากเรียนรู้อะไร?</h1>
              <p>เลือกตัวอย่างเพื่อดูรูปแบบคำตอบของ Melearn AI</p>
              <div className="learn-ai-starters">
                {prompts.map((prompt) => <button type="button" key={prompt.text} onClick={() => sendMessage(prompt.text)}><span className="learn-ai-starter-icon">{prompt.icon}</span><span>{prompt.text}</span><IconArrowUpRight className="learn-ai-starter-arrow" size={16} aria-hidden="true" /></button>)}
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
          <div className="learn-ai-demo-note"><IconInfoCircle size={14} aria-hidden="true" /><span>โหมดตัวอย่าง · ยังไม่เชื่อมต่อ AI จริง</span></div>
          {storageWarning && <div className="learn-ai-storage-warning" role="status">บันทึกประวัติแชตในอุปกรณ์นี้ไม่สำเร็จ</div>}
        </div>
      </section>
      <Modal
        zIndex={1200}
        title="เปลี่ยนชื่อแชต"
        open={Boolean(renameThreadId)}
        okText="บันทึกชื่อ"
        cancelText="ยกเลิก"
        okButtonProps={{ disabled: !renameTitle.trim() }}
        onOk={saveThreadTitle}
        onCancel={() => setRenameThreadId(null)}
      >
        <Input
          autoFocus
          aria-label="ชื่อแชตใหม่"
          maxLength={80}
          value={renameTitle}
          onChange={(event) => setRenameTitle(event.target.value)}
          onPressEnter={saveThreadTitle}
        />
      </Modal>
      <Modal
        zIndex={1200}
        title="ลบแชตนี้หรือไม่?"
        open={Boolean(deleteThreadId)}
        okText="ลบแชต"
        cancelText="ยกเลิก"
        okButtonProps={{ danger: true }}
        onOk={() => {
          if (deleteThreadId) deleteThread(deleteThreadId);
          setDeleteThreadId(null);
        }}
        onCancel={() => setDeleteThreadId(null)}
      >
        ประวัติ “{threads.find((thread) => thread.id === deleteThreadId)?.title ?? ''}” และข้อความทั้งหมดจะถูกลบจากอุปกรณ์นี้
      </Modal>
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
