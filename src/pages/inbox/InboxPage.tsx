import React, { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Empty, Image, Input, Modal, Segmented, Upload } from 'antd';
import { ArrowLeftOutlined, BookOutlined, DeleteOutlined, MessageOutlined, PaperClipOutlined, PlusOutlined, SearchOutlined, SendOutlined } from '@ant-design/icons';
import { Link, useSearchParams } from 'react-router-dom';
import { useLms } from '../../store';
import { UserAvatar } from '../../components/UserAvatar';
import {
  getInboxContacts,
  getInboxLessonContext,
  getInboxThreads,
  type InboxContact,
  type InboxThread,
} from '../../api/inbox';
import type { InboxAttachment, InboxAttachmentInput, InboxSubjectContext } from '../../types';
import {
  MAX_INBOX_ATTACHMENTS,
  MAX_INBOX_TOTAL_ATTACHMENT_BYTES,
  prepareInboxAttachment,
} from '../../api/inboxAttachments';
import './inbox.css';

const roleLabel = (role?: string) =>
  ({ instructor: 'ผู้สอน', admin: 'แอดมิน', learner: 'ผู้เรียน' })[role || ''] || 'ผู้ใช้งาน';

const messageTime = (date?: string) =>
  date
    ? new Date(date).toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Bangkok',
      })
    : '';

const messageDate = (date?: string) =>
  date
    ? new Date(date).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Bangkok',
      })
    : '';

function attachmentSummary(attachments?: InboxAttachment[]) {
  if (!attachments?.length) return '';
  const images = attachments.filter((attachment) => attachment.contentType.startsWith('image/')).length;
  const videos = attachments.length - images;
  return [images && `แนบรูป ${images} ไฟล์`, videos && `แนบวิดีโอ ${videos} ไฟล์`]
    .filter(Boolean)
    .join(' · ');
}

