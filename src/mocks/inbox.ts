import { inboxConversationKey } from '../api/inbox';
import type { Course, InboxConversation, InboxMessage, InboxSubjectContext, LmsData, User } from '../types';

export interface InboxDemoData {
  inboxConversations: InboxConversation[];
  inboxMessages: InboxMessage[];
  inboxDemoVersion: number;
}

// Fictional conversations for reviewing the browser-local prototype.
export function createInboxDemo(data: LmsData): InboxDemoData {
  const course = data.courses.find((entry) => entry.id === 'course-writing');
  const teacher = data.users.find((entry) => entry.id === course?.instructorId && entry.status === 'active');
  const learner = data.users.find((entry) => entry.id === 'u-natee');
  const admin = data.users.find((entry) => entry.id === 'u-admin');
  const other = data.users.find(
    (entry) =>
      entry.role === 'learner' &&
      entry.id !== learner?.id &&
      data.enrollments.some((enrollment) => enrollment.userId === entry.id && enrollment.courseId === course?.id)
  );

  const conversations: InboxConversation[] = [];
  const messages: InboxMessage[] = [];

  const add = (
    student: User | undefined,
    recipient: User | undefined,
    selectedCourse: Course | null,
    itemId: string | null,
    question: string,
    reply: string | null,
    unreadByRecipient: boolean
  ) => {
    if (!student || !recipient) return;
    const id = inboxConversationKey(student.id, recipient.id, selectedCourse?.id);
    const chapter = selectedCourse?.chapters.find((entry) => entry.items.some((item) => item.id === itemId));
    const item = chapter?.items.find((entry) => entry.id === itemId);
    const context: InboxSubjectContext | undefined = item && selectedCourse && chapter
      ? {
          courseId: selectedCourse.id,
          courseTitle: selectedCourse.title,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          itemId: item.id,
          itemTitle: item.title,
          itemType: item.type,
        }
      : undefined;

    conversations.push({
      id,
      participantIds: [student.id, recipient.id],
      courseId: selectedCourse?.id || null,
      createdAt: '2026-10-01T02:00:00.000Z',
      isDemo: true,
    });

    messages.push({
      id: `demo-inbox:${id}:question`,
      conversationId: id,
      senderId: student.id,
      body: question,
      context,
      createdAt: '2026-10-01T02:00:00.000Z',
      readBy: unreadByRecipient ? [student.id] : [student.id, recipient.id],
      isDemo: true,
    });

    if (reply) {
      messages.push({
        id: `demo-inbox:${id}:reply`,
        conversationId: id,
        senderId: recipient.id,
        body: reply,
        createdAt: '2026-10-01T02:12:00.000Z',
        readBy: [recipient.id],
        isDemo: true,
      });
    }
  };

  if (course && teacher) {
    add(
      learner,
      teacher,
      course,
      'it-write-v1',
      'ในบทเริ่มเขียนจากผู้อ่าน ถ้ามีผู้อ่านหลายกลุ่ม ควรเริ่มเขียนจากกลุ่มไหนก่อนครับ?',
      'เริ่มจากผู้อ่านหลักที่ต้องนำข้อความไปใช้ครับ แล้วตรวจว่ากลุ่มอื่นต้องการบริบทเพิ่มเติมตรงไหน',
      false
    );
    add(
      other,
      teacher,
      course,
      'it-write-q1',
      'โจทย์ที่ให้ปรับประโยค ต้องอธิบายเหตุผลของทุกคำที่แก้ไหมคะ?',
      null,
      true
    );
  }

  add(
    learner,
    admin,
    null,
    null,
    'เรียนจบแล้วจะเปิดดูใบรับรองได้จากตรงไหนครับ?',
    'เปิดเมนูใบรับรองในพื้นที่ผู้เรียนได้เลยครับ หากยังไม่แสดง ลองตรวจว่าผ่านแบบฝึกหัดครบแล้ว',
    false
  );

  return { inboxConversations: conversations, inboxMessages: messages, inboxDemoVersion: 1 };
}

export function mergeInboxDemo(data: LmsData): LmsData {
  if (data.inboxDemoVersion && data.inboxDemoVersion >= 1) return data;
  const demo = createInboxDemo(data);
  const existing = new Set((data.inboxConversations || []).map((entry) => entry.id));
  const additions = demo.inboxConversations.filter((entry) => !existing.has(entry.id));
  const addedIds = new Set(additions.map((entry) => entry.id));
  return {
    ...data,
    inboxDemoVersion: 1,
    inboxConversations: [...(data.inboxConversations || []), ...additions],
    inboxMessages: [...(data.inboxMessages || []), ...demo.inboxMessages.filter((entry) => addedIds.has(entry.conversationId))],
  };
}
