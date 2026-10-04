import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Button, Drawer, Input, Modal, Typography, type GetRef } from 'antd';
import { ActionIcon, Menu, NavLink, Stack, Text as MantineText, Tooltip } from '@mantine/core';
import {
  IconArrowLeft, IconArrowUp, IconArrowUpRight, IconBook2, IconBulb,
  IconDots, IconHome2, IconInfoCircle, IconMathFunction, IconLayoutSidebar,
  IconMessageChatbot, IconNotes, IconPencil, IconSearch, IconTrash, IconX,
} from '@tabler/icons-react';
import { Link, useSearchParams } from 'react-router-dom';
import logo from '../../assets/melearn-ui/logo.PNG';
import { useLms } from '../../store';
import { AiResponse } from './AiResponse';
import { findCourseCommand, removeCourseCommand } from './ai-course-command';
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [renameThreadId, setRenameThreadId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [deleteThreadId, setDeleteThreadId] = useState<string | null>(null);
  const [composerFocused, setComposerFocused] = useState(false);
  const [composerCaret, setComposerCaret] = useState(0);
  const [courseOptionIndex, setCourseOptionIndex] = useState(0);
  const [dismissedCommand, setDismissedCommand] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<GetRef<typeof Input.TextArea>>(null);
  const active = threads.find((thread) => thread.id === activeId);
  const activeContext = active ? validateContext(active.context) : {};
  const activeAttempt = activeContext.attemptId
    ? data.attempts.find((item) => item.id === activeContext.attemptId && item.userId === userId && item.status === 'in_progress')
    : undefined;
  const activeCourse = courses.find((item) => item.id === activeContext.courseId);
  const commandKey = `${activeId}:${active?.draft}:${composerCaret}`;
  const courseCommand = composerFocused && !composing && dismissedCommand !== commandKey
    ? findCourseCommand(active?.draft ?? '', composerCaret)
    : null;
  const matchingCourses = courseCommand
    ? courses.filter((course) => course.title.toLocaleLowerCase().includes(courseCommand.query))
    : [];
  const highlightedCourseIndex = Math.min(courseOptionIndex, Math.max(0, matchingCourses.length - 1));
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
    if (!raw && courseCommand) return;
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

  const chooseCourse = (courseId: string) => {
    if (!active || !courseCommand || !courses.some((course) => course.id === courseId)) return;
    const draft = removeCourseCommand(active.draft, courseCommand);
    const caret = courseCommand.start;
    const context = activeContext.courseId === courseId ? activeContext : { courseId };
    updateActive((thread) => ({ ...thread, draft, context }));
    setDismissedCommand('');
    setComposerCaret(caret);
    setCourseOptionIndex(0);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.resizableTextArea?.textArea.setSelectionRange(caret, caret);
    });
  };

  const updateComposerCaret = (element: HTMLTextAreaElement) => {
    setComposerCaret(element.selectionStart);
    setCourseOptionIndex(0);
  };

  useEffect(() => {
    if (courseCommand) document.getElementById(`learn-ai-course-option-${highlightedCourseIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [commandKey, highlightedCourseIndex, Boolean(courseCommand)]);

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (composing || event.nativeEvent.isComposing) return;
    if (courseCommand) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDismissedCommand(commandKey);
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setCourseOptionIndex((highlightedCourseIndex + step + matchingCourses.length) % (matchingCourses.length || 1));
        return;
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const course = matchingCourses[highlightedCourseIndex];
        if (course) chooseCourse(course.id);
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const sidebar = (mobile = false) => (
    <div className="learn-ai-sidebar-inner">
      <div className="learn-ai-sidebar-heading">
        <Link to="/learn" className="learn-ai-brand" aria-label="Melearn หน้าหลัก">
          <BrandLogo className="learn-ai-brand-logo-img" />
        </Link>
        <Tooltip label="ค้นหาแชต">
          <ActionIcon variant="subtle" color="gray" size={36} aria-label="ค้นหาแชต" aria-expanded={searchOpen} onClick={() => {
            setSearchOpen((open) => !open);
            setSearch('');
          }}><IconSearch size={20} aria-hidden="true" /></ActionIcon>
        </Tooltip>
        <Tooltip label="หด sidebar">
          <ActionIcon variant="subtle" color="gray" size={36} aria-label="หด sidebar" aria-expanded={mobile ? drawerOpen : !sidebarCollapsed} onClick={() => mobile ? setDrawerOpen(false) : setSidebarCollapsed(true)}>
            <IconLayoutSidebar size={20} aria-hidden="true" />
          </ActionIcon>
        </Tooltip>
      </div>
      <NavLink component={Link} to="/learn" className="learn-ai-back-learning" label="กลับไปหน้าหลัก" leftSection={<IconHome2 size={17} aria-hidden="true" />} />
      <NavLink component="button" type="button" className="learn-ai-new-chat" label="แชตใหม่" leftSection={<IconPencil size={19} aria-hidden="true" />} onClick={newChat} />
      {searchOpen && <Input
        className="learn-ai-search"
        allowClear
        prefix={<IconSearch size={17} />}
        placeholder="ค้นหาแชต"
        aria-label="ค้นหาประวัติแชต"
        value={search}
        autoFocus
        onChange={(event) => setSearch(event.target.value)}
      />}
      <MantineText className="learn-ai-history-label" size="xs" c="dimmed">แชตล่าสุด</MantineText>
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
      {activeAttempt && <div className="learn-ai-sidebar-bottom">
        <NavLink component={Link} to={returnToAttempt} className="learn-ai-return-attempt" label="กลับไปทำแบบฝึกหัด" leftSection={<IconArrowLeft size={17} aria-hidden="true" />} />
      </div>}
    </div>
  );

  return (
    <main className={`learn-ai-app${sidebarCollapsed ? ' learn-ai-sidebar-collapsed' : ''}`}>
      <aside className="learn-ai-sidebar">{sidebar()}</aside>
      <Drawer className="learn-ai-mobile-drawer" placement="left" width={292} open={drawerOpen} onClose={() => setDrawerOpen(false)} closable={false} destroyOnHidden>
        {sidebar(true)}
      </Drawer>
      <section className="learn-ai-main" aria-label="Melearn AI">
        <div className="learn-ai-floating-controls">
          <Tooltip label="เปิด sidebar">
            <ActionIcon className="learn-ai-desktop-expand" variant="subtle" color="gray" size={40} aria-label="เปิด sidebar" aria-expanded={!sidebarCollapsed} onClick={() => setSidebarCollapsed(false)}><IconLayoutSidebar size={21} aria-hidden="true" /></ActionIcon>
          </Tooltip>
          <ActionIcon className="learn-ai-mobile-expand" variant="subtle" color="gray" size={40} aria-label="เปิดเมนูแชต" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><IconLayoutSidebar size={21} aria-hidden="true" /></ActionIcon>
        </div>
        {activeAttempt && activeContext.questionLabel && <div className="learn-ai-context-strip"><IconBook2 size={15} /><span>แบบฝึกหัดที่กำลังทำ</span><b>{activeContext.questionLabel}</b><Link to={returnToAttempt}>กลับไปข้อสอบ</Link></div>}
        <div className="learn-ai-thread" ref={scrollRef}>
          {active?.messages.length ? (
            <div className="learn-ai-messages" aria-live="polite">
              {active.messages.map((message) => (
                <article className={`learn-ai-message ${message.role}`} key={message.id}>
                  {message.role === 'assistant' && <span className="learn-ai-message-mark"><IconMessageChatbot size={17} aria-hidden="true" /></span>}
                  <div className="learn-ai-message-body">
                    <Text className="learn-ai-message-author">{message.role === 'user' ? 'คุณ' : 'ผู้ช่วยการเรียน'}</Text>
                    <AiResponse blocks={message.blocks} />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="learn-ai-welcome">
              <BrandLogo className="learn-ai-welcome-logo" />
              <h1>สวัสดี วันนี้อยากเรียนรู้อะไร?</h1>
              <p>เริ่มถาม หรือเลือกคำถามด้านล่างได้เลย</p>
              <div className="learn-ai-starters">
                {prompts.map((prompt) => <button type="button" key={prompt.text} onClick={() => sendMessage(prompt.text)}><span className="learn-ai-starter-icon">{prompt.icon}</span><span>{prompt.text}</span><IconArrowUpRight className="learn-ai-starter-arrow" size={16} aria-hidden="true" /></button>)}
              </div>
            </div>
          )}
        </div>
        <div className="learn-ai-composer-dock">
          <div className="learn-ai-composer-wrap" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setComposerFocused(false);
          }}>
            {courseCommand && <div className="learn-ai-course-menu">
              <MantineText size="xs" c="dimmed" className="learn-ai-course-menu-label">เลือกคอร์สที่เรียน</MantineText>
              <div id="learn-ai-course-options" role="listbox" aria-label="คอร์สที่ลงเรียน" className="learn-ai-course-options">
                {matchingCourses.map((course, index) => <Button
                  key={course.id}
                  id={`learn-ai-course-option-${index}`}
                  type="text"
                  role="option"
                  aria-selected={index === highlightedCourseIndex}
                  className="learn-ai-course-option"
                  icon={<IconBook2 size={16} aria-hidden="true" />}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => chooseCourse(course.id)}
                >{course.title}</Button>)}
              </div>
              {!matchingCourses.length && <div className="learn-ai-course-menu-empty" role="status">{courses.length ? 'ไม่พบคอร์สที่ตรงกัน' : 'ยังไม่มีคอร์สที่ลงเรียน'}</div>}
            </div>}
            {activeCourse && <div className="learn-ai-selected-course">
              <IconBook2 size={14} aria-hidden="true" />
              <span title={activeCourse.title}>{activeCourse.title}</span>
              <Button type="text" size="small" aria-label="นำคอร์สออกจากคำถาม" icon={<IconX size={13} aria-hidden="true" />} onClick={() => {
                updateActive((thread) => ({ ...thread, context: {} }));
                inputRef.current?.focus();
              }} />
            </div>}
            <label htmlFor="learn-ai-composer" className="learn-ai-sr-only">พิมพ์คำถามถึง Melearn AI</label>
            <Input.TextArea
              id="learn-ai-composer"
              className="learn-ai-composer-input"
              ref={inputRef}
              value={active?.draft ?? ''}
              onChange={(event) => {
                updateActive((thread) => ({ ...thread, draft: event.target.value }));
                updateComposerCaret(event.target);
              }}
              onSelect={(event) => updateComposerCaret(event.currentTarget)}
              onFocus={(event) => {
                setComposerFocused(true);
                updateComposerCaret(event.currentTarget);
              }}
              role="combobox"
              aria-autocomplete="list"
              aria-haspopup="listbox"
              aria-expanded={Boolean(courseCommand)}
              aria-controls={courseCommand ? 'learn-ai-course-options' : undefined}
              aria-activedescendant={courseCommand && matchingCourses.length ? `learn-ai-course-option-${highlightedCourseIndex}` : undefined}
              aria-describedby="learn-ai-composer-hint"
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={() => setComposing(false)}
              onKeyDown={onComposerKeyDown}
              placeholder={activeContext.questionLabel ? 'ถามเกี่ยวกับข้อนี้ หรือพิมพ์ / เลือกคอร์ส…' : 'ถามเกี่ยวกับบทเรียน หรือพิมพ์ / เลือกคอร์ส…'}
              autoSize={{ minRows: 2, maxRows: 5 }}
            />
            <div className="learn-ai-composer-actions"><Text id="learn-ai-composer-hint"><span className="learn-ai-keyboard-hint">Enter ส่ง · </span>/ เลือกคอร์ส</Text><Button type="primary" aria-label="ส่งคำถาม" icon={<IconArrowUp size={17} />} onClick={() => sendMessage()} disabled={!active?.draft.trim() || Boolean(courseCommand)} /></div>
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
