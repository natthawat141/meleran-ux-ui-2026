import type {
  BlogPost,
  Certificate,
  Course,
  EmailVerification,
  Enrollment,
  LmsData,
  Notification,
  Quiz,
  QuizAttempt,
  RedeemCode,
  User,
} from '../types';
import { migrateLegacyRedeemCodes } from './redeem-code.ts';

const RETIRED_COLLECTIONS = [
  'orders',
  'accessCodes',
  'cartItems',
  'mockPriceEmails',
  'referralLinks',
  'instructorPayouts',
  'financeDemoSeedVersion',
  'instructorRequests',
  'invitations',
  'assignments',
  'comparisonSets',
  'inboxConversations',
  'inboxMessages',
  'inboxDemoVersion',
] as const;

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isCourse(value: unknown): value is Course {
  return isRecord(value) &&
    isString(value.id) && isString(value.slug) && isString(value.title) &&
    isString(value.category) && isString(value.level) && typeof value.price === 'number' &&
    isString(value.instructorId) && isString(value.status) && isString(value.cover) &&
    Array.isArray(value.chapters) && value.chapters.every((chapter) => isRecord(chapter) &&
      isString(chapter.id) && isString(chapter.title) && Array.isArray(chapter.items) &&
      chapter.items.every((item) => isRecord(item) && isString(item.id) && isString(item.type) && isString(item.title)));
}

function isUser(value: unknown): value is User {
  return isRecord(value) && isString(value.id) && isString(value.name) && isString(value.email) &&
    (value.role === 'learner' || value.role === 'instructor' || value.role === 'admin');
}

function isQuiz(value: unknown): value is Quiz {
  return isRecord(value) && isString(value.id) && isString(value.courseId) && isString(value.title) &&
    typeof value.passPercent === 'number' && Array.isArray(value.questions);
}

function isAttempt(value: unknown): value is QuizAttempt {
  return isRecord(value) && isString(value.id) && isString(value.quizId) && isString(value.courseId) &&
    isString(value.userId) && isRecord(value.answers) &&
    (value.essayStatus === 'none' || value.essayStatus === 'pending' || value.essayStatus === 'graded') &&
    (value.passed === true || value.passed === false || value.passed === null) &&
    (value.status === 'in_progress' || value.status === 'draft' || value.status === 'submitted');
}

function isEnrollment(value: unknown): value is Enrollment {
  return isRecord(value) && isString(value.id) && isString(value.courseId) &&
    isString(value.userId) && isString(value.createdAt);
}

function isCertificate(value: unknown): value is Certificate {
  return isRecord(value) && isString(value.id) && isString(value.code) &&
    isString(value.courseId) && isString(value.userId) && isString(value.issuedAt);
}

function isBlogPost(value: unknown): value is BlogPost {
  return isRecord(value) && isString(value.id) && isString(value.title) &&
    isString(value.category) && isString(value.excerpt) && isString(value.body) &&
    isString(value.authorId) && (value.status === 'draft' || value.status === 'published') &&
    isString(value.createdAt) && isString(value.updatedAt);
}

function isEmailVerification(value: unknown): value is EmailVerification {
  return isRecord(value) && isString(value.id) && isString(value.userId) &&
    isString(value.token) && isString(value.createdAt) && isString(value.expiresAt) &&
    isString(value.lastSentAt);
}

function isRedeemCode(value: unknown): value is RedeemCode {
  return isRecord(value) && isString(value.id) && isString(value.code) &&
    isString(value.courseId) && isString(value.createdAt) && isString(value.createdBy) &&
    (value.status === 'unused' || value.status === 'used' || value.status === 'revoked');
}

function isNotification(value: unknown): value is Notification {
  return isRecord(value) && isString(value.id) && isString(value.type) &&
    isString(value.title) && isString(value.description);
}

function isRetiredNotification(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const type = isString(value.type) ? value.type : '';
  const href = isString(value.href) ? value.href : '';
  return type.startsWith('inbox_') || type.startsWith('assignment_') ||
    href.includes('/inbox') || href.includes('/assignments') || Object.hasOwn(value, 'conversationId');
}

function readRows<T>(key: string, value: unknown, predicate: (item: unknown) => item is T, rejected: RecordValue): T[] {
  if (!Array.isArray(value)) {
    if (value !== undefined) rejected[key] = value;
    return [];
  }
  const rows: T[] = [];
  const rejectedRows: unknown[] = [];
  value.forEach((entry) => {
    if (predicate(entry)) rows.push(entry);
    else rejectedRows.push(entry);
  });
  if (rejectedRows.length) rejected[key] = rejectedRows;
  return rows;
}

function collectRemovedMetadata(entries: unknown[], pick: (entry: RecordValue) => RecordValue | null): RecordValue[] {
  return entries.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const metadata = pick(entry);
    return metadata ? [{ id: entry.id, ...metadata }] : [];
  });
}

function withoutFields<T extends object>(value: T, fields: readonly string[]): T {
  const output = { ...value };
  fields.forEach((field) => Reflect.deleteProperty(output, field));
  return output;
}

