// PROVISIONAL MOCK — Flow G (AI chat, practice and course support), development/tests only.
//
// Mock-only assumptions:
// - The deterministic provider has no latency and returns three practice questions.
// - Admin and the owning Instructor may attach any published AI-enabled course to a chat; learners need Enrollment.
// - A course's description, each non-empty article body, and each saved transcript count as one knowledge source.

import type {
  AiConversationRecord, AiMessageRecord, Clock, CourseRecord, Db, PracticeQuestionRecord, PracticeSnapshot, UserRecord,
} from './db.ts';
import { bangkokDate, ApiError, noContent, notFound, ok, paginate, queryProblems, readObject, rejectUnknownFields, requireRole, requireUser, validationFailed } from './http.ts';
import type { FieldError, RequestContext, Route } from './http.ts';
import { iso, nextId } from './db.ts';
import { courseItems, findEnrollment, isPublished } from './domain.ts';

type Usage = { limit: number; used: number; remaining: number; reset_at: string };
type UsageState = { succeeded: Map<string, number>; pending: Map<string, number> };
const usageStates = new WeakMap<Db, UsageState>();

function state(db: Db): UsageState {
  let value = usageStates.get(db);
  if (!value) {
    value = { succeeded: new Map(), pending: new Map() };
    usageStates.set(db, value);
  }
  return value;
}

