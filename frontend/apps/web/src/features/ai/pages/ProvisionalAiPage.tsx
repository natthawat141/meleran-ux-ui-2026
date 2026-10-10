import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Input, Modal, Popconfirm, Select, Spin, Typography } from 'antd';
import { NavLink } from '@mantine/core';
import { IconArrowUp, IconBook2, IconMessageChatbot, IconPencil, IconSparkles, IconTrash } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import logo from '@melearn/ui/assets/melearn-ui/logo.PNG';
import { useAuthSession } from '../../auth/api/AuthSessionProvider';
import { useAiContextCourses, useAiConversations, useAiMessages, useAiUsage, useAnswerAiPractice, useCreateAiConversation, useDeleteAiConversation, useRenameAiConversation, useSendAiMessage } from '../hooks/use-ai';
import type { AiMessage } from '../api/ai-api';
import '@melearn/ui/styles/learner-ai.css';

const starters = ['ช่วยสรุปเรื่องที่กำลังเรียน', 'สร้างแบบฝึกหัดเรื่องเศษส่วน 5 ข้อ', 'อธิบายแนวคิดนี้ให้เข้าใจง่าย'];
function makeRequestId() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

function PracticeSet({ message: entry, conversationId, onAnswer, busy }: { message: AiMessage; conversationId: string; onAnswer: (args: { conversationId: string; messageId: string; questionId: string; optionId: string }) => void; busy: boolean }) {
  const practice = entry.practice;
  if (!practice) return <p className="mai-response-text">{entry.content}</p>;
  const answered = practice.questions.filter((question) => question.answered).length;
  const correct = practice.questions.filter((question) => question.result?.correct).length;
  return <div className="mai-practice-set"><div className="mai-practice-set-heading"><div><strong>ชุดฝึกหัด</strong><span>ตอบในแชต · ไม่เปลี่ยนคะแนนหรือ Progress ของคอร์ส</span></div><span>{answered}/{practice.questions.length} ข้อ</span></div>
    {practice.questions.map((question, index) => <fieldset className="mai-practice-set-question" key={question.id}><legend>ข้อ {index + 1}</legend><p>{question.prompt}</p><div className="mai-practice-set-options">
      {question.options.map((option) => <Button key={option.id} disabled={question.answered || busy} onClick={() => onAnswer({ conversationId, messageId: entry.id, questionId: question.id, optionId: option.id })}>{option.text}</Button>)}
    </div>{question.result && <div className="mai-practice-set-feedback" data-correct={question.result.correct}><strong>{question.result.correct ? 'ตอบถูก' : 'ยังไม่ถูก'}</strong><p>{question.result.explanation}</p></div>}</fieldset>)}
    {answered === practice.questions.length && <div className="mai-practice-set-result">ทำครบ {answered} ข้อ · ถูก {correct} ข้อ</div>}
  </div>;
}

