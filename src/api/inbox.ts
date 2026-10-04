import type { Course, InboxConversation, InboxMessage, InboxSubjectContext, LmsData, Role, User } from '../types/index.ts';

export const inboxPathForRole = (role: Role): string =>
  ({ learner: '/learn/inbox', instructor: '/teach/inbox', admin: '/admin/inbox' })[role] || '/learn/inbox';

export function inboxConversationKey(userId: string, recipientId: string, courseId?: string | null): string {
  return `dm:${[userId, recipientId].sort().map(encodeURIComponent).join(':')}:${encodeURIComponent(courseId || 'support')}`;
}

export interface InboxContact {
  key: string;
  user: User;
  course: Course | null;
}

export function getInboxContacts(data: LmsData, user: User | null): InboxContact[] {
  if (user?.role !== 'learner' || user.status !== 'active') return [];
  const enrolled = new Set((data.enrollments || []).filter((entry) => entry.userId === user.id).map((entry) => entry.courseId));
  const instructors: InboxContact[] = (data.courses || []).filter((course) => enrolled.has(course.id)).flatMap((course) => {
    const recipient = (data.users || []).find((entry) => entry.id === course.instructorId && entry.role === 'instructor' && entry.status === 'active');
    return recipient ? [{ key: inboxConversationKey(user.id, recipient.id, course.id), user: recipient, course }] : [];
  });
  const admins: InboxContact[] = (data.users || []).filter((entry) => entry.role === 'admin' && entry.status === 'active' && entry.id !== user.id)
    .map((recipient) => ({ key: inboxConversationKey(user.id, recipient.id), user: recipient, course: null }));
  return [...instructors, ...admins];
}

export function getInboxLessonContext(
  data: LmsData,
  user: User | null,
  courseId?: string | null,
  itemId?: string,
  chapterId?: string
): InboxSubjectContext | null {
  if (!courseId || (!itemId && !chapterId) || !getInboxContacts(data, user).some((entry) => entry.course?.id === courseId)) return null;
  const course = data.courses.find((entry) => entry.id === courseId);
  const chapter = course?.chapters.find((entry) => itemId ? entry.items.some((item) => item.id === itemId) : entry.id === chapterId);
  if (!chapter || (chapterId && chapter.id !== chapterId)) return null;
  const item = chapter?.items.find((entry) => entry.id === itemId);
  return {
    courseId,
    courseTitle: course?.title,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    ...(item && { itemId: item.id, itemTitle: item.title, itemType: item.type }),
  };
}

export function canAccessInboxConversation(data: LmsData, conversation: InboxConversation, user: User | null): boolean {
  if (!user || user.status !== 'active' || !conversation?.participantIds?.includes(user.id)) return false;
  if (user.role === 'instructor') return (data.courses || []).some((course) => course.id === conversation.courseId && course.instructorId === user.id);
  return user.role === 'learner' || user.role === 'admin';
}

export function getInboxMessages(data: LmsData, conversation: InboxConversation, user: User | null): InboxMessage[] {
  if (!canAccessInboxConversation(data, conversation, user)) return [];
  return (data.inboxMessages || []).filter((entry) => entry.conversationId === conversation.id);
}

export interface InboxThread extends InboxConversation {
  otherUser?: User;
  course?: Course;
  messages: InboxMessage[];
  lastMessage?: InboxMessage;
  unreadCount: number;
}

export function getInboxThreads(data: LmsData, user: User | null): InboxThread[] {
  if (!user) return [];
  return (data.inboxConversations || [])
    .filter((entry) => canAccessInboxConversation(data, entry, user))
    .map((conversation) => {
      const messages = getInboxMessages(data, conversation, user);
      return {
        ...conversation,
        otherUser: (data.users || []).find((entry) => conversation.participantIds.includes(entry.id) && entry.id !== user.id),
        course: (data.courses || []).find((entry) => entry.id === conversation.courseId),
        messages,
        lastMessage: messages[messages.length - 1],
        unreadCount: messages.filter((entry) => entry.senderId !== user.id && !entry.readBy?.includes(user.id)).length,
      };
    })
    .sort((a, b) => new Date(b.lastMessage?.createdAt || b.createdAt || 0).getTime() - new Date(a.lastMessage?.createdAt || a.createdAt || 0).getTime());
}