export function InboxPage() {
  const { data, currentUser } = useLms();
  const [search, setSearch] = useSearchParams();
  const [choosingContact, setChoosingContact] = useState(false);
  const threads = getInboxThreads(data, currentUser);
  const contacts = getInboxContacts(data, currentUser);
  const selectedId = search.get('thread');
  const conversation = threads.find((entry) => entry.id === selectedId);
  const contact = selectedId
    ? null
    : contacts.find(
        (entry) =>
          entry.user.id === search.get('recipient') &&
          (entry.course?.id || null) === (search.get('course') || null)
      );
  const lessonContext = getInboxLessonContext(
    data,
    currentUser,
    conversation?.courseId || contact?.course?.id,
    search.get('item') || undefined,
    search.get('chapter') || undefined
  );
  const invalidTarget =
    Boolean(selectedId && !conversation) ||
    Boolean(search.get('recipient') && !contact && !selectedId) ||
    Boolean((search.get('item') || search.get('chapter')) && !lessonContext);
  const targetConversation =
    conversation || (contact && threads.find((entry) => entry.id === contact.key));
  const query = search.get('q') || '';
  const filter = search.get('filter') === 'unread' ? 'unread' : 'all';
  const unreadThreads = threads.filter((entry) => entry.unreadCount > 0).length;
  const filtered = threads.filter((entry) => {
    if (filter === 'unread' && !entry.unreadCount) return false;
    const term = query.trim().toLowerCase();
    return (
      !term ||
      [
        entry.otherUser?.name,
        entry.course?.title,
        ...entry.messages.flatMap((item) => [
          item.body,
          item.context?.chapterTitle,
            item.context?.itemTitle,
            ...(item.attachments || []).map((attachment) => attachment.name),
        ]),
      ].some((value) => value?.toLowerCase().includes(term))
    );
  });

  const changeSearch = (key: string, value: string) => {
    const next = new URLSearchParams(search);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearch(next, { replace: key === 'q' });
  };

  const openThread = (id: string | null) => {
    const next = new URLSearchParams(search);
    if (id) next.set('thread', id);
    else next.delete('thread');
    next.delete('recipient');
    next.delete('course');
    next.delete('item');
    next.delete('chapter');
    setSearch(next);
  };

  const chooseContact = (entry: InboxContact) => {
    const next = new URLSearchParams(search);
    const existing = threads.find((thread) => thread.id === entry.key);
    next.delete('thread');
    next.delete('recipient');
    next.delete('course');
    next.delete('item');
    next.delete('chapter');
    if (existing) next.set('thread', existing.id);
    else {
      next.set('recipient', entry.user.id);
      if (entry.course) next.set('course', entry.course.id);
    }
    setSearch(next);
    setChoosingContact(false);
  };

  const hasConversation = Boolean(conversation || contact || invalidTarget);

  return (
    <div className={`inbox-page${hasConversation ? ' has-conversation' : ''}`}>
      <div className="inbox-layout">
        <aside className="inbox-list" aria-label="รายการบทสนทนา">
          <div className="inbox-list-heading">
            <h1>อินบ็อกซ์</h1>
            <span>{unreadThreads ? `ยังไม่อ่าน ${unreadThreads}` : `${threads.length} บทสนทนา`}</span>
            {currentUser?.role === 'learner' && (
              <Button
                type="primary"
                icon={<PlusOutlined aria-hidden="true" />}
                onClick={() => setChoosingContact(true)}
              >
                ข้อความใหม่
              </Button>
            )}
          </div>
          <div className="inbox-list-filters">
            <Input
              aria-label="ค้นหาบทสนทนา"
              placeholder="ค้นหาชื่อ คอร์ส หรือข้อความ"
              prefix={<SearchOutlined aria-hidden="true" />}
              value={query}
              onChange={(event) => changeSearch('q', event.target.value)}
              allowClear
            />
            <Segmented
              aria-label="กรองบทสนทนา"
              block
              value={filter}
              options={[
                { value: 'all', label: 'ทั้งหมด' },
                { value: 'unread', label: 'ยังไม่อ่าน' },
              ]}
              onChange={(value) => changeSearch('filter', value === 'all' ? '' : String(value))}
            />
          </div>
          <div className="inbox-list-body">
            {filtered.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`inbox-thread${entry.id === selectedId ? ' is-selected' : ''}${
                  entry.unreadCount ? ' is-unread' : ''
                }`}
                aria-pressed={entry.id === selectedId}
                onClick={() => openThread(entry.id)}
              >
                <UserAvatar user={entry.otherUser} size={40} />
                <span className="inbox-thread-content">
                  <span className="inbox-thread-name">
                    <strong>{entry.otherUser?.name || 'ผู้ใช้งาน'}</strong>
                    <small>{entry.lastMessage ? messageTime(entry.lastMessage.createdAt) : ''}</small>
                  </span>
                  <span className="inbox-thread-context">{entry.course?.title || 'ติดต่อแอดมิน'}</span>
                  <span className="inbox-thread-preview">
                    {entry.lastMessage?.senderId === currentUser?.id && 'คุณ: '}
                    {entry.lastMessage?.body || attachmentSummary(entry.lastMessage?.attachments)}
                  </span>
                </span>
                {entry.unreadCount > 0 && <Badge count={entry.unreadCount} color="var(--primary)" />}
              </button>
            ))}
            {!filtered.length && (
              <div className="inbox-list-empty">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={threads.length ? 'ไม่มีบทสนทนาที่ตรงกับตัวกรอง' : 'ยังไม่มีบทสนทนา'}
                />
              </div>
            )}
          </div>
        </aside>

        {invalidTarget ? (
          <section className="inbox-invalid">
            <Button icon={<ArrowLeftOutlined aria-hidden="true" />} onClick={() => openThread(null)}>
              กลับรายการ
            </Button>
            <Alert
              type="info"
              showIcon
              message="ไม่พบบทสนทนาหรือคุณไม่มีสิทธิ์เปิด"
              description="เปิดบทสนทนาจากรายการของบัญชีคุณ"
            />
          </section>
        ) : conversation || contact ? (
          <Conversation
            key={`${currentUser?.id}:${targetConversation?.id || contact?.key}:${
              lessonContext?.itemId || lessonContext?.chapterId || ''
            }`}
            conversation={targetConversation || undefined}
            contact={contact}
            lessonContext={lessonContext}
            onBack={() => openThread(null)}
            onSent={(id) => openThread(id || null)}
          />
        ) : (
          <section className="inbox-welcome">
            <div className="inbox-welcome-icon">
              <MessageOutlined aria-hidden="true" />
            </div>
            <h2>
              {currentUser?.role === 'learner'
                ? 'มีคำถามระหว่างเรียนไหม?'
                : 'พื้นที่ตอบคำถามของผู้เรียน'}
            </h2>
            <p>
              {currentUser?.role === 'learner'
                ? 'เลือกข้อความใหม่เพื่อถามผู้สอนในคอร์สที่คุณเรียน หรือติดต่อแอดมินเรื่องบัญชีและการใช้งาน'
                : 'เลือกบทสนทนาด้านซ้ายเพื่ออ่านและตอบกลับ เมื่อมีคำถามใหม่ คุณจะได้รับแจ้งเตือนที่กระดิ่ง'}
            </p>
            {currentUser?.role === 'learner' && (
              <Button
                icon={<PlusOutlined aria-hidden="true" />}
                onClick={() => setChoosingContact(true)}
              >
                เลือกผู้รับข้อความ
              </Button>
            )}
          </section>
        )}
      </div>
      <ContactPicker
        contacts={contacts}
        open={choosingContact}
        onClose={() => setChoosingContact(false)}
        onSelect={chooseContact}
      />
    </div>
  );
}