export function ProvisionalAiPage() {
  const { user } = useAuthSession(); const roles = user?.roles ?? [];
  const [search, setSearch] = useState(''); const [activeId, setActiveId] = useState(''); const [courseId, setCourseId] = useState<string | null>(null); const [draft, setDraft] = useState('');
  const [renameId, setRenameId] = useState(''); const [renameTitle, setRenameTitle] = useState(''); const [pageError, setPageError] = useState('');
  const conversations = useAiConversations(search); const messages = useAiMessages(activeId); const usage = useAiUsage(); const courses = useAiContextCourses(roles);
  const create = useCreateAiConversation(); const rename = useRenameAiConversation(); const remove = useDeleteAiConversation(); const send = useSendAiMessage(); const answer = useAnswerAiPractice();
  const active = conversations.data?.items.find((entry) => entry.id === activeId);
  useEffect(() => { if (activeId && !conversations.data?.items.some((entry) => entry.id === activeId)) setActiveId(''); }, [activeId, conversations.data]);
  useEffect(() => { if (active?.course_id) setCourseId(active.course_id); }, [active?.id, active?.course_id]);
  const courseOptions = useMemo(() => courses.data ?? [], [courses.data]);
  const newChat = async () => { setPageError(''); try { const conversation = await create.mutateAsync(courseId); setActiveId(conversation.id); setDraft(''); } catch (error) { setPageError(error instanceof Error ? error.message : 'สร้างแชตไม่ได้'); } };
  const submit = async (content = draft) => {
    const value = content.trim(); if (!value || send.isPending) return;
    setPageError(''); let conversationId = activeId;
    try {
      if (!conversationId) { const conversation = await create.mutateAsync(courseId); conversationId = conversation.id; setActiveId(conversationId); }
      await send.mutateAsync({ id: conversationId, content: value, requestId: makeRequestId(), courseId }); setDraft('');
    } catch (error) { setPageError(error instanceof Error ? error.message : 'ส่งคำถามไม่ได้'); }
  };
  const saveRename = async () => { try { await rename.mutateAsync({ id: renameId, title: renameTitle }); setRenameId(''); } catch (error) { setPageError(error instanceof Error ? error.message : 'เปลี่ยนชื่อไม่ได้'); } };

  return <main className="learn-ai-app">
    <aside className="learn-ai-sidebar"><div className="learn-ai-sidebar-inner">
      <div className="learn-ai-sidebar-heading"><Link className="learn-ai-brand" to="/learn"><span className="brand-logo-crop learn-ai-logo-crop"><img src={logo} alt="" width="1920" height="1080" /></span></Link><IconSparkles size={18} /></div>
      <Button className="learn-ai-new-chat" type="text" onClick={() => void newChat()}>＋ แชตใหม่</Button>
      <Input className="learn-ai-search" aria-label="ค้นหาประวัติแชต" placeholder="ค้นหาแชต" value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className="learn-ai-history-label">ประวัติ</div>
      <div className="learn-ai-history">{conversations.isPending ? <Spin size="small" /> : conversations.data?.items.length ? conversations.data.items.map((item) => <div className="learn-ai-history-row" key={item.id}>
        <NavLink className="learn-ai-history-item" active={item.id === activeId} label={item.title} onClick={() => setActiveId(item.id)} />
        <Button type="text" size="small" aria-label={`เปลี่ยนชื่อ ${item.title}`} icon={<IconPencil size={15} />} onClick={() => { setRenameId(item.id); setRenameTitle(item.title); }} />
        <Popconfirm title="ลบประวัติแชตนี้?" description="ข้อความและชุดฝึกในแชตนี้จะถูกลบ" onConfirm={() => remove.mutate(item.id, { onSuccess: () => { if (activeId === item.id) setActiveId(''); }, onError: (error) => setPageError(error.message) })}><Button type="text" size="small" danger aria-label={`ลบ ${item.title}`} icon={<IconTrash size={15} />} /></Popconfirm>
      </div>) : <div className="learn-ai-history-empty">{search ? 'ไม่พบแชตที่ตรงกัน' : 'ยังไม่มีประวัติ'}</div>}</div>
      <div className="learn-ai-sidebar-bottom"><NavLink component={Link} to="/learn" className="learn-ai-back-learning" label="กลับไปพื้นที่เรียน" /></div>
    </div></aside>
    <section className="learn-ai-main" aria-label="Melearn AI">
      <div className="learn-ai-context-strip"><IconBook2 size={15} /><span>AI จำลอง · โควตาวันนี้ {usage.data ? `${usage.data.used}/${usage.data.limit}` : 'กำลังโหลด'}</span><b>{courseOptions.find((course) => course.id === courseId)?.title ?? (courseId ? 'เลือกบริบทไม่ได้' : 'ไม่มีบริบทคอร์ส')}</b></div>
      {pageError && <Alert type="error" showIcon message={pageError} closable onClose={() => setPageError('')} />}
      <div className="learn-ai-thread">
        {activeId && messages.isPending ? <div className="learn-ai-welcome"><Spin /></div> : activeId && messages.isError ? <div className="learn-ai-welcome"><Alert type="error" message="โหลดข้อความไม่ได้" description={messages.error.message} action={<Button onClick={() => void messages.refetch()}>ลองอีกครั้ง</Button>} /></div> : messages.data?.items.length ? <div className="learn-ai-messages" aria-live="polite">{messages.data.items.map((entry) => <article className={`learn-ai-message ${entry.role}`} key={entry.id}>
          {entry.role === 'assistant' && <span className="learn-ai-message-mark"><IconMessageChatbot size={17} /></span>}<div className="learn-ai-message-body"><Typography.Text className="learn-ai-message-author">{entry.role === 'user' ? 'คุณ' : 'ผู้ช่วยการเรียน'}</Typography.Text>
            {entry.kind === 'practice_set' ? <PracticeSet message={entry} conversationId={activeId} onAnswer={(args) => answer.mutate(args, { onError: (error) => setPageError(error.message) })} busy={answer.isPending} /> : <p className="mai-response-text">{entry.content}</p>}
            {entry.status === 'failed' && <Typography.Text type="danger">คำตอบนี้ไม่สำเร็จ ไม่ถูกนับในโควตา · {entry.error_code}</Typography.Text>}
          </div></article>)}</div> : <div className="learn-ai-welcome"><h1>สวัสดี วันนี้อยากเรียนรู้อะไร?</h1><p>ถามเรื่องทั่วไป หรือสร้างแบบฝึกหัดจำลองในแชต</p><div className="learn-ai-starters">{starters.map((prompt) => <button type="button" key={prompt} onClick={() => void submit(prompt)}><span className="learn-ai-starter-icon"><IconSparkles size={17} /></span><span>{prompt}</span></button>)}</div></div>}
      </div>
      <div className="learn-ai-composer-dock"><div className="learn-ai-composer-wrap">
        <Select aria-label="เลือกบริบทคอร์ส" allowClear placeholder="ไม่ใช้ความรู้จากคอร์ส" value={courseId ?? undefined} onChange={(value) => setCourseId(value ?? null)} loading={courses.isPending} options={courseOptions.map((course) => ({ value: course.id, label: course.title }))} />
        <label className="learn-ai-sr-only" htmlFor="provisional-ai-composer">พิมพ์คำถามถึง Melearn AI</label>
        <Input.TextArea id="provisional-ai-composer" className="learn-ai-composer-input" value={draft} onChange={(event) => setDraft(event.target.value)} autoSize={{ minRows: 2, maxRows: 5 }} placeholder="ถามคำถาม หรือพิมพ์ /quiz สร้างแบบฝึกหัด…" onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); } }} />
        <div className="learn-ai-composer-actions"><Typography.Text>{usage.data ? `เหลือ ${usage.data.remaining} prompts · เวลาไทย` : 'กำลังอ่านโควตา'}</Typography.Text><Button type="primary" aria-label="ส่งคำถาม" icon={<IconArrowUp size={17} />} loading={send.isPending} disabled={!draft.trim() || (usage.data?.remaining ?? 1) === 0} onClick={() => void submit()} /></div>
      </div><div className="learn-ai-demo-note">คำตอบและโควตามาจาก provisional mock เท่านั้น · ไม่มี AI จริงหรือการบันทึกถาวร</div></div>
    </section>
    <Modal title="เปลี่ยนชื่อแชต" open={Boolean(renameId)} okText="บันทึกชื่อ" cancelText="ยกเลิก" okButtonProps={{ disabled: !renameTitle.trim(), loading: rename.isPending }} onOk={() => void saveRename()} onCancel={() => setRenameId('')}><Input maxLength={80} value={renameTitle} onChange={(event) => setRenameTitle(event.target.value)} /></Modal>
  </main>;
}