export function normalizePrototypeSnapshot(raw: unknown, initialData: LmsData, now: string): LmsData {
  if (!isRecord(raw)) {
    return normalizePrototypeSnapshot({ legacyPrototype: { collections: { unreadableStoredSnapshot: raw } } }, initialData, now);
  }

  const rejectedSnapshotFields: RecordValue = {};
  const existingLegacy = isRecord(raw.legacyPrototype) && isRecord(raw.legacyPrototype.collections)
    ? raw.legacyPrototype.collections
    : {};
  const collections: RecordValue = { ...existingLegacy };
  RETIRED_COLLECTIONS.forEach((key) => {
    if (Object.hasOwn(raw, key)) collections[key] = raw[key];
  });

  const users = readRows('users', raw.users, isUser, rejectedSnapshotFields).map((user) =>
    withoutFields(user, ['baseSharePercent', 'referralSharePercent']) as User
  );
  const courses = readRows('courses', raw.courses, isCourse, rejectedSnapshotFields);
  const blogPosts = readRows('blogPosts', raw.blogPosts, isBlogPost, rejectedSnapshotFields);
  const quizzes = readRows('quizzes', raw.quizzes, isQuiz, rejectedSnapshotFields).map((quiz) =>
    withoutFields(quiz, ['assessmentStage', 'comparisonSetId']) as Quiz
  );
  const attempts = readRows('attempts', raw.attempts, isAttempt, rejectedSnapshotFields).map((attempt) =>
    withoutFields(attempt, ['assignmentId']) as QuizAttempt
  );
  const enrollments = readRows('enrollments', raw.enrollments, isEnrollment, rejectedSnapshotFields).map((enrollment) =>
    withoutFields(enrollment, ['referralCode', 'referralLinkId', 'referralInstructorId']) as Enrollment
  );
  const certificates = readRows('certificates', raw.certificates, isCertificate, rejectedSnapshotFields);

  const legacyFieldSnapshots = {
    userFinanceFields: collectRemovedMetadata(Array.isArray(raw.users) ? raw.users : [], (entry) => {
      const metadata: RecordValue = {};
      if (Object.hasOwn(entry, 'baseSharePercent')) metadata.baseSharePercent = entry.baseSharePercent;
      if (Object.hasOwn(entry, 'referralSharePercent')) metadata.referralSharePercent = entry.referralSharePercent;
      return Object.keys(metadata).length ? metadata : null;
    }),
    quizComparisonFields: collectRemovedMetadata(Array.isArray(raw.quizzes) ? raw.quizzes : [], (entry) => {
      const metadata: RecordValue = {};
      if (Object.hasOwn(entry, 'assessmentStage')) metadata.assessmentStage = entry.assessmentStage;
      if (Object.hasOwn(entry, 'comparisonSetId')) metadata.comparisonSetId = entry.comparisonSetId;
      return Object.keys(metadata).length ? metadata : null;
    }),
    attemptAssignmentRefs: collectRemovedMetadata(Array.isArray(raw.attempts) ? raw.attempts : [], (entry) =>
      isString(entry.assignmentId) ? { assignmentId: entry.assignmentId } : null
    ),
    enrollmentReferralFields: collectRemovedMetadata(Array.isArray(raw.enrollments) ? raw.enrollments : [], (entry) => {
      const metadata: RecordValue = {};
      ['referralCode', 'referralLinkId', 'referralInstructorId'].forEach((key) => {
        if (Object.hasOwn(entry, key)) metadata[key] = entry[key];
      });
      return Object.keys(metadata).length ? metadata : null;
    }),
    retiredNotifications: Array.isArray(raw.notifications)
      ? raw.notifications.filter(isRetiredNotification)
      : [],
  };
  Object.entries(legacyFieldSnapshots).forEach(([key, entries]) => {
    if (entries.length && !Object.hasOwn(collections, key)) collections[key] = entries;
  });

  const legacyRedeemCodes = migrateLegacyRedeemCodes({
    rawCodes: collections.accessCodes,
    rawOrders: collections.orders,
    enrollments,
    now,
  });
  const redeemCodes = Array.isArray(raw.redeemCodes)
    ? readRows('redeemCodes', raw.redeemCodes, isRedeemCode, rejectedSnapshotFields)
    : legacyRedeemCodes.length
      ? legacyRedeemCodes
      : [];

  const progress: LmsData['progress'] = {};
  if (isRecord(raw.progress)) {
    const rejectedProgress: RecordValue = {};
    Object.entries(raw.progress).forEach(([key, value]) => {
      if (!isRecord(value)) {
        rejectedProgress[key] = value;
        return;
      }
      const usersWithProgress: Record<string, boolean> = {};
      const rejectedUsers: RecordValue = {};
      Object.entries(value).forEach(([userId, done]) => {
        if (typeof done === 'boolean') usersWithProgress[userId] = done;
        else rejectedUsers[userId] = done;
      });
      progress[key] = usersWithProgress;
      if (Object.keys(rejectedUsers).length) rejectedProgress[key] = rejectedUsers;
    });
    if (Object.keys(rejectedProgress).length) rejectedSnapshotFields.progress = rejectedProgress;
  } else if (raw.progress !== undefined) {
    rejectedSnapshotFields.progress = raw.progress;
  }

  const emailVerifications = readRows('emailVerifications', raw.emailVerifications, isEmailVerification, rejectedSnapshotFields);
  const notifications = Array.isArray(raw.notifications)
    ? readRows('notifications', raw.notifications.filter((entry) => !isRetiredNotification(entry)), isNotification, rejectedSnapshotFields)
      .map((notification) => withoutFields(notification, ['conversationId']) as Notification)
    : undefined;
  if (Object.keys(rejectedSnapshotFields).length) {
    const previous = isRecord(collections.rejectedSnapshotFields) ? collections.rejectedSnapshotFields : {};
    collections.rejectedSnapshotFields = { ...previous, ...rejectedSnapshotFields };
  }
  const legacyPrototype = Object.keys(collections).length ? { collections } : undefined;
  return {
    users,
    currentUserId: raw.currentUserId === null || isString(raw.currentUserId) ? raw.currentUserId : null,
    courses,
    blogPosts,
    quizzes,
    attempts,
    enrollments,
    redeemCodes,
    certificates,
    progress,
    emailVerifications,
    ...(notifications && { notifications }),
    ...(legacyPrototype && { legacyPrototype }),
  };
}