function nextBangkokMidnight(date: string): string {
  const tomorrow = new Date(`${date}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return new Date(`${tomorrow.toISOString().slice(0, 10)}T17:00:00Z`).toISOString().replace('.000Z', 'Z');
}

function usage(context: RequestContext, userId: string, date = bangkokDate(context.clock.now())): Usage {
  const current = state(context.db);
  const used = current.succeeded.get(`${userId}:${date}`) ?? 0;
  return { limit: context.config.aiDailyPromptLimit, used, remaining: Math.max(0, context.config.aiDailyPromptLimit - used), reset_at: nextBangkokMidnight(date) };
}

function courseOr404(db: Db, id: string): CourseRecord {
  const course = db.courses.get(id);
  if (!course) throw notFound();
  return course;
}

function courseAccess(context: RequestContext, course: CourseRecord, user: UserRecord): boolean {
  return user.roles.includes('admin') || course.instructor_id === user.id || Boolean(findEnrollment(context.db, user.id, course.id));
}

function checkCourse(context: RequestContext, courseId: string, user: UserRecord): CourseRecord {
  const course = courseOr404(context.db, courseId);
  if (!isPublished(course) || !courseAccess(context, course, user)) {
    throw new ApiError(403, 'forbidden', 'ไม่มีสิทธิ์ใช้งานคอร์สนี้');
  }
  if (!course.ai_enabled) {
    throw new ApiError(409, 'invalid_state', 'คอร์สนี้ยังไม่เปิด AI', { details: { reason: 'ai_disabled' } });
  }
  return course;
}

function checkAttachCourse(context: RequestContext, courseId: string, user: UserRecord): CourseRecord {
  const course = courseOr404(context.db, courseId);
  if (!isPublished(course)) throw new ApiError(403, 'forbidden', 'ไม่มีสิทธิ์ใช้งานคอร์สนี้');
  if (!course.ai_enabled) throw new ApiError(409, 'invalid_state', 'คอร์สนี้ยังไม่เปิด AI', { details: { reason: 'ai_disabled' } });
  if (!courseAccess(context, course, user)) throw new ApiError(403, 'forbidden', 'ไม่มีสิทธิ์ใช้งานคอร์สนี้');
  return course;
}

function findItem(course: CourseRecord, itemId: string) {
  return courseItems(course).find((item) => item.id === itemId);
}

function transcriptView(course: CourseRecord, itemId: string) {
  const item = findItem(course, itemId);
  if (!item || item.type !== 'video') throw notFound();
  return { item_id: item.id, text: item.ai_transcript?.text ?? '', edited_by: item.ai_transcript?.edited_by ?? null, edited_at: item.ai_transcript?.edited_at ?? null };
}

function sourceCount(course: CourseRecord): number {
  let count = course.description ? 1 : 0;
  for (const item of courseItems(course)) {
    if (item.type === 'article' && item.body) count += 1;
    if (item.type === 'video' && item.ai_transcript?.text) count += 1;
  }
  return count;
}

function publicPractice(snapshot: PracticeSnapshot): Record<string, unknown> {
  return {
    topic_id: snapshot.topic_id,
    questions: snapshot.questions.map((question) => {
      const answer = snapshot.answers[question.id];
      return {
        id: question.id,
        prompt: question.prompt,
        options: question.options.map((option) => ({ id: option.id, text: option.text })),
        answered: Boolean(answer),
        ...(answer ? {
          my_option_id: answer.option_id,
          result: { correct: answer.option_id === question.correct_option_id, explanation: question.explanation },
        } : {}),
      };
    }),
  };
}

function messageView(message: AiMessageRecord): Record<string, unknown> {
  return {
    id: message.id, role: message.role, kind: message.kind, content: message.content, status: message.status,
    request_id: message.request_id, created_at: message.created_at, completed_at: message.completed_at,
    error_code: message.error_code, practice: message.practice ? publicPractice(message.practice) : null,
  };
}

function conversationOr404(context: RequestContext, id: string): AiConversationRecord {
  const user = requireUser(context);
  const conversation = context.db.aiConversations.get(id);
  if (!conversation || conversation.user_id !== user.id) throw notFound();
  return conversation;
}

function validText(body: Record<string, unknown>, field: string, problems: FieldError[], max: number): string {
  const value = body[field];
  if (typeof value !== 'string' || value.length < 1) {
    problems.push({ field, code: 'required' });
    return '';
  }
  if (value.length > max) problems.push({ field, code: 'too_long' });
  return value;
}

function hash(text: string): number {
  let result = 2166136261;
  for (const char of text) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}

function makePractice(messageId: string, content: string, courseId: string | null, now: string): PracticeSnapshot {
  const seed = hash(`${messageId}:${content}:${courseId ?? ''}`);
  const questions: PracticeQuestionRecord[] = Array.from({ length: 3 }, (_, index) => {
    const optionCount = 3 + ((seed + index) % 2);
    const options = Array.from({ length: optionCount }, (__, optionIndex) => ({ id: `opt_${messageId}_${index + 1}_${optionIndex + 1}`, text: `ตัวเลือก ${optionIndex + 1}` }));
    return {
      id: `practice_${messageId}_${index + 1}`,
      prompt: `คำถามฝึกหัดข้อที่ ${index + 1}`,
      options,
      correct_option_id: options[(seed + index) % optionCount].id,
      explanation: `คำอธิบายของข้อที่ ${index + 1}`,
    };
  });
  return { topic_id: `topic_${seed.toString(36)}`, questions, answers: {} };
}

function answerError(message: string): ApiError {
  return new ApiError(422, 'validation_failed', message);
}

function practiceAnswer(context: RequestContext): Record<string, unknown> {
  const user = requireUser(context);
  const conversation = conversationOr404(context, context.params.id);
  const message = context.db.aiMessages.get(context.params.messageId);
  if (!message || message.conversation_id !== conversation.id || message.user_id !== user.id || message.kind !== 'practice_set' || !message.practice) throw notFound();
  const body = readObject(context);
  rejectUnknownFields(body, ['question_id', 'option_id']);
  const problems: FieldError[] = [];
  const questionId = typeof body.question_id === 'string' ? body.question_id : '';
  const optionId = typeof body.option_id === 'string' ? body.option_id : '';
  if (!questionId) problems.push({ field: 'question_id', code: 'required' });
  if (!optionId) problems.push({ field: 'option_id', code: 'required' });
  if (problems.length) throw validationFailed(problems);
  const question = message.practice.questions.find((item) => item.id === questionId);
  if (!question) throw answerError('ไม่พบข้อฝึกหัดที่ขอ');
  if (!question.options.some((option) => option.id === optionId)) throw answerError('ตัวเลือกไม่อยู่ในข้อฝึกหัดนี้');
  message.practice.answers[question.id] = { option_id: optionId, answered_at: iso(context.clock.now()) };
  const correct = optionId === question.correct_option_id;
  const answered = Object.keys(message.practice.answers).length;
  const total = message.practice.questions.length;
  const correctCount = message.practice.questions.filter((item) => {
    const answer = message.practice!.answers[item.id];
    return answer && answer.option_id === item.correct_option_id;
  }).length;
  return {
    question_id: question.id, correct, explanation: question.explanation,
    summary: answered === total ? { answered, total, correct_count: correctCount } : null,
  };
}

export const aiRoutes: Route[] = [
  {
    method: 'PATCH', path: 'admin/courses/:id/ai-support',
    handler: (context) => {
      requireRole(context, 'admin');
      const course = courseOr404(context.db, context.params.id);
      const body = readObject(context);
      rejectUnknownFields(body, ['ai_enabled']);
      if (typeof body.ai_enabled !== 'boolean') throw validationFailed([{ field: 'ai_enabled', code: 'required' }]);
      course.ai_enabled = body.ai_enabled;
      return ok({ course_id: course.id, ai_enabled: course.ai_enabled });
    },
  },
  {
    method: 'GET', path: 'admin/courses/:id/videos/:itemId/ai-transcript',
    handler: (context) => {
      requireRole(context, 'admin');
      return ok(transcriptView(courseOr404(context.db, context.params.id), context.params.itemId));
    },
  },
  {
    method: 'PUT', path: 'admin/courses/:id/videos/:itemId/ai-transcript',
    handler: (context) => {
      const admin = requireRole(context, 'admin');
      const course = courseOr404(context.db, context.params.id);
      const item = findItem(course, context.params.itemId);
      if (!item || item.type !== 'video') throw notFound();
      const body = readObject(context);
      rejectUnknownFields(body, ['text']);
      if (typeof body.text !== 'string' || body.text.length > 200000) throw validationFailed([{ field: 'text', code: typeof body.text === 'string' ? 'too_long' : 'required' }]);
      item.ai_transcript = { text: body.text, edited_by: admin.id, edited_at: iso(context.clock.now()) };
      return ok(transcriptView(course, item.id));
    },
  },
  {
    method: 'POST', path: 'me/ai/conversations',
    handler: (context) => {
      const user = requireUser(context);
      const body = context.body === undefined ? {} : readObject(context);
      rejectUnknownFields(body, ['title', 'course_id']);
      const problems: FieldError[] = [];
      let title = 'แชตใหม่';
      if ('title' in body) {
        if (typeof body.title !== 'string' || body.title.trim() === '' || body.title.trim().length > 80) problems.push({ field: 'title', code: 'invalid' });
        else title = body.title.trim();
      }
      let courseId: string | null = null;
      if ('course_id' in body) {
        if (typeof body.course_id !== 'string' || body.course_id.trim() === '') problems.push({ field: 'course_id', code: 'invalid' });
        else courseId = body.course_id;
      }
      if (problems.length) throw validationFailed(problems);
      if (courseId) checkAttachCourse(context, courseId, user);
      const now = iso(context.clock.now());
      const conversation: AiConversationRecord = { id: nextId(context.db, 'aic'), user_id: user.id, title, course_id: courseId, created_at: now, updated_at: now };
      context.db.aiConversations.set(conversation.id, conversation);
      return ok({ id: conversation.id, title: conversation.title, course_id: conversation.course_id, created_at: now, updated_at: now });
    },
  },
  {
    method: 'GET', path: 'me/ai/conversations',
    handler: (context) => {
      const user = requireUser(context);
      const problems = queryProblems(context.query, ['q', 'limit', 'cursor']);
      const query = context.query.get('q')?.toLowerCase() ?? '';
      const matches = [...context.db.aiConversations.values()].filter((conversation) => {
        if (conversation.user_id !== user.id) return false;
        if (!query) return true;
        const messages = [...context.db.aiMessages.values()].filter((message) => message.conversation_id === conversation.id).map((message) => message.content).join(' ');
        return `${conversation.title} ${messages}`.toLowerCase().includes(query);
      }).sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id.localeCompare(a.id));
      const page = paginate(matches, context.query, context.config, problems);
      return ok({ items: page.items.map((conversation) => ({ id: conversation.id, title: conversation.title, course_id: conversation.course_id, created_at: conversation.created_at, updated_at: conversation.updated_at })), next_cursor: page.next_cursor });
    },
  },
  {
    method: 'GET', path: 'me/ai/conversations/:id/messages',
    handler: (context) => {
      const conversation = conversationOr404(context, context.params.id);
      const problems = queryProblems(context.query, ['limit', 'cursor']);
      const messages = [...context.db.aiMessages.values()].filter((message) => message.conversation_id === conversation.id).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
      const page = paginate(messages, context.query, context.config, problems);
      return ok({ items: page.items.map(messageView), next_cursor: page.next_cursor });
    },
  },
  {
    method: 'PATCH', path: 'me/ai/conversations/:id',
    handler: (context) => {
      const conversation = conversationOr404(context, context.params.id);
      const body = readObject(context);
      rejectUnknownFields(body, ['title']);
      const problems: FieldError[] = [];
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) problems.push({ field: 'title', code: 'required' });
      else if (title.length > 80) problems.push({ field: 'title', code: 'too_long' });
      if (problems.length) throw validationFailed(problems);
      conversation.title = title;
      return ok({ id: conversation.id, title: conversation.title, course_id: conversation.course_id, created_at: conversation.created_at, updated_at: conversation.updated_at });
    },
  },
  {
    method: 'DELETE', path: 'me/ai/conversations/:id',
    handler: (context) => {
      const conversation = conversationOr404(context, context.params.id);
      context.db.aiConversations.delete(conversation.id);
      for (const [id, message] of context.db.aiMessages) if (message.conversation_id === conversation.id) context.db.aiMessages.delete(id);
      return noContent();
    },
  },
  {
    method: 'GET', path: 'me/ai/usage',
    handler: (context) => ok(usage(context, requireUser(context).id)),
  },
  {
    method: 'POST', path: 'me/ai/conversations/:id/messages',
    handler: (context) => {
      const user = requireUser(context);
      const conversation = conversationOr404(context, context.params.id);
      const body = readObject(context);
      rejectUnknownFields(body, ['content', 'request_id', 'course_id']);
      const problems: FieldError[] = [];
      const content = validText(body, 'content', problems, 4000);
      const requestId = typeof body.request_id === 'string' && body.request_id.length >= 8 && body.request_id.length <= 64 ? body.request_id : '';
      if (!requestId) problems.push({ field: 'request_id', code: 'invalid' });
      if ('course_id' in body && typeof body.course_id !== 'string') problems.push({ field: 'course_id', code: 'invalid' });
      if (problems.length) throw validationFailed(problems);
      const existing = [...context.db.aiMessages.values()].find((message) => message.conversation_id === conversation.id && message.request_id === requestId);
      if (existing) {
        const assistant = existing.role === 'assistant' ? existing : [...context.db.aiMessages.values()].find((message) => message.conversation_id === conversation.id && message.request_id === requestId && message.role === 'assistant');
        return ok({ message: messageView(assistant ?? existing), usage: usage(context, user.id) });
      }
      const selectedCourseId = typeof body.course_id === 'string' ? body.course_id : conversation.course_id;
      const course = selectedCourseId ? checkCourse(context, selectedCourseId, user) : null;
      const acceptedDate = bangkokDate(context.clock.now());
      const current = state(context.db);
      const key = `${user.id}:${acceptedDate}`;
      const used = current.succeeded.get(key) ?? 0;
      const pending = current.pending.get(key) ?? 0;
      if (used + pending >= context.config.aiDailyPromptLimit) {
        throw new ApiError(429, 'ai_quota_exceeded', 'โควตา AI วันนี้ครบแล้ว', { details: { ...usage(context, user.id, acceptedDate), remaining: 0 } });
      }
      current.pending.set(key, pending + 1);
      const now = iso(context.clock.now());
      const userMessage: AiMessageRecord = {
        id: nextId(context.db, 'aim'), conversation_id: conversation.id, user_id: user.id, role: 'user', kind: 'text',
        content, status: 'pending', request_id: requestId, created_at: now, completed_at: null, usage_date: acceptedDate,
        context_course_id: course?.id ?? null, error_code: null, practice: null,
      };
      context.db.aiMessages.set(userMessage.id, userMessage);
      const isPractice = content.startsWith('/quiz') || content.includes('สร้างแบบฝึกหัด');
      const assistant: AiMessageRecord = {
        id: nextId(context.db, 'aim'), conversation_id: conversation.id, user_id: user.id, role: 'assistant',
        kind: isPractice ? 'practice_set' : 'text', content: '', status: 'pending', request_id: requestId,
        created_at: now, completed_at: null, usage_date: acceptedDate, context_course_id: course?.id ?? null, error_code: null, practice: null,
      };
      context.db.aiMessages.set(assistant.id, assistant);
      const failedCode = content.includes('__mock_ai_fail__') ? 'ai_provider_error' : (isPractice && content.includes('__mock_ai_malformed_practice__') ? 'ai_malformed_response' : null);
      if (failedCode) {
        assistant.status = 'failed';
        assistant.error_code = failedCode;
      } else {
        assistant.status = 'succeeded';
        assistant.completed_at = iso(context.clock.now());
        if (isPractice) {
          assistant.practice = makePractice(assistant.id, content, course?.id ?? null, now);
          assistant.content = '[จำลอง] สร้างชุดฝึกหัดแล้ว';
        } else {
          assistant.content = `[จำลอง] คำตอบจาก AI (ใช้แหล่งความรู้ ${course ? sourceCount(course) : 0} แหล่ง)`;
        }
        current.succeeded.set(key, used + 1);
      }
      current.pending.set(key, pending);
      userMessage.status = assistant.status;
      userMessage.completed_at = assistant.completed_at;
      conversation.updated_at = iso(context.clock.now());
      return ok({ message: messageView(assistant), usage: usage(context, user.id) });
    },
  },
  {
    method: 'PUT', path: 'me/ai/conversations/:id/messages/:messageId/practice/answers',
    handler: (context) => ok(practiceAnswer(context)),
  },
];