interface ContactPickerProps {
  contacts: InboxContact[];
  open: boolean;
  onClose: () => void;
  onSelect: (entry: InboxContact) => void;
}

function ContactPicker({ contacts, open, onClose, onSelect }: ContactPickerProps) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const filtered = contacts.filter(
    (entry) =>
      (role === 'all' || entry.user.role === role) &&
      [entry.user.name, entry.course?.title].some((text) =>
        text?.toLowerCase().includes(query.toLowerCase())
      )
  );

  return (
    <Modal title="เริ่มบทสนทนาใหม่" open={open} onCancel={onClose} footer={null} width={560}>
      <div className="inbox-contact-filters">
        <Input
          aria-label="ค้นหาผู้รับข้อความ"
          placeholder="ค้นหาชื่อหรือคอร์ส"
          prefix={<SearchOutlined aria-hidden="true" />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          allowClear
        />
        <Segmented
          block
          value={role}
          onChange={setRole}
          options={[
            { value: 'all', label: 'ทั้งหมด' },
            { value: 'instructor', label: 'ผู้สอน' },
            { value: 'admin', label: 'แอดมิน' },
          ]}
        />
      </div>
      <div className="inbox-contacts">
        {filtered.map((entry) => (
          <button
            type="button"
            className="inbox-contact"
            key={entry.key}
            onClick={() => onSelect(entry)}
          >
            <UserAvatar user={entry.user} size={44} />
            <span>
              <strong>{entry.user.name}</strong>
              <small>
                {roleLabel(entry.user.role)} · {entry.course?.title || 'บัญชีและการใช้งานระบบ'}
              </small>
            </span>
          </button>
        ))}
        {!filtered.length && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="ไม่พบผู้รับที่ติดต่อได้ในรายการนี้"
          />
        )}
      </div>
    </Modal>
  );
}

interface ConversationProps {
  conversation?: InboxThread;
  contact?: InboxContact | null;
  lessonContext?: InboxSubjectContext | null;
  onBack: () => void;
  onSent: (conversationId?: string) => void;
}

function Conversation({ conversation, contact, lessonContext, onBack, onSent }: ConversationProps) {
  const { data, currentUser, sendInboxMessage, markInboxConversationRead } = useLms();
  const recipient = conversation?.otherUser || contact?.user;
  const course = conversation?.course || contact?.course;
  const messages = conversation?.messages || [];
  const draftKey = `melearn-inbox-draft:${currentUser?.id}:${
    conversation?.id || contact?.key
  }${lessonContext ? `:${lessonContext.itemId || lessonContext.chapterId}` : ''}`;
  const [text, setText] = useState(() => {
    try {
      return sessionStorage.getItem(draftKey) || '';
    } catch {
      return '';
    }
  });
  const [error, setError] = useState('');
  const [draftError, setDraftError] = useState(false);
  const [attachments, setAttachments] = useState<InboxAttachmentInput[]>([]);
  const attachmentsRef = useRef<InboxAttachmentInput[]>([]);
  const [preparingCount, setPreparingCount] = useState(0);
  const uploadQueue = useRef(Promise.resolve());
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastId = messages.at(-1)?.id;
  const dirtyRef = useRef(Boolean(text));
  dirtyRef.current = Boolean(text.trim() || attachmentsRef.current.length || preparingCount);

  useEffect(() => {
    if (conversation?.unreadCount && conversation.id) {
      markInboxConversationRead(conversation.id);
    }
  }, [conversation?.id, conversation?.unreadCount, markInboxConversationRead]);

  useEffect(() => {
    stickToBottom.current = true;
    const frame = requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [lastId]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current) list.scrollTop = list.scrollHeight;
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

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

  const changeText = (value: string) => {
    setText(value);
    dirtyRef.current = Boolean(value.trim() || attachmentsRef.current.length || preparingCount);
    setError('');
    try {
      sessionStorage.setItem(draftKey, value);
      setDraftError(false);
    } catch {
      setDraftError(true);
    }
  };

  const changeAttachments = (next: InboxAttachmentInput[]) => {
    attachmentsRef.current = next;
    setAttachments(next);
    dirtyRef.current = Boolean(text.trim() || next.length || preparingCount);
    setError('');
  };

  const selectAttachment = (file: File) => {
    dirtyRef.current = true;
    setPreparingCount((count) => count + 1);
    uploadQueue.current = uploadQueue.current
      .then(async () => {
        const current = attachmentsRef.current;
        if (current.length >= MAX_INBOX_ATTACHMENTS) {
          throw new Error(`แนบได้ไม่เกิน ${MAX_INBOX_ATTACHMENTS} ไฟล์ต่อข้อความ`);
        }
        const prepared = await prepareInboxAttachment(file);
        const totalBytes = current.reduce((sum, attachment) => sum + attachment.size, prepared.size);
        if (totalBytes > MAX_INBOX_TOTAL_ATTACHMENT_BYTES) {
          throw new Error('ขนาดไฟล์แนบรวมกันได้ไม่เกิน 8 MB');
        }
        changeAttachments([...attachmentsRef.current, prepared]);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'อ่านไฟล์แนบไม่สำเร็จ');
      })
      .finally(() => setPreparingCount((count) => Math.max(0, count - 1)));
    return Upload.LIST_IGNORE;
  };

  const send = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!recipient) return;
    const result = sendInboxMessage({
      conversationId: conversation?.id,
      recipientId: recipient.id,
      courseId: course?.id,
      itemId: lessonContext?.itemId,
      chapterId: lessonContext?.chapterId,
      text,
      attachments,
    });
    if (!result.ok) {
      setError(result.message || 'ส่งข้อความไม่สำเร็จ');
      return;
    }
    setText('');
    changeAttachments([]);
    setError('');
    dirtyRef.current = false;
    try {
      sessionStorage.removeItem(draftKey);
    } catch {
      /* Sent messages remain in the main store. */
    }
    onSent(result.conversationId);
  };

  const courseHref =
    course &&
    (currentUser?.role === 'learner'
      ? `/learn/courses/${course.id}`
      : `/teach/courses/${course.id}`);

  if (!recipient) {
    return (
      <section className="inbox-invalid">
        <Button onClick={onBack}>กลับรายการบทสนทนา</Button>
        <Alert
          type="info"
          showIcon
          message="ไม่พบบัญชีคู่สนทนา"
          description="ประวัติยังคงเก็บไว้ แต่ไม่สามารถส่งข้อความใหม่ได้"
        />
      </section>
    );
  }

  return (
    <section className="inbox-conversation" aria-label={`สนทนากับ ${recipient.name}`}>
      <header className="inbox-conversation-header">
        <Button
          className="inbox-mobile-back"
          type="text"
          icon={<ArrowLeftOutlined aria-hidden="true" />}
          aria-label="กลับรายการบทสนทนา"
          onClick={onBack}
        />
        <UserAvatar user={recipient} size={44} />
        <div>
          <h2>{recipient.name}</h2>
          <span>
            {roleLabel(recipient.role)}
            {!conversation && ' · บทสนทนาใหม่'}
          </span>
        </div>
        {messages.some((entry) => 'isDemo' in entry && Boolean(entry.isDemo)) && (
          <span className="inbox-demo-label">มีข้อความตัวอย่าง</span>
        )}
        {courseHref && (
          <Link className="inbox-course-link" to={courseHref}>
            <BookOutlined aria-hidden="true" /> ดูคอร์ส
          </Link>
        )}
      </header>
      {course && (
        <div className="inbox-course-context">
          <BookOutlined aria-hidden="true" />
          <span>{course.title}</span>
        </div>
      )}
      <div
        className="inbox-message-list"
        ref={listRef}
        onScroll={(event) => {
          const list = event.currentTarget;
          stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 64;
        }}
        role="log"
        aria-label="ข้อความในการสนทนา"
        aria-live="polite"
        aria-relevant="additions"
      >
        {!messages.length && (
          <div className="inbox-start-note">
            <MessageOutlined aria-hidden="true" />
            <p>เริ่มถามได้เลย</p>
            <span>
              {course
                ? 'อธิบายบทหรือแบบฝึกหัดที่สงสัย เพื่อให้ผู้สอนช่วยตอบได้ตรงจุด'
                : 'อธิบายเรื่องที่ต้องการให้แอดมินช่วยดูแล'}
            </span>
          </div>
        )}
        {messages.map((entry, index) => {
          const own = entry.senderId === currentUser?.id;
          const sender = data.users.find((user) => user.id === entry.senderId);
          const date = messageDate(entry.createdAt);
          return (
            <React.Fragment key={entry.id}>
              {(!index || date !== messageDate(messages[index - 1].createdAt)) && (
                <div className="inbox-message-date">
                  <span>{date}</span>
                </div>
              )}
              <div className={`inbox-message${own ? ' is-own' : ''}`}>
                {!own && <UserAvatar user={sender} size={30} />}
                <div className="inbox-message-content">
                  {!own && <strong className="inbox-message-author">{sender?.name || 'ผู้ใช้งาน'}</strong>}
                  {entry.context && <LessonContext context={entry.context} />}
                  {entry.body && <p className="inbox-message-bubble">{entry.body}</p>}
                  {entry.attachments?.length ? <MessageAttachments attachments={entry.attachments} /> : null}
                  <span className="inbox-message-meta">
                    {messageTime(entry.createdAt)}
                    {own && ` · ${entry.readBy?.includes(recipient.id) ? 'อ่านแล้ว' : 'ส่งแล้ว'}`}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <form className="inbox-composer" onSubmit={send}>
        {lessonContext && <LessonContext context={lessonContext} composing />}
        {error && <Alert type="error" showIcon message={error} />}
        {draftError && (
          <Alert
            type="warning"
            showIcon
            message="เก็บฉบับร่างไม่ได้ กรุณาส่งข้อความก่อนเปลี่ยนบทสนทนา"
          />
        )}
        {recipient.status !== 'active' && (
          <Alert type="info" showIcon message="บัญชีผู้รับยังไม่พร้อมรับข้อความ" />
        )}
        <Input.TextArea
          aria-label="ข้อความถึงผู้รับ"
          placeholder={`พิมพ์ข้อความถึง${roleLabel(recipient.role)}…`}
          autoSize={{ minRows: 2, maxRows: 5 }}
          maxLength={3000}
          value={text}
          onChange={(event) => changeText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (text.trim() && recipient.status === 'active') send();
            }
          }}
        />
        {attachments.length > 0 && (
          <div className="inbox-pending-attachments" aria-label="ไฟล์แนบก่อนส่ง">
            {attachments.map((attachment, index) => (
              <div className="inbox-pending-attachment" key={`${attachment.name}:${index}`}>
                {attachment.contentType.startsWith('image/') ? (
                  <Image src={attachment.url} alt={attachment.name} preview width={92} height={68} />
                ) : (
                  <video src={attachment.url} controls preload="metadata" aria-label={attachment.name} />
                )}
                <span title={attachment.name}>{attachment.name}</span>
                <Button
                  type="text"
                  danger
                  size="small"
                  aria-label={`ลบไฟล์ ${attachment.name}`}
                  icon={<DeleteOutlined aria-hidden="true" />}
                  onClick={() => changeAttachments(attachmentsRef.current.filter((_, itemIndex) => itemIndex !== index))}
                />
              </div>
            ))}
          </div>
        )}
        {preparingCount > 0 && <span className="inbox-preparing">กำลังเตรียมไฟล์ {preparingCount} รายการ…</span>}
        <div className="inbox-composer-actions">
          <span>Enter เพื่อส่ง · Shift+Enter ขึ้นบรรทัดใหม่</span>
          <div className="inbox-composer-buttons">
            <Upload
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              multiple
              showUploadList={false}
              beforeUpload={selectAttachment}
            >
              <Button
                icon={<PaperClipOutlined aria-hidden="true" />}
                disabled={preparingCount > 0 || attachments.length >= MAX_INBOX_ATTACHMENTS || recipient.status !== 'active'}
              >
                แนบภาพหรือวิดีโอ
              </Button>
            </Upload>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SendOutlined aria-hidden="true" />}
              disabled={(!text.trim() && !attachments.length) || preparingCount > 0 || recipient.status !== 'active'}
            >
              ส่งข้อความ
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

function MessageAttachments({ attachments }: { attachments: InboxAttachment[] }) {
  return (
    <div className="inbox-message-attachments" aria-label="ไฟล์แนบในข้อความ">
      {attachments.map((attachment) => (
        <figure className="inbox-message-attachment" key={attachment.id}>
          {attachment.contentType.startsWith('image/') ? (
            <Image src={attachment.url} alt={attachment.name} preview />
          ) : (
            <video src={attachment.url} controls preload="metadata" aria-label={attachment.name} />
          )}
          <figcaption title={attachment.name}>{attachment.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}

interface LessonContextProps {
  context: InboxSubjectContext;
  composing?: boolean;
}

function LessonContext({ context, composing = false }: LessonContextProps) {
  const { data, currentUser } = useLms();
  const course = data.courses.find((entry) => entry.id === context.courseId);
  const chapter = course?.chapters.find((entry) => entry.id === context.chapterId);
  const item = chapter?.items.find((entry) => entry.id === context.itemId);
  const href =
    chapter &&
    (!context.itemId || item) &&
    (currentUser?.role === 'learner'
      ? item
        ? `/learn/courses/${course?.id}/${
            item.type === 'video'
              ? 'videos'
              : item.type === 'article'
              ? 'articles'
              : 'quizzes'
          }/${item.id}`
        : `/learn/courses/${course?.id}`
      : `/teach/courses/${course?.id}/chapters/${chapter.id}`);

  return (
    <div className="inbox-lesson-context">
      <BookOutlined aria-hidden="true" />
      <div>
        <small>
          {composing ? 'แนบบริบทคำถาม' : 'ถามจากบทเรียน'} · {context.courseTitle}
        </small>
        <strong>{[context.chapterTitle, context.itemTitle].filter(Boolean).join(' / ')}</strong>
        {href && <Link to={href}>{composing ? 'กลับไปบทเรียน' : 'เปิดบทเรียน'}</Link>}
      </div>
    </div>
  );
}
