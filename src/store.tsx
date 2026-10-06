import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import { createId, DEMO_ACCOUNTS, flattenItems, initialData, seedCourseCoverReplacements } from './data';
import defaultCourseCover from './assets/generated/course-default-v2.png';
import { canAccessInboxConversation, getInboxContacts, getInboxLessonContext, inboxPathForRole } from './api/inbox';
import { MAX_INBOX_ATTACHMENT_BYTES, MAX_INBOX_ATTACHMENTS, MAX_INBOX_TOTAL_ATTACHMENT_BYTES } from './api/inboxAttachments';
import { mergeInboxDemo } from './mocks/inbox';
import { certificateRecipient, snapshotLegacyCertificateNames, validateProfile } from './lib/profile-model';
import { cashCodeShareAmounts, commitCashCodeRedemption, normalizeAccessCode, quoteAccessCode } from './lib/access-code-utils';
import { assignmentHasHistory, assignmentIncludesLearner, assignmentSaveIssue, canManageCourse, contentRemovalIssue } from './lib/learning-history';
import { EMAIL_VERIFICATION_RESEND_COOLDOWN_MS, EMAIL_VERIFICATION_TTL_MS, verificationResendAvailable, verificationResendRemainingMs, verificationTokenState } from './lib/email-verification';
import { canEditCourse, canPublishCourse, canReviewCourse, canSubmitCourse, coursePublicationIssue, invalidateCourseReview } from './lib/course-review';
import type {
  ActionResult,
  AccessCode,
  AccessCodeKind,
  CreateAccessCodeInput,
  CreateAccessCodeResult,
  CreateReferralLinkResult,
  InstructorPayoutResult,
  InstructorPayout,
  ReferralLink,
  CartItem,
  PriceAlertEmail,
  Assignment,
  BlogPost,
  Certificate,
  Chapter,
  ComparisonSet,
  Course,
  CourseItem,
  Enrollment,
  EmailVerification,
  InboxConversation,
  InboxMessage,
  LmsContextType,
  LmsData,
  Order,
  Quiz,
  QuizAnswerValue,
  QuizAttempt,
  ReorderResult,
  Role,
  SendInboxMessageArgs,
  SendInboxMessageResult,
  User,
  WorkspaceSaveResult,
} from './types';

const STORAGE_KEY = 'stay-elearn-ux-v2';
const LEGACY_DEFAULT_COVER = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=85';
const LmsContext = createContext<LmsContextType | null>(null);

interface AppNotification {
  id: string;
  userId?: string;
  type: string;
  title: string;
  description: string;
  href?: string;
  conversationId?: string;
  createdAt?: string;
  readAt?: string | null;
}

interface StoredLmsData extends Partial<LmsData> {
  notifications?: AppNotification[];
}

function addNotification(data: StoredLmsData, notification: AppNotification) {
  if (!notification.userId) return;
  if (!Array.isArray(data.notifications)) data.notifications = [];
  if (data.notifications.some((entry) => entry.id === notification.id)) return;
  data.notifications.unshift({ ...notification, createdAt: new Date().toISOString(), readAt: null });
}

function normalizeBlogCover(cover?: string): string | undefined {
  if (typeof cover !== 'string') return undefined;
  const trimmed = cover.trim();
  if (!trimmed) return undefined;
  if (/^data:image\//i.test(trimmed) && trimmed.length < 80) return undefined;
  if (/^https?:\/\/127\.0\.0\.1:\d+\//i.test(trimmed)) return undefined;
  return trimmed;
}

function normalizeBlogPosts(posts?: unknown): BlogPost[] {
  if (!Array.isArray(posts)) return structuredClone(initialData.blogPosts);
  return posts.map((post) => {
    const cover = normalizeBlogCover(post.cover);
    const next: BlogPost = { ...post, coverKey: post.coverKey || 'writing' };
    if (cover) next.cover = cover;
    else delete next.cover;
    return next;
  });
}

function loadData(): LmsData & { notifications?: AppNotification[] } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const courses: Course[] = Array.isArray(parsed.courses)
        ? parsed.courses.map((course: Course) => {
            if (course.cover === LEGACY_DEFAULT_COVER || course.cover?.includes('course-default-v1')) {
              return { ...course, cover: defaultCourseCover };
            }
            const replacement = seedCourseCoverReplacements[course.id];
            return replacement && (course.cover === replacement.from || course.cover?.includes(replacement.previousGenerated))
              ? { ...course, cover: replacement.to }
              : course;
          })
        : structuredClone(initialData.courses);
      courses.forEach((course) =>
        course.chapters.forEach((chapter) =>
          chapter.items.forEach((item) => {
            if (!item.id) item.id = createId('item');
          })
        )
      );
      const assignments: Assignment[] =
        Array.isArray(parsed.assignments) && parsed.assignments.length
          ? parsed.assignments.map((assignment: Assignment & { learnerIds?: unknown }) => 'learnerIds' in assignment && Array.isArray(assignment.learnerIds) ? { ...assignment, stage: assignment.stage ?? 'practice', assigneeType: 'specific', assigneeIds: assignment.learnerIds.filter((id: unknown): id is string => typeof id === 'string') } : assignment)
          : structuredClone(initialData.assignments || []);
      const comparisonSets: ComparisonSet[] =
        Array.isArray(parsed.comparisonSets) && parsed.comparisonSets.length
          ? parsed.comparisonSets
          : structuredClone(initialData.comparisonSets || []);
      const attempts: QuizAttempt[] = Array.isArray(parsed.attempts) ? parsed.attempts : [];
      (initialData.attempts || []).forEach((a) => {
        if (!attempts.some((item) => item.id === a.id)) attempts.push(a);
      });
      const quizzes: Quiz[] = Array.isArray(parsed.quizzes) ? parsed.quizzes : structuredClone(initialData.quizzes || []);
      (initialData.quizzes || []).forEach((q) => {
        if (!quizzes.some((item) => item.id === q.id)) quizzes.push(q);
      });
      const users: User[] = Array.isArray(parsed.users) ? parsed.users : structuredClone(initialData.users || []);
      users.forEach((user) => {
        if (user.role !== 'instructor') return;
        const sample = initialData.users.find((entry) => entry.id === user.id);
        user.baseSharePercent = Number.isFinite(Number(user.baseSharePercent)) ? Number(user.baseSharePercent) : Number(sample?.baseSharePercent ?? 70);
        user.referralSharePercent = Number.isFinite(Number(user.referralSharePercent)) ? Number(user.referralSharePercent) : Number(sample?.referralSharePercent ?? 85);
      });
      (initialData.users || []).forEach((u) => {
        if (!users.some((item) => item.id === u.id)) users.push(u);
      });
      const enrollments: Enrollment[] = Array.isArray(parsed.enrollments)
        ? parsed.enrollments
        : structuredClone(initialData.enrollments || []);
      const financeEnrollmentIds = new Set(['enroll-focus-direct', 'enroll-focus-referral', 'enroll-data-direct', 'enroll-data-referral']);
      (initialData.enrollments || []).filter((entry) => !financeEnrollmentIds.has(entry.id)).forEach((e) => {
        if (!enrollments.some((item) => item.id === e.id)) enrollments.push(e);
      });
      const orders: Order[] = Array.isArray(parsed.orders) ? parsed.orders : structuredClone(initialData.orders);
      const cartItems: CartItem[] = Array.isArray(parsed.cartItems) ? parsed.cartItems : [];
      const mockPriceEmails: PriceAlertEmail[] = Array.isArray(parsed.mockPriceEmails) ? parsed.mockPriceEmails : [];
      const accessCodes: AccessCode[] = Array.isArray(parsed.accessCodes) ? parsed.accessCodes : [];
      const referralLinks: ReferralLink[] = Array.isArray(parsed.referralLinks) ? parsed.referralLinks : structuredClone(initialData.referralLinks);
      const instructorPayouts: InstructorPayout[] = Array.isArray(parsed.instructorPayouts) ? parsed.instructorPayouts : [];
      if (!parsed.financeDemoSeedVersion && !orders.some((order) => order.status === 'paid')) {
        initialData.orders.forEach((order) => { if (!orders.some((item) => item.id === order.id)) orders.push(structuredClone(order)); });
        initialData.enrollments.forEach((entry) => {
          if (!enrollments.some((item) => item.courseId === entry.courseId && item.userId === entry.userId)) enrollments.push(structuredClone(entry));
        });
        initialData.referralLinks.forEach((link) => { if (!referralLinks.some((item) => item.code === link.code)) referralLinks.push(structuredClone(link)); });
      }
      return mergeInboxDemo({
        ...initialData,
        ...parsed,
        courses,
        blogPosts: normalizeBlogPosts(parsed.blogPosts),
        assignments,
        comparisonSets,
        attempts,
        quizzes,
        users,
        certificates: snapshotLegacyCertificateNames(Array.isArray(parsed.certificates) ? parsed.certificates : initialData.certificates, users),
        enrollments,
        orders,
        cartItems,
        mockPriceEmails,
        accessCodes,
        referralLinks,
        instructorPayouts,
        financeDemoSeedVersion: initialData.financeDemoSeedVersion,
        inboxDemoVersion: parsed.inboxDemoVersion || 0,
        inboxConversations: Array.isArray(parsed.inboxConversations) ? parsed.inboxConversations : [],
        inboxMessages: Array.isArray(parsed.inboxMessages) ? parsed.inboxMessages : [],
      }) as LmsData & { notifications?: AppNotification[] };
    }
  } catch {
    /* Start with the sample data if storage is unavailable or invalid. */
  }
  return structuredClone(initialData) as LmsData & { notifications?: AppNotification[] };
}

function awardCertificate(data: LmsData, courseId: string, userId: string): LmsData {
  const course = data.courses.find((item) => item.id === courseId);
  if (!course || data.certificates.some((item) => item.courseId === courseId && item.userId === userId)) return data;
  const items = flattenItems(course);
  const complete = items.every((item) =>
    item.type === 'quiz'
      ? data.attempts.some((attempt) => attempt.quizId === item.quizId && attempt.userId === userId && attempt.passed === true)
      : Boolean(data.progress[`${courseId}:${item.id}`]?.[userId])
  );
  if (!complete || items.length === 0) return data;
  const newCert: Certificate = {
    id: createId('cert'),
    code: `STAY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    courseId,
    userId,
    issuedAt: new Date().toISOString(),
    recipientName: certificateRecipient(data.users.find((item) => item.id === userId) || { id: userId, name: 'ผู้เรียน' }),
  };
  return {
    ...data,
    certificates: [...data.certificates, newCert],
  };
}

export function LmsProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<LmsData & { notifications?: AppNotification[] }>(loadData);
  const persistWarnedRef = useRef(false);
  const redeemingCodesRef = useRef(new Set<string>());

  useEffect(() => {
    redeemingCodesRef.current.clear();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      persistWarnedRef.current = false;
    } catch {
      if (!persistWarnedRef.current) {
        persistWarnedRef.current = true;
        message.warning('บันทึกลงเบราว์เซอร์ไม่สำเร็จ รูปหรือเนื้อหาอาจหายหลังรีเฟรช ลองลดจำนวนรูปในบทความ');
      }
    }
  }, [data]);

  const update = useCallback(
    (recipe: (current: LmsData & { notifications?: AppNotification[] }) => LmsData & { notifications?: AppNotification[] }) => {
      setData((current) => recipe(structuredClone(current)));
    },
    []
  );

  const currentUser = useMemo(
    () => data.users.find((user) => user.id === data.currentUserId) ?? null,
    [data.users, data.currentUserId]
  );

  const createVerification = useCallback((userId: string, now = new Date()): EmailVerification => {
    const createdAt = now.toISOString();
    return {
      id: createId('email-verification'),
      userId,
      token: globalThis.crypto?.randomUUID?.() ?? createId('token'),
      createdAt,
      expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS).toISOString(),
      lastSentAt: createdAt,
    };
  }, []);

  const commitLearningChange = useCallback((next: LmsData): ActionResult => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { return { ok: false, message: 'บันทึกไม่ได้ พื้นที่เก็บในเบราว์เซอร์อาจไม่พอ' }; }
    setData(next);
    return { ok: true };
  }, []);

  const signIn = useCallback(
    (email: string, password?: string): ActionResult => {
      const user = data.users.find(
        (item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.password === password
      );
      if (!user) return { ok: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
      if (user.status === 'pending') return { ok: false, message: 'บัญชีผู้สอนยังรอแอดมินอนุมัติ' };
      update((next) => {
        next.currentUserId = user.id;
        return next;
      });
      return { ok: true, user };
    },
    [data.users, update]
  );

  const register = useCallback(
    ({ name, email, password }: { name: string; email: string; password?: string }): ActionResult => {
      if (data.users.some((item) => item.email.toLowerCase() === email.trim().toLowerCase())) {
        return { ok: false, message: 'อีเมลนี้มีบัญชีแล้ว' };
      }
      const user: User = {
        id: createId('u'),
        name: name.trim(),
        email: email.trim(),
        password: password || '',
        role: 'learner',
        bio: '',
        status: 'active',
        emailVerified: false,
      };
      const verification = createVerification(user.id);
      update((next) => {
        next.users.push(user);
        next.emailVerifications ??= [];
        next.emailVerifications.push(verification);
        next.currentUserId = user.id;
        return next;
      });
      return { ok: true, user, verificationUrl: `/verify-email?token=${encodeURIComponent(verification.token)}` };
    },
    [createVerification, data.users, update]
  );

  const verifyEmail = useCallback((token: string): ActionResult => {
    const verification = (data.emailVerifications ?? []).find((entry) => entry.token === token);
    const state = verificationTokenState(verification);
    if (state === 'missing') return { ok: false, message: 'ลิงก์ยืนยันนี้ไม่ถูกต้องหรือไม่มีอยู่แล้ว' };
    if (state === 'used') return { ok: false, message: 'ลิงก์นี้ใช้ยืนยันไปแล้ว เข้าสู่ระบบได้ตามปกติ' };
    if (state === 'expired') return { ok: false, message: 'ลิงก์หมดอายุแล้ว ขอส่งลิงก์ยืนยันใหม่ได้' };
    if (!verification) return { ok: false, message: 'ไม่พบลิงก์ยืนยันนี้' };
    const user = data.users.find((entry) => entry.id === verification.userId);
    if (!user) return { ok: false, message: 'ไม่พบบัญชีที่ต้องการยืนยัน' };
    update((next) => {
      const target = next.emailVerifications?.find((entry) => entry.id === verification.id);
      const targetUser = next.users.find((entry) => entry.id === verification.userId);
      if (target && !target.usedAt && verificationTokenState(target) === 'valid' && targetUser) {
        target.usedAt = new Date().toISOString();
        targetUser.emailVerified = true;
      }
      return next;
    });
    return { ok: true, user, message: 'ยืนยันอีเมลในต้นแบบสำเร็จแล้ว' };
  }, [data.emailVerifications, data.users, update]);

  const resendVerificationEmail = useCallback((): ActionResult => {
    if (!currentUser) return { ok: false, message: 'เข้าสู่ระบบก่อนขอลิงก์ยืนยัน' };
    if (currentUser.emailVerified !== false) return { ok: false, message: 'บัญชีนี้ไม่ต้องยืนยันอีเมลเพิ่ม' };
    const existing = (data.emailVerifications ?? []).filter((entry) => entry.userId === currentUser.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const now = Date.now();
    if (!verificationResendAvailable(existing, now)) {
      const waitSeconds = Math.ceil(verificationResendRemainingMs(existing, now) / 1000);
      return { ok: false, message: `ส่งลิงก์อีกครั้งได้ในประมาณ ${waitSeconds} วินาที` };
    }
    const verification = createVerification(currentUser.id, new Date(now));
    update((next) => {
      next.emailVerifications ??= [];
      next.emailVerifications = next.emailVerifications.filter((entry) => entry.userId !== currentUser.id);
      next.emailVerifications.push(verification);
      return next;
    });
    return { ok: true, message: 'สร้างลิงก์ยืนยันจำลองแล้ว ไม่มีการส่งอีเมลจริง', verificationUrl: `/verify-email?token=${encodeURIComponent(verification.token)}` };
  }, [createVerification, currentUser, data.emailVerifications, update]);

  const simulateGoogleAuth = useCallback((email: string): ActionResult => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return { ok: false, message: 'กรอกอีเมลสำหรับจำลองให้ถูกต้อง' };
    if (!currentUser) return { ok: false, message: 'เข้าสู่ระบบบัญชี Melearn เดิมก่อน แล้วจึงทดลองเชื่อม Google' };
    const emailOwner = data.users.find((user) => user.email.toLowerCase() === normalizedEmail);
    const linkedOwner = data.users.find((user) => user.googleLinkedEmail?.toLowerCase() === normalizedEmail);
    if ((emailOwner && emailOwner.id !== currentUser.id) || (linkedOwner && linkedOwner.id !== currentUser.id)) {
      return { ok: false, message: 'อีเมล Google นี้เป็นของบัญชีอื่น กรุณาเข้าสู่ระบบบัญชีนั้นก่อน ระบบไม่รวมบัญชีอัตโนมัติ' };
    }
    if (normalizedEmail !== currentUser.email.toLowerCase()) {
      return { ok: false, message: 'เพื่อยืนยันอีเมล ให้จำลอง Google ด้วยอีเมลเดียวกับบัญชีที่เข้าสู่ระบบอยู่' };
    }
    if (currentUser.googleLinkedEmail && currentUser.googleLinkedEmail.toLowerCase() !== normalizedEmail) return { ok: false, message: 'บัญชีนี้เชื่อม Google ไว้แล้ว' };
    update((next) => {
      const user = next.users.find((entry) => entry.id === currentUser.id);
      if (user) {
        user.googleLinkedEmail = normalizedEmail;
        user.emailVerified = true;
      }
      return next;
    });
    return { ok: true, message: 'บันทึกสถานะ Google จำลองให้บัญชีที่เข้าสู่ระบบแล้ว ไม่มีการยืนยัน OAuth จริงหรือเปลี่ยนบทบาท' };
  }, [currentUser, data.users, update]);

  const signOut = useCallback(() => {
    update((next) => {
      next.currentUserId = null;
      return next;
    });
  }, [update]);

  const signInDemo = useCallback(
    (role: Role): ActionResult => {
      const account = DEMO_ACCOUNTS.find((item) => item.role === role);
      return account ? signIn(account.email, account.password) : { ok: false, message: 'ไม่พบบัญชีตัวอย่าง' };
    },
    [signIn]
  );

  const resetDemo = useCallback(() => {
    setData(structuredClone(initialData) as LmsData & { notifications?: AppNotification[] });
  }, []);

  const saveBlogPost = useCallback(
    (values: Partial<BlogPost>, postId?: string): string | null => {
      if (currentUser?.role !== 'admin') return null;
      const savedId = postId ?? createId('post');
      update((next) => {
        const existing = next.blogPosts.find((post) => post.id === postId);
        const now = new Date().toISOString();
        const cover = normalizeBlogCover(values.cover);
        const record: BlogPost = {
          id: savedId,
          title: values.title ?? existing?.title ?? '',
          category: values.category ?? existing?.category ?? '',
          excerpt: values.excerpt ?? existing?.excerpt ?? '',
          body: values.body ?? existing?.body ?? '',
          status: values.status ?? existing?.status ?? 'draft',
          authorId: existing?.authorId ?? currentUser.id,
          coverKey: values.coverKey || existing?.coverKey || 'writing',
          readingMinutes: Math.max(2, Math.ceil((values.body || existing?.body || '').length / 500)),
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          publishedAt: values.status === 'published' ? existing?.publishedAt ?? now : null,
          ...existing,
          ...values,
        };
        if (cover) record.cover = cover;
        else delete record.cover;
        if (existing) {
          next.blogPosts = next.blogPosts.map((post) => (post.id === postId ? record : post));
        } else {
          next.blogPosts.unshift(record);
        }
        return next;
      });
      return savedId;
    },
    [currentUser, update]
  );

  const removeBlogPost = useCallback(
    (postId: string): boolean => {
      if (currentUser?.role !== 'admin') return false;
      update((next) => {
        next.blogPosts = next.blogPosts.filter((post) => post.id !== postId);
        return next;
      });
      return true;
    },
    [currentUser?.role, update]
  );

  const saveCourse = useCallback(
    (values: Partial<Course>, id?: string): string | null => {
      const target = data.courses.find((course) => course.id === id);
      if (
        !currentUser ||
        !['admin', 'instructor'].includes(currentUser.role) ||
        (target && currentUser.role !== 'admin' && target.instructorId !== currentUser.id)
      ) {
        return null;
      }
      const selectedInstructorId = currentUser.role === 'admin'
        ? values.instructorId || target?.instructorId
        : target?.instructorId || currentUser.id;
      if (!data.users.some((user) => user.id === selectedInstructorId && user.role === 'instructor')) return null;
      const savedId = id ?? createId('course');
      update((next) => {
        const existing = next.courses.find((course) => course.id === id);
        const now = new Date().toISOString();
        const previousStatus = existing?.status ?? 'draft';
        const fields = ['slug', 'title', 'subtitle', 'description', 'category', 'level', 'price', 'instructorId', 'cover', 'chapters', 'outcomes'] as const;
        const changed = Boolean(existing && fields.some((field) => JSON.stringify(values[field] ?? existing[field]) !== JSON.stringify(existing[field])));
        const editableCourse = existing && changed
          ? invalidateCourseReview(existing, currentUser.id, now)
          : existing;
        const record: Course = {
          slug: values.slug || values.title?.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-') || savedId,
          title: values.title ?? existing?.title ?? '',
          subtitle: values.subtitle ?? existing?.subtitle,
          description: values.description ?? existing?.description,
          category: values.category ?? existing?.category ?? 'ทั่วไป',
          level: values.level ?? existing?.level ?? 'เริ่มต้น',
          price: values.price ?? existing?.price ?? 0,
          chapters: existing?.chapters ?? [],
          cover: values.cover ?? existing?.cover ?? defaultCourseCover,
          ...(existing ?? {}),
          ...(values ?? {}),
          id: savedId,
          updatedAt: now,
          status: editableCourse?.status ?? previousStatus,
          instructorId: currentUser.role === 'admin'
            ? values.instructorId || existing?.instructorId || currentUser.id
            : existing?.instructorId || currentUser.id,
          reviewHistory: editableCourse?.reviewHistory ?? existing?.reviewHistory,
        };
        if (!record.cover) record.cover = defaultCourseCover;
      const previousPrice = Number(existing?.price);
      const nextPrice = Number(record.price);
      if (existing?.status === 'published' && record.status === 'published' && Number.isFinite(previousPrice) && Number.isFinite(nextPrice) && previousPrice > nextPrice) {
        next.cartItems ??= [];
        next.mockPriceEmails ??= [];
        const now = new Date().toISOString();
        const watchers = next.cartItems.filter((entry) => entry.courseId === id && entry.priceAlertEnabled && !next.enrollments.some((enrollment) => enrollment.courseId === id && enrollment.userId === entry.userId) && !next.orders.some((order) => order.courseId === id && order.userId === entry.userId && order.status === 'paid'));
        watchers.forEach((entry) => {
          const recipient = next.users.find((user) => user.id === entry.userId);
          if (!recipient?.email) return;
          next.mockPriceEmails.unshift({ id: createId('price-email'), userId: entry.userId, courseId: existing.id, courseTitle: record.title, to: recipient.email, previousPrice, newPrice: nextPrice, createdAt: now, status: 'mock-sent' });
        });
      }

        if (existing) {
          next.courses = next.courses.map((course) => (course.id === id ? record : course));
        } else {
          next.courses.unshift(record);
        }
        return next;
      });
      return savedId;
    },
    [currentUser, data.courses, data.users, update]
  );

  const submitCourseForReview = useCallback((courseId: string): ActionResult => {
    const course = data.courses.find((entry) => entry.id === courseId);
    if (!course || !canSubmitCourse(currentUser, course)) return { ok: false, message: 'ส่งตรวจได้เฉพาะฉบับร่างที่คุณมีสิทธิ์จัดการ' };
    const issue = coursePublicationIssue(course, data.users, data.quizzes);
    if (issue) return { ok: false, message: issue };
    const now = new Date().toISOString();
    update((next) => {
      const target = next.courses.find((entry) => entry.id === courseId);
      if (!target || !canSubmitCourse(currentUser, target)) return next;
      target.status = 'pending_review';
      target.reviewHistory = [...(target.reviewHistory ?? []), { action: 'submitted', actorId: currentUser!.id, at: now }];
      target.updatedAt = now;
      return next;
    });
    return { ok: true, message: 'ส่งคอร์สให้แอดมินตรวจแล้ว' };
  }, [currentUser, data.courses, data.quizzes, data.users, update]);

  const reviewCourse = useCallback((courseId: string, decision: 'approve' | 'return', reason = ''): ActionResult => {
    const course = data.courses.find((entry) => entry.id === courseId);
    if (!course || !canReviewCourse(currentUser, course)) return { ok: false, message: 'ไม่มีสิทธิ์ตรวจคอร์สนี้ หรือคอร์สไม่ได้อยู่ในคิวตรวจ' };
    if (decision === 'approve') {
      const issue = coursePublicationIssue(course, data.users, data.quizzes);
      if (issue) return { ok: false, message: issue };
    }
    if (decision === 'return' && !reason.trim()) return { ok: false, message: 'ระบุเหตุผลก่อนส่งคอร์สกลับให้ผู้สอน' };
    const now = new Date().toISOString();
    update((next) => {
      const target = next.courses.find((entry) => entry.id === courseId);
      if (!target || !canReviewCourse(currentUser, target)) return next;
      target.status = decision === 'approve' ? 'approved' : 'draft';
      target.reviewHistory = [...(target.reviewHistory ?? []), { action: decision === 'approve' ? 'approved' : 'returned', actorId: currentUser!.id, at: now, ...(reason.trim() ? { reason: reason.trim() } : {}) }];
      target.updatedAt = now;
      return next;
    });
    return { ok: true, message: decision === 'approve' ? 'อนุมัติคอร์สแล้ว รอผู้สอนหรือแอดมินเผยแพร่' : 'ส่งคอร์สกลับให้ผู้สอนแล้ว' };
  }, [currentUser, data.courses, data.quizzes, data.users, update]);

  const publishCourse = useCallback((courseId: string): ActionResult => {
    const course = data.courses.find((entry) => entry.id === courseId);
    if (!course || !canPublishCourse(currentUser, course)) return { ok: false, message: 'เผยแพร่ได้หลังอนุมัติ และต้องเป็นผู้สอนเจ้าของคอร์สหรือแอดมิน' };
    const issue = coursePublicationIssue(course, data.users, data.quizzes);
    if (issue) return { ok: false, message: issue };
    const now = new Date().toISOString();
    update((next) => {
      const target = next.courses.find((entry) => entry.id === courseId);
      if (!target || !canPublishCourse(currentUser, target)) return next;
      target.status = 'published';
      target.updatedAt = now;
      target.reviewHistory = [...(target.reviewHistory ?? []), { action: 'published', actorId: currentUser!.id, at: now }];
      return next;
    });
    return { ok: true, message: 'เผยแพร่คอร์สแล้ว' };
  }, [currentUser, data.courses, data.quizzes, data.users, update]);

  const removeCourse = useCallback(
    (courseId: string) => {
      const course = data.courses.find((entry) => entry.id === courseId);
      if (!course || !canEditCourse(currentUser, course)) return;
      update((next) => {
        next.courses = next.courses.filter((course) => course.id !== courseId);
        next.quizzes = next.quizzes.filter((quiz) => quiz.courseId !== courseId);
        next.attempts = next.attempts.filter((attempt) => attempt.courseId !== courseId);
        next.enrollments = next.enrollments.filter((item) => item.courseId !== courseId);
        next.certificates = next.certificates.filter((item) => item.courseId !== courseId);
        next.cartItems = next.cartItems.filter((item) => item.courseId !== courseId);
        Object.keys(next.progress)
          .filter((key) => key.startsWith(`${courseId}:`))
          .forEach((key) => delete next.progress[key]);
        return next;
      });
    },
    [currentUser, data.courses, update]
  );

  const saveChapter = useCallback(
    (courseId: string, values: Partial<Chapter>, chapterId?: string) => {
      const course = data.courses.find((entry) => entry.id === courseId);
      if (!course || !canEditCourse(currentUser, course)) return;
      const now = new Date().toISOString();
      update((next) => {
        next.courses = next.courses.map((course) => {
          if (course.id !== courseId) return course;
          const targetId = chapterId ?? values.id ?? createId('ch');
          const chapter: Chapter = {
            id: targetId,
            title: values.title ?? '',
            description: values.description ?? '',
            items: values.items ?? course.chapters.find((item) => item.id === targetId)?.items ?? [],
          };
          const chapters = (chapterId || values.id)
            ? course.chapters.map((item) => (item.id === targetId ? chapter : item))
            : [...course.chapters, chapter];
          return { ...invalidateCourseReview(course, currentUser!.id, now), chapters, updatedAt: now };
        });
        return next;
      });
    },
    [currentUser, data.courses, update]
  );

  // Reordering changes IDs' positions only, preserving content and learning history.
  const reorderCurriculum = useCallback(
    (courseId: string, chapterId: string | null | undefined, orderedIds: string[]): ReorderResult => {
      const course = data.courses.find((entry) => entry.id === courseId);
      if (
        !course ||
        !currentUser ||
        (currentUser.role !== 'admin' && !(currentUser.role === 'instructor' && course.instructorId === currentUser.id))
      ) {
        return { ok: false, message: 'ไม่มีสิทธิ์เรียงเนื้อหาในคอร์สนี้' };
      }
      const entries = chapterId ? course.chapters.find((entry) => entry.id === chapterId)?.items : course.chapters;
      if (
        !entries ||
        orderedIds.length !== entries.length ||
        new Set(orderedIds).size !== entries.length ||
        orderedIds.some((id) => !entries.some((entry) => entry.id === id))
      ) {
        return { ok: false, message: 'รายการถูกเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่' };
      }
      const next = structuredClone(data);
      const target = next.courses.find((entry) => entry.id === courseId);
      if (!target) return { ok: false, message: 'ไม่พบคอร์ส' };
      Object.assign(target, invalidateCourseReview(target, currentUser.id, new Date().toISOString()));

      if (chapterId) {
        const chapter = target.chapters.find((entry) => entry.id === chapterId);
        if (chapter) {
          chapter.items = orderedIds
            .map((id) => chapter.items.find((entry) => entry.id === id))
            .filter((item): item is CourseItem => Boolean(item));
        }
      } else {
        target.chapters = orderedIds
          .map((id) => target.chapters.find((entry) => entry.id === id))
          .filter((ch): ch is Chapter => Boolean(ch));
      }
      target.updatedAt = new Date().toISOString();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        return { ok: false, message: 'บันทึกลำดับไม่ได้ พื้นที่เก็บในเบราว์เซอร์ไม่พอ' };
      }
      setData(next);
      return { ok: true };
    },
    [currentUser, data]
  );

  // Commit the chapter workspace as one unit; a failed browser write keeps the draft open.
  const saveChapterWorkspace = useCallback(
    (courseId: string, chapter: Chapter, quizzes: Quiz[], baseline: string): WorkspaceSaveResult => {
      const course = data.courses.find((entry) => entry.id === courseId);
      const existing = course?.chapters.find((entry) => entry.id === chapter.id);
      if (
        !existing ||
        !currentUser ||
        (currentUser.role !== 'admin' && !(currentUser.role === 'instructor' && course?.instructorId === currentUser.id))
      ) {
        return { ok: false, message: 'ไม่มีสิทธิ์แก้บทนี้' };
      }
      const oldQuizzes = existing.items
        .filter((item): item is CourseItem & { quizId: string } => 'quizId' in item && Boolean(item.quizId))
        .map((item) => data.quizzes.find((quiz) => quiz.id === item.quizId))
        .filter((q): q is Quiz => Boolean(q));
      if (baseline !== JSON.stringify({ chapter: existing, quizzes: oldQuizzes })) {
        return { ok: false, message: 'ข้อมูลบทถูกเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่ก่อนแก้ต่อ' };
      }
      for (const old of existing.items) {
        const replacement = chapter.items.find((item) => item.id === old.id);
        const hasProgress = Object.values(data.progress[`${courseId}:${old.id}`] || {}).some(Boolean);
        const oldQuizId = 'quizId' in old ? old.quizId : undefined;
        const hasAttempts = oldQuizId && data.attempts.some((attempt) => attempt.quizId === oldQuizId);
        const hasAssignments = oldQuizId && (data.assignments || []).some((assignment) => assignment.quizId === oldQuizId);
        if (!replacement && (hasProgress || hasAttempts || hasAssignments)) {
          return { ok: false, message: 'นำรายการที่มีประวัติเรียนหรือคำตอบออกไม่ได้' };
        }
        if (
          hasAttempts &&
          JSON.stringify(oldQuizzes.find((quiz) => quiz.id === oldQuizId)) !==
            JSON.stringify(quizzes.find((quiz) => quiz.id === oldQuizId))
        ) {
          return { ok: false, message: 'แบบฝึกหัดมีประวัติแล้ว ให้สร้างชุดใหม่แทน' };
        }
      }
      const next = structuredClone(data);
      const target = next.courses.find((entry) => entry.id === courseId);
      if (!target) return { ok: false, message: 'ไม่พบคอร์ส' };
      Object.assign(target, invalidateCourseReview(target, currentUser.id, new Date().toISOString()));
      target.chapters = target.chapters.map((entry) => (entry.id === chapter.id ? structuredClone(chapter) : entry));
      target.updatedAt = new Date().toISOString();
      const retained = new Set(quizzes.map((quiz) => quiz.id));
      const removed = new Set(oldQuizzes.filter((quiz) => !retained.has(quiz.id)).map((quiz) => quiz.id));
      next.quizzes = next.quizzes
        .filter((quiz) => !retained.has(quiz.id) && !removed.has(quiz.id))
        .concat(structuredClone(quizzes));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        return { ok: false, message: 'พื้นที่เก็บในเบราว์เซอร์ไม่พอ ลองลดขนาดรูปหรือใช้ลิงก์วิดีโอ งานที่แก้ยังอยู่ในหน้านี้' };
      }
      setData(next);
      return { ok: true };
    },
    [currentUser, data]
  );

  const removeChapter = useCallback((courseId: string, chapterId: string): ActionResult => {
    const course = data.courses.find((entry) => entry.id === courseId);
    const chapter = course?.chapters.find((entry) => entry.id === chapterId);
    if (!chapter) return { ok: false, message: 'ไม่พบบทเรียนนี้' };
    const issue = contentRemovalIssue(data, currentUser, courseId, chapter.items);
    if (issue) return { ok: false, message: issue };
    const quizIds = chapter.items.flatMap((item) => 'quizId' in item && item.quizId ? [item.quizId] : []);
    const next = structuredClone(data);
    const targetCourse = next.courses.find((entry) => entry.id === courseId);
    if (targetCourse && currentUser) Object.assign(targetCourse, invalidateCourseReview(targetCourse, currentUser.id, new Date().toISOString()));
    next.quizzes = next.quizzes.filter((quiz) => !quizIds.includes(quiz.id));
    next.courses = next.courses.map((entry) => entry.id === courseId ? { ...entry, chapters: entry.chapters.filter((item) => item.id !== chapterId) } : entry);
    return commitLearningChange(next);
  }, [currentUser, data, commitLearningChange]);

  const saveItem = useCallback(
    (courseId: string, chapterId: string, values: Partial<CourseItem>) => {
      const course = data.courses.find((entry) => entry.id === courseId);
      if (!course || !canEditCourse(currentUser, course)) return;
      const now = new Date().toISOString();
      update((next) => {
        next.courses = next.courses.map((course) =>
          course.id !== courseId
            ? course
            : {
                ...invalidateCourseReview(course, currentUser!.id, now),
                chapters: course.chapters.map((chapter) =>
                  chapter.id !== chapterId
                    ? chapter
                    : {
                        ...chapter,
                        items: values.id
                          ? chapter.items.map((item) => (item.id === values.id ? ({ ...item, ...values } as CourseItem) : item))
                          : [...chapter.items, { ...values, id: createId('item') } as CourseItem],
                      }
                ),
              }
        );
        return next;
      });
    },
    [currentUser, data.courses, update]
  );

  const removeItem = useCallback((courseId: string, chapterId: string, itemId: string): ActionResult => {
    const item = data.courses.find((entry) => entry.id === courseId)?.chapters.find((entry) => entry.id === chapterId)?.items.find((entry) => entry.id === itemId);
    if (!item) return { ok: false, message: 'ไม่พบเนื้อหานี้' };
    const issue = contentRemovalIssue(data, currentUser, courseId, [item]);
    if (issue) return { ok: false, message: issue };
    const next = structuredClone(data);
    const targetCourse = next.courses.find((entry) => entry.id === courseId);
    if (targetCourse && currentUser) Object.assign(targetCourse, invalidateCourseReview(targetCourse, currentUser.id, new Date().toISOString()));
    const quizId = 'quizId' in item ? item.quizId : undefined;
    if (quizId) next.quizzes = next.quizzes.filter((quiz) => quiz.id !== quizId);
    next.courses = next.courses.map((entry) => entry.id !== courseId ? entry : { ...entry, chapters: entry.chapters.map((chapter) => chapter.id !== chapterId ? chapter : { ...chapter, items: chapter.items.filter((content) => content.id !== itemId) }) });
    return commitLearningChange(next);
  }, [currentUser, data, commitLearningChange]);

  const saveQuiz = useCallback(
    (values: Partial<Quiz>, quizId?: string): string | null => {
      const existingQuiz = data.quizzes.find((entry) => entry.id === quizId);
      const targetCourse = data.courses.find((entry) => entry.id === (values.courseId ?? existingQuiz?.courseId));
      if (!canManageCourse(currentUser, targetCourse) || (quizId && (!existingQuiz || !canManageCourse(currentUser, data.courses.find((entry) => entry.id === existingQuiz.courseId)) || data.attempts.some((attempt) => attempt.quizId === quizId)))) return null;
      const resultId = quizId ?? createId('quiz');
      update((next) => {
        const existing = next.quizzes.find((quiz) => quiz.id === quizId);
        const quiz: Quiz = {
          id: resultId,
          courseId: values.courseId ?? existing?.courseId ?? '',
          title: values.title ?? existing?.title ?? '',
          passPercent: values.passPercent ?? existing?.passPercent ?? 60,
          questions: values.questions ?? existing?.questions ?? [],
          ...existing,
          ...values,
        };
        if (existing) {
          next.quizzes = next.quizzes.map((item) => (item.id === quizId ? quiz : item));
        } else {
          next.quizzes.push(quiz);
        }
        const previousItem = next.courses
          .flatMap((course) => course.chapters.flatMap((chapter) => chapter.items))
          .find((item) => 'quizId' in item && item.quizId === resultId);

        if (existing) {
          next.courses = next.courses.map((course) => ({
            ...course,
            chapters: course.chapters.map((chapter) => ({
              ...chapter,
              items:
                course.id === values.courseId && chapter.id === values.chapterId
                  ? chapter.items.map((item) =>
                      'quizId' in item && item.quizId === resultId ? { ...item, title: quiz.title } : item
                    )
                  : chapter.items.filter((item) => !('quizId' in item) || item.quizId !== resultId),
            })),
          }));
        }
        if (values.courseId && values.chapterId) {
          const course = next.courses.find((item) => item.id === values.courseId);
          const chapter = course?.chapters.find((item) => item.id === values.chapterId);
          if (course && chapter && !chapter.items.some((item) => 'quizId' in item && item.quizId === resultId)) {
            const courseCopy = structuredClone(course);
            const chapterCopy = courseCopy.chapters.find((item) => item.id === values.chapterId);
            if (chapterCopy) {
              chapterCopy.items.push({
                id: previousItem?.id ?? createId('item'),
                type: 'quiz',
                title: quiz.title,
                quizId: resultId,
              });
              next.courses = next.courses.map((item) => (item.id === courseCopy.id ? courseCopy : item));
            }
          }
        }
        const affectedIds = new Set([existing?.courseId, values.courseId].filter((id): id is string => Boolean(id)));
        if (currentUser) next.courses.forEach((course) => {
          if (affectedIds.has(course.id)) Object.assign(course, invalidateCourseReview(course, currentUser.id, new Date().toISOString()));
        });
        return next;
      });
      return resultId;
    },
    [currentUser, data, update]
  );

  const removeQuiz = useCallback((quizId: string): ActionResult => {
    const quiz = data.quizzes.find((entry) => entry.id === quizId);
    const course = data.courses.find((entry) => entry.id === quiz?.courseId);
    if (!quiz || !course || !canManageCourse(currentUser, course)) return { ok: false, message: 'ไม่มีสิทธิ์ลบแบบฝึกหัดนี้' };
    if (data.attempts.some((attempt) => attempt.quizId === quizId)) return { ok: false, message: 'แบบฝึกหัดนี้มีประวัติคำตอบแล้ว จึงลบไม่ได้' };
    if ((data.assignments || []).some((assignment) => assignment.quizId === quizId)) return { ok: false, message: 'แบบฝึกหัดนี้ถูกมอบหมายแล้ว กรุณาจัดการงานมอบหมายก่อนลบ' };
    const items = course.chapters.flatMap((chapter) => chapter.items).filter((item) => 'quizId' in item && item.quizId === quizId);
    const issue = contentRemovalIssue(data, currentUser, course.id, items);
    if (issue) return { ok: false, message: issue };
    const next = structuredClone(data);
    const targetCourse = next.courses.find((entry) => entry.id === course.id);
    if (targetCourse && currentUser) Object.assign(targetCourse, invalidateCourseReview(targetCourse, currentUser.id, new Date().toISOString()));
    next.quizzes = next.quizzes.filter((entry) => entry.id !== quizId);
    next.courses = next.courses.map((entry) => ({ ...entry, chapters: entry.chapters.map((chapter) => ({ ...chapter, items: chapter.items.filter((item) => !('quizId' in item) || item.quizId !== quizId) })) }));
    return commitLearningChange(next);
  }, [currentUser, data, commitLearningChange]);

  const enrollFree = useCallback(
    (courseId: string, userId = currentUser?.id, referralCode: string | null = null): ActionResult => {
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.emailVerified === false)) return { ok: false, message: 'ยืนยันอีเมลก่อนลงเรียน' };
      if (userId !== currentUser.id) return { ok: false, message: 'ลงเรียนได้เฉพาะบัญชีที่เข้าสู่ระบบ' };
      const course = data.courses.find((entry) => entry.id === courseId);
      if (!course || course.status !== 'published' || course.price > 0) return { ok: false, message: 'คอร์สนี้ไม่พร้อมลงเรียนฟรี' };
      if (data.enrollments.some((entry) => entry.courseId === courseId && entry.userId === currentUser.id)) return { ok: false, message: 'คุณมีคอร์สนี้อยู่แล้ว' };
      update((next) => {
        const course = next.courses.find((entry) => entry.id === courseId);
        if (!userId || !course || course.price > 0 || course.status !== 'published' || next.enrollments.some((entry) => entry.courseId === courseId && entry.userId === userId)) {
          return next;
        }
        const link = next.referralLinks.find((entry) => entry.code.toLowerCase() === String(referralCode ?? '').toLowerCase() && entry.courseId === course.id && entry.instructorId === course.instructorId);
        next.enrollments.push({ id: createId('enroll'), courseId, userId, createdAt: new Date().toISOString(),
          ...(link ? { referralCode: link.code, referralLinkId: link.id, referralInstructorId: link.instructorId } : {}) });
        return next;
      });
      return { ok: true };
    },
    [currentUser, data.courses, data.enrollments, update]
  );

  const simulatePayment = useCallback((courseId: string, outcome: 'paid' | 'failed', referralCode: string | null = null, rawAccessCode = ''): string | null => {
    const course = data.courses.find((item) => item.id === courseId);
    if (!course || !currentUser || (currentUser.role !== 'admin' && currentUser.emailVerified === false) || course.status !== 'published') return null;
    const submittedCode = data.accessCodes.find((item) => normalizeAccessCode(item.code) === normalizeAccessCode(rawAccessCode));
    const quote = quoteAccessCode({ accessCodes: data.accessCodes, courseId, coursePrice: course.price, userId: currentUser.id, enrollments: data.enrollments, code: rawAccessCode });
    if (!quote.ok) return null;
    if (submittedCode?.kind === 'cash') {
      if (redeemingCodesRef.current.has(submittedCode.id)) return null;
      redeemingCodesRef.current.add(submittedCode.id);
    }
    const orderId = createId('order');
    update((next) => {
      const nextCourse = next.courses.find((item) => item.id === courseId);
      const nextQuote = quoteAccessCode({ accessCodes: next.accessCodes, courseId, coursePrice: nextCourse?.price ?? 0, userId: currentUser.id, enrollments: next.enrollments, code: rawAccessCode });
      if (!nextCourse || !nextQuote.ok) return next;
      const accessCode = nextQuote.code;
      const isAccessGranted = nextQuote.source === 'cash_code' || nextQuote.source === 'free_code';
      const finalStatus: 'paid' | 'failed' = isAccessGranted ? 'paid' : outcome;
      const instructor = next.users.find((user) => user.id === nextCourse.instructorId);
      const link = next.referralLinks.find((item) => item.code.toLowerCase() === String(referralCode ?? '').toLowerCase() && item.courseId === nextCourse.id && item.instructorId === nextCourse.instructorId);
      const sharePercent = Number(link ? instructor?.referralSharePercent ?? 85 : instructor?.baseSharePercent ?? 70);
      const amount = nextQuote.amount;
      const { instructorShareAmount, platformShareAmount } = cashCodeShareAmounts(amount, sharePercent);
      const method = nextQuote.source === 'cash_code' ? 'เงินสดผ่านโค้ด' : nextQuote.source === 'free_code' ? 'โค้ดเรียนฟรี' : 'บัตรจำลอง';
      const order: Order = {
        id: orderId,
        courseId,
        userId: currentUser.id,
        amount,
        listPrice: nextQuote.listPrice,
        discountAmount: nextQuote.discountAmount,
        status: finalStatus,
        method,
        source: nextQuote.source,
        ...(accessCode ? { accessCodeId: accessCode.id, accessCode: accessCode.code, accessCodeKind: accessCode.kind } : {}),
        createdAt: new Date().toISOString(),
        instructorId: nextCourse.instructorId,
        ...(finalStatus === 'paid' ? {
          instructorSharePercent: sharePercent,
          instructorShareAmount,
          platformShareAmount,
          payoutStatus: amount > 0 ? 'pending' : 'not_applicable',
        } : {}),
        ...(link ? { referralCode: link.code, referralLinkId: link.id } : {}),
      };
      if (accessCode?.kind === 'cash' && finalStatus === 'paid') {
        const transition = commitCashCodeRedemption({ accessCodes: next.accessCodes, orders: next.orders, enrollments: next.enrollments, accessCodeId: accessCode.id, userId: currentUser.id, order, redeemedAt: order.createdAt });
        if (!transition) return next;
        next.accessCodes = transition.accessCodes;
        next.orders = transition.orders;
        next.enrollments = transition.enrollments;
      } else {
        next.orders.unshift(order);
      }
      if (finalStatus === 'paid') {
        if (accessCode && accessCode.kind !== 'cash') next.accessCodes = next.accessCodes.map((item) => {
          if (item.id !== accessCode.id) return item;
          return { ...item, usedCount: item.usedCount + 1, lastUsedAt: order.createdAt };
        });
        next.cartItems = next.cartItems.filter((entry) => entry.courseId !== courseId || entry.userId !== currentUser.id);
        if (!next.enrollments.some((entry) => entry.courseId === courseId && entry.userId === currentUser.id)) {
          next.enrollments.push({ id: createId('enroll'), courseId, userId: currentUser.id, createdAt: new Date().toISOString(), ...(link ? { referralCode: link.code, referralLinkId: link.id, referralInstructorId: link.instructorId } : {}) });
        }
      }
      return next;
    });
    return orderId;
  }, [currentUser, data.accessCodes, data.courses, data.enrollments, update]);

  const createAccessCode = useCallback((values: CreateAccessCodeInput): CreateAccessCodeResult => {
    if (currentUser?.role !== 'admin') return { ok: false, message: 'เฉพาะแอดมินเท่านั้นที่ออกโค้ดได้' };
    const course = data.courses.find((item) => item.id === values.courseId && item.status === 'published' && Number(item.price) > 0);
    if (!course) return { ok: false, message: 'เลือกคอร์สที่เผยแพร่และมีราคามากกว่าศูนย์' };
    const kind: AccessCodeKind = values.kind;
    const code = normalizeAccessCode(values.code || `MELEARN-${createId('code').replace(/^code-/, '').slice(0, 6)}`);
    if (!['percent', 'fixed', 'free', 'cash'].includes(kind)) return { ok: false, message: 'เลือกประเภทโค้ดให้ถูกต้อง' };
    if (!/^[A-Z0-9-]{4,24}$/.test(code)) return { ok: false, message: 'โค้ดต้องมี 4–24 ตัว ใช้ได้เฉพาะ A–Z, 0–9 และขีดกลาง' };
    if (data.accessCodes.some((item) => normalizeAccessCode(item.code) === code)) return { ok: false, message: 'มีโค้ดนี้อยู่แล้ว กรุณาใช้รหัสอื่น' };
    const value = Number(values.value);
    const receivedAmount = Number(values.receivedAmount);
    if (kind === 'percent' && (!Number.isFinite(value) || value <= 0 || value > 100)) return { ok: false, message: 'ส่วนลดต้องอยู่ระหว่าง 1–100%' };
    if (kind === 'fixed' && (!Number.isFinite(value) || value <= 0 || value > Number(course.price))) return { ok: false, message: 'ส่วนลดต้องมากกว่าศูนย์และไม่เกินราคาคอร์ส' };
    if (kind === 'cash' && (!Number.isFinite(receivedAmount) || receivedAmount <= 0 || receivedAmount > Number(course.price))) return { ok: false, message: 'ยอดรับเงินสดต้องมากกว่าศูนย์และไม่เกินราคาคอร์ส' };
    const maxUses = kind === 'cash' ? 1 : values.maxUses ?? null;
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) return { ok: false, message: 'จำนวนครั้งที่ใช้ต้องเป็นจำนวนเต็มอย่างน้อย 1' };
    const expiryDate = values.expiresAt ? new Date(`${values.expiresAt}T23:59:59`) : null;
    if (expiryDate && (!Number.isFinite(expiryDate.getTime()) || expiryDate.getTime() < Date.now())) return { ok: false, message: 'วันหมดอายุต้องเป็นวันนี้หรือวันหลังจากนี้' };
    const accessCode: AccessCode = {
      id: createId('access-code'), code, courseId: course.id, kind,
      ...(kind === 'percent' || kind === 'fixed' ? { value } : {}),
      ...(kind === 'cash' ? { receivedAmount } : {}),
      maxUses, usedCount: 0, status: 'active', createdAt: new Date().toISOString(), createdBy: currentUser.id,
      ...(expiryDate ? { expiresAt: expiryDate.toISOString() } : {}),
    };
    update((next) => { next.accessCodes.unshift(accessCode); return next; });
    return { ok: true, accessCode };
  }, [currentUser, data.accessCodes, data.courses, update]);

  const setAccessCodeStatus = useCallback((accessCodeId: string, status: 'active' | 'inactive'): ActionResult => {
    if (currentUser?.role !== 'admin') return { ok: false, message: 'เฉพาะแอดมินเท่านั้นที่จัดการโค้ดได้' };
    if (!data.accessCodes.some((item) => item.id === accessCodeId)) return { ok: false, message: 'ไม่พบโค้ดนี้' };
    update((next) => { next.accessCodes = next.accessCodes.map((item) => item.id === accessCodeId ? { ...item, status } : item); return next; });
    return { ok: true };
  }, [currentUser, data.accessCodes, update]);

  const addCourseToCart = useCallback((courseId: string, referralCode: string | null = null): ActionResult & { alreadyAdded?: boolean } => {
    const course = data.courses.find((item) => item.id === courseId && item.status === 'published');
    if (!currentUser || !['learner', 'admin'].includes(currentUser.role)) return { ok: false, message: 'เข้าสู่ระบบในฐานะผู้เรียนก่อนเพิ่มคอร์ส' };
    if (currentUser.role !== 'admin' && currentUser.emailVerified === false) return { ok: false, message: 'ยืนยันอีเมลก่อนเริ่มซื้อคอร์ส' };
    if (!course || course.price <= 0) return { ok: false, message: 'คอร์สนี้ไม่ต้องใช้ตะกร้า' };
    if (data.enrollments.some((item) => item.courseId === courseId && item.userId === currentUser.id) || data.orders.some((item) => item.courseId === courseId && item.userId === currentUser.id && item.status === 'paid')) return { ok: false, message: 'คุณมีคอร์สนี้อยู่แล้ว' };
    if (data.cartItems.some((item) => item.courseId === courseId && item.userId === currentUser.id)) return { ok: true, alreadyAdded: true };
    const referral = data.referralLinks.find((item) => item.code.toLowerCase() === String(referralCode ?? '').toLowerCase() && item.courseId === course.id && item.instructorId === course.instructorId);
    update((next) => { next.cartItems.push({ id: createId('cart'), courseId, userId: currentUser.id, createdAt: new Date().toISOString(), priceAlertEnabled: false, ...(referral ? { referralCode: referral.code } : {}) }); return next; });
    return { ok: true };
  }, [currentUser, data.courses, data.enrollments, data.orders, data.cartItems, data.referralLinks, update]);

  const removeCourseFromCart = useCallback((cartItemId: string): boolean => {
    if (!currentUser || !data.cartItems.some((entry) => entry.id === cartItemId && entry.userId === currentUser.id)) return false;
    update((next) => {
      next.cartItems = next.cartItems.filter((entry) => entry.id !== cartItemId);
      return next;
    });
    return true;
  }, [currentUser, data.cartItems, update]);

  const setCoursePriceAlert = useCallback((courseId: string, enabled: boolean): boolean => {
    if (!currentUser || !data.cartItems.some((entry) => entry.courseId === courseId && entry.userId === currentUser.id)) return false;
    update((next) => {
      next.cartItems = next.cartItems.map((entry) => {
        if (entry.courseId !== courseId || entry.userId !== currentUser.id) return entry;
        return { ...entry, priceAlertEnabled: Boolean(enabled) };
      });
      return next;
    });
    return true;
  }, [currentUser, data.cartItems, update]);

  const createReferralLink = useCallback((courseId: string): CreateReferralLinkResult => {
    const course = data.courses.find((item) => item.id === courseId);
    if (currentUser?.role !== 'instructor' || !course || course.instructorId !== currentUser.id || course.status !== 'published') return { ok: false, message: 'สร้างลิงก์ได้เฉพาะคอร์สที่เผยแพร่ของคุณ' };
    const link: ReferralLink = { id: createId('ref'), code: createId('code').replace(/^code-/, '').toUpperCase(), instructorId: currentUser.id, courseId, createdAt: new Date().toISOString() };
    update((next) => { next.referralLinks ??= []; next.referralLinks.unshift(link); return next; });
    return { ok: true, link };
  }, [currentUser, data.courses, update]);

  const saveInstructorCommission = useCallback((userId: string, baseSharePercent: number, referralSharePercent: number): ActionResult => {
    if (currentUser?.role !== 'admin') return { ok: false, message: 'เฉพาะแอดมินเท่านั้นที่กำหนดสัดส่วนได้' };
    const base = Number(baseSharePercent);
    const referral = Number(referralSharePercent);
    const instructor = data.users.find((user) => user.id === userId && user.role === 'instructor');
    if (!instructor) return { ok: false, message: 'ไม่พบผู้สอน' };
    if (!Number.isFinite(base) || !Number.isFinite(referral) || base < 0 || base > 100 || referral <= base || referral > 100) return { ok: false, message: 'สัดส่วนลิงก์แนะนำต้องสูงกว่าสัดส่วนปกติ และทั้งคู่ต้องไม่เกิน 100%' };
    update((next) => { next.users = next.users.map((user) => user.id === userId ? { ...user, baseSharePercent: base, referralSharePercent: referral } : user); return next; });
    return { ok: true };
  }, [currentUser, data.users, update]);

  const markInstructorPayout = useCallback((instructorId: string): InstructorPayoutResult => {
    if (currentUser?.role !== 'admin') return { ok: false, message: 'เฉพาะแอดมินเท่านั้นที่ยืนยันยอดโอนได้' };
    const eligible = data.orders.filter((order) => {
      const course = data.courses.find((item) => item.id === order.courseId);
      return order.status === 'paid' && Number(order.amount || 0) > 0 && order.payoutStatus !== 'transferred' && (order.instructorId ?? course?.instructorId) === instructorId;
    });
    if (!eligible.length) return { ok: false, message: 'ไม่มียอดรอโอนสำหรับผู้สอนคนนี้' };
    const teacher = data.users.find((user) => user.id === instructorId);
    const amount = Math.round(eligible.reduce((sum, order) => {
      const course = data.courses.find((item) => item.id === order.courseId);
      const rate = Number(order.instructorSharePercent ?? (order.referralLinkId ? teacher?.referralSharePercent : teacher?.baseSharePercent) ?? 70);
      return sum + Number(order.instructorShareAmount ?? (Number(order.amount) * rate / 100));
    }, 0) * 100) / 100;
    const payout: InstructorPayout = { id: createId('payout'), instructorId, orderIds: eligible.map((order) => order.id), amount, orderCount: eligible.length, createdAt: new Date().toISOString() };
    const orderIds = new Set(payout.orderIds);
    update((next) => {
      next.orders = next.orders.map((order) => orderIds.has(order.id) ? { ...order, payoutStatus: 'transferred', payoutId: payout.id, paidOutAt: payout.createdAt } : order);
      next.instructorPayouts ??= [];
      next.instructorPayouts.unshift(payout);
      return next;
    });
    return { ok: true, payout };
  }, [currentUser, data.courses, data.orders, data.users, update]);

  const markContentDone = useCallback(
    (courseId: string, itemId: string) => {
      if (!currentUser?.id || (currentUser.role !== 'admin' && currentUser.emailVerified === false)) return;
      update((next) => {
        const key = `${courseId}:${itemId}`;
        next.progress[key] = { ...(next.progress[key] ?? {}), [currentUser.id]: true };
        return awardCertificate(next, courseId, currentUser.id);
      });
    },
    [currentUser?.id, update]
  );

  const startAttempt = useCallback((quiz: Quiz, assignmentId: string | null = null): string | null => {
    if (!currentUser || !data.quizzes.some((entry) => entry.id === quiz.id && entry.courseId === quiz.courseId)) return null;
    if (currentUser.role !== 'admin' && currentUser.emailVerified === false) return null;
    const enrolled = data.enrollments.some((entry) => entry.courseId === quiz.courseId && entry.userId === currentUser.id);
    if (currentUser.role !== 'admin' && (currentUser.role !== 'learner' || !enrolled)) return null;
    if (assignmentId) {
      const assignment = (data.assignments || []).find((entry) => entry.id === assignmentId);
      if (currentUser.role !== 'learner' || !assignment || assignment.status === 'cancelled' || assignment.quizId !== quiz.id || !assignmentIncludesLearner(assignment, currentUser.id) || !enrolled) return null;
      if (data.attempts.some((attempt) => attempt.assignmentId === assignmentId && attempt.userId === currentUser.id && attempt.essayStatus === 'pending')) return null;
    }
    const draft = data.attempts.find((entry) => entry.quizId === quiz.id && entry.userId === currentUser.id && (entry.assignmentId ?? null) === assignmentId && entry.status === 'in_progress');
    if (draft) return draft.id;
    const id = createId('attempt');
    const next = structuredClone(data);
    next.attempts.unshift({ id, quizId: quiz.id, courseId: quiz.courseId, assignmentId, quizSnapshot: structuredClone(quiz), userId: currentUser.id, answers: {}, essayStatus: 'none', passed: null, status: 'in_progress', startedAt: new Date().toISOString() });
    return commitLearningChange(next).ok ? id : null;
  }, [currentUser, data, commitLearningChange]);

  const saveAttemptDraft = useCallback((attemptId: string, answers: Record<string, QuizAnswerValue>) => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.emailVerified === false)) return;
    update((next) => {
      next.attempts = next.attempts.map((attempt) => attempt.id === attemptId && attempt.userId === currentUser?.id && attempt.status === 'in_progress' ? { ...attempt, answers: structuredClone(answers) } : attempt);
      return next;
    });
  }, [currentUser?.id, update]);

  const submitAttempt = useCallback(
    (quiz: Quiz, answers: Record<string, QuizAnswerValue>, existingAttemptId?: string): string | null => {
      let attemptId = existingAttemptId ?? createId('attempt');
      if (!currentUser?.id || (currentUser.role !== 'admin' && currentUser.emailVerified === false)) return null;
      const existingAttempt = data.attempts.find((entry) => entry.id === existingAttemptId);
      if (existingAttemptId && (!existingAttempt || existingAttempt.userId !== currentUser.id || existingAttempt.status !== 'in_progress' || existingAttempt.quizId !== quiz.id)) return null;
      quiz = existingAttempt?.quizSnapshot ?? quiz;
      update((next) => {
        const choiceQuestions = quiz.questions.filter((question) => question.type === 'choice');
        const essayQuestions = quiz.questions.filter((question) => question.type === 'essay');
        const maxChoice = choiceQuestions.reduce((sum, question) => sum + Number(question.points || 1), 0);
        const score = choiceQuestions.reduce(
          (sum, question) =>
            sum +
            ('answer' in question && Number(answers[question.id]) === Number(question.answer)
              ? Number(question.points || 1)
              : 0),
          0
        );
        const percent = maxChoice ? Math.round((score / maxChoice) * 100) : 0;
        const passed = essayQuestions.length ? null : percent >= Number(quiz.passPercent || 60);
        const attempt: QuizAttempt = {
          ...(next.attempts.find((entry) => entry.id === existingAttemptId) ?? {
            id: attemptId,
            quizId: quiz.id,
            courseId: quiz.courseId,
            userId: currentUser.id,
            answers: {},
            essayStatus: 'none',
            passed: null,
            status: 'draft',
          }),
          id: existingAttemptId ?? attemptId,
          quizId: quiz.id,
          courseId: quiz.courseId,
          userId: currentUser.id,
          answers: structuredClone(answers),
          quizSnapshot: structuredClone(quiz),
          score,
          maxChoice,
          percent,
          essayStatus: essayQuestions.length ? 'pending' : 'none',
          passed,
          status: 'submitted',
          submittedAt: new Date().toISOString(),
        };
        attemptId = attempt.id;
        if (existingAttemptId) {
          next.attempts = next.attempts.map((entry) => (entry.id === existingAttemptId ? attempt : entry));
        } else {
          next.attempts.unshift(attempt);
        }
        if (essayQuestions.length) {
          const course = next.courses.find((entry) => entry.id === quiz.courseId);
          addNotification(next, {
            id: `review-submitted:${attempt.id}`,
            userId: course?.instructorId,
            type: 'review_submitted',
            title: 'มีงานส่งใหม่รอตรวจ',
            description: `${next.users.find((entry) => entry.id === currentUser.id)?.name || 'ผู้เรียน'} · ${quiz.title}`,
            href: `/teach/attempts/${attempt.id}/grade?returnTo=${encodeURIComponent(`/teach/reviews?course=${quiz.courseId}`)}`,
          });
        }
        if (passed) {
          const course = next.courses.find((entry) => entry.id === quiz.courseId);
          const item = flattenItems(course).find((entry) => 'quizId' in entry && entry.quizId === quiz.id);
          if (item) {
            next.progress[`${quiz.courseId}:${item.id}`] = {
              ...(next.progress[`${quiz.courseId}:${item.id}`] ?? {}),
              [currentUser.id]: true,
            };
          }
        }
        return passed ? awardCertificate(next, quiz.courseId, currentUser.id) : next;
      });
      return attemptId;
    },
    [currentUser, data.attempts, update]
  );

  const gradeAttempt = useCallback((attemptId: string, { score, feedback }: { score: number; feedback?: string }): ActionResult => {
    const source = data.attempts.find((entry) => entry.id === attemptId);
    const quiz = source?.quizSnapshot ?? data.quizzes.find((entry) => entry.id === source?.quizId);
    const course = data.courses.find((entry) => entry.id === source?.courseId);
    if (!source || !quiz || !canManageCourse(currentUser, course) || source.status !== 'submitted' || source.essayStatus !== 'pending') return { ok: false, message: 'ไม่มีสิทธิ์ตรวจคำตอบนี้ หรือรายการถูกตรวจไปแล้ว' };
    const questions = quiz.questions.filter((question) => question.type === 'essay');
    const essayMax = questions.reduce((sum, question) => sum + Number(question.points || 1), 0);
    if (!questions.length || !Number.isFinite(score) || score < 0 || score > essayMax) return { ok: false, message: 'กรอกคะแนนในช่วงที่กำหนด' };
    const max = Number(source.maxChoice || 0) + essayMax;
    const total = Number(source.score || 0) + score;
    const finalPercent = max > 0 ? Math.round(total / max * 100) : 0;
    const passed = max > 0 && finalPercent >= Number(quiz.passPercent || 60);
    const next = structuredClone(data);
    next.attempts = next.attempts.map((entry) => entry.id === attemptId ? { ...entry, essayStatus: 'graded', essayScore: score, essayFeedback: feedback, totalScore: total, maxScore: max, finalPercent, percent: finalPercent, passed, gradedAt: new Date().toISOString() } : entry);
    addNotification(next, { id: 'grade-completed:' + attemptId, userId: source.userId, type: 'grade_completed', title: 'ผู้สอนตรวจงานของคุณแล้ว', description: quiz.title + ' · คะแนนรวม ' + total + ' / ' + max, href: '/learn/attempts/' + attemptId + '/result' });
    if (passed) {
      const item = flattenItems(course).find((entry) => 'quizId' in entry && entry.quizId === quiz.id);
      if (item) next.progress[quiz.courseId + ':' + item.id] = { ...(next.progress[quiz.courseId + ':' + item.id] ?? {}), [source.userId]: true };
      return commitLearningChange(awardCertificate(next, quiz.courseId, source.userId));
    }
    return commitLearningChange(next);
  }, [currentUser, data, commitLearningChange]);

  const requestInstructor = useCallback(
    (values: { name?: string; email?: string; intro: string }) => {
      update((next) => {
        next.instructorRequests.unshift({
          id: createId('req'),
          userId: currentUser?.id,
          userName: currentUser?.name ?? values.name ?? '',
          email: currentUser?.email ?? values.email ?? '',
          intro: values.intro,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
        return next;
      });
    },
    [currentUser, update]
  );

  const reviewInstructorRequest = useCallback(
    (requestId: string, decision: 'approved' | 'rejected', note = '') => {
      update((next) => {
        const request = next.instructorRequests.find((item) => item.id === requestId);
        if (!request) return next;
        next.instructorRequests = next.instructorRequests.map((item) =>
          item.id === requestId ? { ...item, status: decision, reviewNote: note } : item
        );
        if (decision === 'approved') {
          const existing = next.users.find((item) => item.id === request.userId || item.email === request.email);
          if (existing) {
            next.users = next.users.map((item) => (item.id === existing.id ? { ...item, role: 'instructor', status: 'active' } : item));
          } else {
            next.users.push({
              id: createId('u'),
              name: request.userName,
              email: request.email,
              password: 'Teach123!',
              role: 'instructor',
              bio: request.intro,
              status: 'active',
            });
          }
        }
        return next;
      });
    },
    [update]
  );

  const createInstructorInvite = useCallback(
    ({ name, email }: { name: string; email: string }): string => {
      const token = createId('invite');
      update((next) => {
        const user = next.users.find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
        if (user) {
          next.invitations.unshift({
            id: createId('inv'),
            token,
            userId: user.id,
            name: user.name,
            email: user.email,
            status: 'pending',
            createdAt: new Date().toISOString(),
          });
        } else {
          const newUser: User = {
            id: createId('u'),
            name: name.trim(),
            email: email.trim(),
            password: '',
            role: 'instructor',
            bio: '',
            status: 'invited',
          };
          next.users.push(newUser);
          next.invitations.unshift({
            id: createId('inv'),
            token,
            userId: newUser.id,
            name: newUser.name,
            email: newUser.email,
            status: 'pending',
            createdAt: new Date().toISOString(),
          });
        }
        return next;
      });
      return token;
    },
    [update]
  );

  const acceptInstructorInvite = useCallback(
    (token: string, password?: string): ActionResult => {
      let result: ActionResult = { ok: false, message: 'ไม่พบคำเชิญนี้' };
      update((next) => {
        const invite = next.invitations.find((item) => item.token === token && item.status === 'pending');
        if (!invite) return next;
        next.invitations = next.invitations.map((item) => (item.id === invite.id ? { ...item, status: 'accepted' } : item));
        next.users = next.users.map((item) =>
          item.id === invite.userId ? { ...item, role: 'instructor', status: 'active', password: password || item.password } : item
        );
        next.currentUserId = invite.userId ?? null;
        result = { ok: true, user: next.users.find((item) => item.id === invite.userId) };
        return next;
      });
      return result;
    },
    [update]
  );

  const changeUserRole = useCallback(
    (userId: string, role: Role) => {
      update((next) => {
        next.users = next.users.map((item) => (item.id === userId ? { ...item, role } : item));
        return next;
      });
    },
    [update]
  );

  const updateProfile = useCallback(
    (values: import('./lib/profile-model').ProfileValues): ActionResult => {
      if (!currentUser) return { ok: false, message: 'ไม่พบบัญชีผู้ใช้' };
      const validation = validateProfile(values, data.users, currentUser.id);
      if (validation) return { ok: false, message: validation };
      const editable = {
        name: values.name.trim(), username: values.username?.trim(), firstName: values.firstName?.trim(),
        lastName: values.lastName?.trim(), firstNameEnglish: values.firstNameEnglish?.trim(),
        lastNameEnglish: values.lastNameEnglish?.trim(), certificateName: values.certificateName?.trim(),
        birthDate: values.birthDate?.trim(), phone: values.phone?.trim(), school: values.school?.trim(),
        educationLevel: values.educationLevel, interests: values.interests ?? [], learningGoals: values.learningGoals ?? [],
        googleLinkedEmail: values.googleLinkedEmail, bio: values.bio, avatar: values.avatar,
      };
      update((next) => {
        next.users = next.users.map((item) => (item.id === currentUser.id ? { ...item, ...editable } : item));
        return next;
      });
      return { ok: true };
    },
    [currentUser, data.users, update]
  );

  const resetPassword = useCallback(
    (email: string, password?: string): ActionResult => {
      const user = data.users.find((item) => item.email.toLowerCase() === email?.trim().toLowerCase());
      if (!user) return { ok: false, message: 'ไม่พบอีเมลนี้ในข้อมูลตัวอย่าง' };
      update((next) => {
        next.users = next.users.map((item) => (item.id === user.id ? { ...item, password: password || item.password } : item));
        return next;
      });
      return { ok: true };
    },
    [data.users, update]
  );

  const saveAssignment = useCallback((values: Partial<Assignment>, assignmentId?: string): ActionResult & { assignment?: Assignment } => {
    const issue = assignmentSaveIssue(data, currentUser, values, assignmentId);
    if (issue) return { ok: false, message: issue };
    const existing = (data.assignments || []).find((entry) => entry.id === assignmentId);
    const course = data.courses.find((entry) => entry.id === values.courseId)!;
    const now = new Date().toISOString();
    const assignment: Assignment = {
      ...existing, ...values, id: existing?.id ?? createId('assign'),
      courseId: course.id, quizId: values.quizId!, title: values.title!.trim(),
      stage: values.stage ?? existing?.stage ?? 'practice',
      assigneeType: values.assigneeType!,
      assigneeIds: [...new Set(values.assigneeIds ?? [])],
      status: existing?.status ?? 'active',
      createdBy: existing?.createdBy ?? currentUser!.id,
      createdAt: existing?.createdAt ?? now, updatedAt: now,
    };
    const next = structuredClone(data);
    next.assignments = existing ? (next.assignments || []).map((entry) => entry.id === assignment.id ? assignment : entry) : [assignment, ...(next.assignments || [])];
    const recipients = assignment.assigneeType === 'all_enrolled' ? next.enrollments.filter((entry) => entry.courseId === course.id).map((entry) => entry.userId) : assignment.assigneeIds || [];
    [...new Set(recipients)].forEach((userId) => addNotification(next, { id: createId('notification'), userId, type: existing ? 'assignment_updated' : 'assignment_created', title: existing ? 'งานมอบหมายมีการเปลี่ยนแปลง' : 'คุณได้รับงานมอบหมายใหม่', description: assignment.title, href: '/learn/assignments' }));
    const result = commitLearningChange(next);
    return result.ok ? { ok: true, assignment } : result;
  }, [currentUser, data, commitLearningChange]);

  const removeAssignment = useCallback((assignmentId: string): ActionResult => {
    const assignment = (data.assignments || []).find((entry) => entry.id === assignmentId);
    const course = data.courses.find((entry) => entry.id === assignment?.courseId);
    if (!assignment || !canManageCourse(currentUser, course)) return { ok: false, message: 'ไม่มีสิทธิ์ลบงานนี้' };
    if (assignmentHasHistory(data, assignment)) return { ok: false, message: 'งานนี้มีประวัติคำตอบแล้ว กรุณายกเลิกแทนการลบ' };
    const next = structuredClone(data);
    next.assignments = (next.assignments || []).filter((entry) => entry.id !== assignmentId);
    return commitLearningChange(next);
  }, [currentUser, data, commitLearningChange]);

  const cancelAssignment = useCallback((assignmentId: string): ActionResult => {
    const assignment = (data.assignments || []).find((entry) => entry.id === assignmentId);
    const course = data.courses.find((entry) => entry.id === assignment?.courseId);
    if (!assignment || !canManageCourse(currentUser, course)) return { ok: false, message: 'ไม่มีสิทธิ์ยกเลิกงานนี้' };
    const next = structuredClone(data);
    next.assignments = (next.assignments || []).map((entry) => entry.id === assignmentId ? { ...entry, status: 'cancelled', updatedAt: new Date().toISOString() } : entry);
    return commitLearningChange(next);
  }, [currentUser, data, commitLearningChange]);

  const markNotificationRead = useCallback(
    (notificationId: string) => {
      update((next) => {
        next.notifications = (next.notifications || []).map((entry) =>
          entry.id === notificationId && entry.userId === currentUser?.id && !entry.readAt
            ? { ...entry, readAt: new Date().toISOString() }
            : entry
        );
        return next;
      });
    },
    [currentUser?.id, update]
  );

  const sendInboxMessage = useCallback(
    ({
      conversationId,
      recipientId,
      courseId,
      itemId,
      chapterId,
      text,
      attachments = [],
    }: SendInboxMessageArgs): SendInboxMessageResult => {
      const body = typeof text === 'string' ? text.trim() : '';
      if (body.length > 3000) return { ok: false, message: 'ข้อความยาวได้ไม่เกิน 3,000 ตัวอักษร' };
      if (!Array.isArray(attachments)) return { ok: false, message: 'ไฟล์แนบไม่ถูกต้อง กรุณาเลือกไฟล์ใหม่' };
      if (!body && !attachments.length) return { ok: false, message: 'พิมพ์ข้อความหรือแนบไฟล์ก่อนส่ง' };
      if (attachments.some((attachment) => !attachment || typeof attachment !== 'object')) {
        return { ok: false, message: 'ไฟล์แนบไม่ถูกต้อง กรุณาเลือกไฟล์ใหม่' };
      }
      const allowedAttachmentTypes = new Set(['image/webp', 'video/mp4', 'video/webm']);
      const attachmentBytes = attachments.reduce((sum, attachment) => sum + attachment.size, 0);
      if (attachments.length > MAX_INBOX_ATTACHMENTS || attachmentBytes > MAX_INBOX_TOTAL_ATTACHMENT_BYTES) {
        return { ok: false, message: 'แนบไฟล์ได้ไม่เกิน 3 ไฟล์ และขนาดรวมไม่เกิน 8 MB' };
      }
      if (attachments.some((attachment) =>
        !attachment || typeof attachment.name !== 'string' ||
        !allowedAttachmentTypes.has(attachment.contentType) ||
        !Number.isFinite(attachment.size) || attachment.size <= 0 || attachment.size > MAX_INBOX_ATTACHMENT_BYTES ||
        typeof attachment.url !== 'string' ||
        attachment.url.length > Math.ceil(MAX_INBOX_ATTACHMENT_BYTES / 3) * 4 + 128 ||
        !new RegExp(`^data:${attachment.contentType};base64,[A-Za-z0-9+/]*={0,2}$`).test(attachment.url)
      )) return { ok: false, message: 'ชนิดหรือขนาดไฟล์แนบไม่ถูกต้อง กรุณาเลือกไฟล์ใหม่' };
      if (!currentUser) return { ok: false, message: 'กรุณาเข้าสู่ระบบก่อนส่งข้อความ' };
      let conversation = (data.inboxConversations || []).find((entry) => entry.id === conversationId);
      if (conversationId && !canAccessInboxConversation(data, conversation!, currentUser)) {
        return { ok: false, message: 'คุณไม่มีสิทธิ์ส่งข้อความในการสนทนานี้' };
      }
      if (!conversation) {
        const contact = getInboxContacts(data, currentUser).find(
          (entry) => entry.user.id === recipientId && (entry.course?.id || null) === (courseId || null)
        );
        if (!contact) return { ok: false, message: 'เลือกผู้สอนในคอร์สที่คุณเรียนหรือแอดมินที่ติดต่อได้' };
        conversation = (data.inboxConversations || []).find((entry) => entry.id === contact.key) || {
          id: contact.key,
          participantIds: [currentUser.id, contact.user.id],
          courseId: contact.course?.id || null,
          createdAt: new Date().toISOString(),
        };
      }
      if (!canAccessInboxConversation(data, conversation, currentUser)) {
        return { ok: false, message: 'คุณไม่มีสิทธิ์ส่งข้อความในการสนทนานี้' };
      }
      const context =
        itemId || chapterId
          ? getInboxLessonContext(data, currentUser, conversation.courseId || undefined, itemId, chapterId)
          : undefined;
      if ((itemId || chapterId) && !context) {
        return { ok: false, message: 'ไม่พบบทเรียนที่ต้องการถาม กรุณาเปิดจากหน้าเรียนอีกครั้ง' };
      }
      const recipient = data.users.find(
        (entry) => conversation!.participantIds.includes(entry.id) && entry.id !== currentUser.id
      );
      if (!recipient || recipient.status !== 'active') {
        return { ok: false, message: 'บัญชีผู้รับยังไม่พร้อมรับข้อความ' };
      }
      const inboxMessage: InboxMessage = {
        id: createId('message'),
        conversationId: conversation.id,
        senderId: currentUser.id,
        body,
        ...(attachments.length && {
          attachments: attachments.map((attachment) => ({ ...attachment, id: createId('attachment') })),
        }),
        ...(context && { context }),
        createdAt: new Date().toISOString(),
        readBy: [currentUser.id],
      };
      const append = (next: StoredLmsData) => {
        const existing = (next.inboxConversations || []).find((entry) => entry.id === conversation!.id);
        if (existing && !canAccessInboxConversation(next as LmsData, existing, currentUser)) return next;
        if (!Array.isArray(next.inboxConversations)) next.inboxConversations = [];
        if (!existing) next.inboxConversations.push(conversation!);
        if (!Array.isArray(next.inboxMessages)) next.inboxMessages = [];
        next.inboxMessages.push(inboxMessage);
        addNotification(next, {
          id: `inbox-message:${inboxMessage.id}`,
          userId: recipient.id,
          type: 'inbox_message',
          conversationId: conversation!.id,
          title: `ข้อความใหม่จาก ${currentUser.name}`,
          description: body
            ? body.length > 100 ? `${body.slice(0, 100)}…` : body
            : attachments.length === 1
              ? attachments[0].contentType.startsWith('image/') ? 'แนบรูปภาพ' : 'แนบวิดีโอ'
              : `แนบไฟล์ ${attachments.length} รายการ`,
          href: `${inboxPathForRole(recipient.role)}?thread=${encodeURIComponent(conversation!.id)}`,
        });
        return next;
      };
      // Check browser persistence before clearing the composer's draft.
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(append(structuredClone(data))));
      } catch {
        return { ok: false, message: 'บันทึกข้อความหรือไฟล์แนบไม่ได้ ข้อความและไฟล์ยังอยู่ กรุณาลองลดขนาดไฟล์' };
      }
      update((next) => append(next) as LmsData & { notifications?: AppNotification[] });
      return { ok: true, conversationId: conversation.id };
    },
    [data, currentUser, update]
  );

  const markInboxConversationRead = useCallback(
    (conversationId: string) => {
      update((next) => {
        const conversation = (next.inboxConversations || []).find((entry) => entry.id === conversationId);
        if (!conversation || !canAccessInboxConversation(next, conversation, currentUser)) return next;
        next.inboxMessages = (next.inboxMessages || []).map((entry) =>
          entry.conversationId === conversationId && (!currentUser || !entry.readBy?.includes(currentUser.id))
            ? { ...entry, readBy: [...(entry.readBy || []), ...(currentUser ? [currentUser.id] : [])] }
            : entry
        );
        next.notifications = (next.notifications || []).map((entry) =>
          entry.conversationId === conversationId && entry.userId === currentUser?.id && !entry.readAt
            ? { ...entry, readAt: new Date().toISOString() }
            : entry
        );
        return next;
      });
    },
    [currentUser, update]
  );

  const saveComparisonSet = useCallback(
    (values: Partial<ComparisonSet>, comparisonSetId?: string): string => {
      const resultId = comparisonSetId ?? createId('comp');
      update((next) => {
        const existing = (next.comparisonSets || []).find((item) => item.id === comparisonSetId);
        const set: ComparisonSet = {
          id: resultId,
          title: values.title ?? existing?.title ?? '',
          courseId: values.courseId ?? existing?.courseId ?? '',
          preQuizId: values.preQuizId ?? existing?.preQuizId ?? '',
          postQuizId: values.postQuizId ?? existing?.postQuizId ?? '',
          description: values.description ?? existing?.description,
          createdAt: existing?.createdAt || new Date().toISOString(),
          ...existing,
          ...values,
        };
        if (!next.comparisonSets) next.comparisonSets = [];
        if (existing) {
          next.comparisonSets = next.comparisonSets.map((item) => (item.id === comparisonSetId ? set : item));
        } else {
          next.comparisonSets.push(set);
        }
        return next;
      });
      return resultId;
    },
    [update]
  );

  const value = useMemo<LmsContextType>(
    () => ({
      data,
      currentUser,
      signIn,
      signInDemo,
      signOut,
      register,
      verifyEmail,
      resendVerificationEmail,
      simulateGoogleAuth,
      resetDemo,
      saveBlogPost,
      removeBlogPost,
      saveCourse,
      submitCourseForReview,
      reviewCourse,
      publishCourse,
      removeCourse,
      saveChapter,
      saveChapterWorkspace,
      reorderCurriculum,
      removeChapter,
      saveItem,
      removeItem,
      saveQuiz,
      removeQuiz,
      enrollFree,
      simulatePayment,
      createAccessCode,
      setAccessCodeStatus,
      addCourseToCart,
      removeCourseFromCart,
      setCoursePriceAlert,
      createReferralLink,
      saveInstructorCommission,
      markInstructorPayout,
      markContentDone,
      startAttempt,
      saveAttemptDraft,
      submitAttempt,
      gradeAttempt,
      requestInstructor,
      reviewInstructorRequest,
      createInstructorInvite,
      acceptInstructorInvite,
      changeUserRole,
      updateProfile,
      resetPassword,
      saveAssignment,
      removeAssignment,
      cancelAssignment,
      saveComparisonSet,
      markNotificationRead,
      sendInboxMessage,
      markInboxConversationRead,
    }),
    [
      data,
      currentUser,
      signIn,
      signInDemo,
      signOut,
      register,
      verifyEmail,
      resendVerificationEmail,
      simulateGoogleAuth,
      resetDemo,
      saveBlogPost,
      removeBlogPost,
      saveCourse,
      submitCourseForReview,
      reviewCourse,
      publishCourse,
      removeCourse,
      saveChapter,
      saveChapterWorkspace,
      reorderCurriculum,
      removeChapter,
      saveItem,
      removeItem,
      saveQuiz,
      removeQuiz,
      enrollFree,
      simulatePayment,
      createAccessCode,
      setAccessCodeStatus,
      addCourseToCart,
      removeCourseFromCart,
      setCoursePriceAlert,
      createReferralLink,
      saveInstructorCommission,
      markInstructorPayout,
      markContentDone,
      startAttempt,
      saveAttemptDraft,
      submitAttempt,
      gradeAttempt,
      requestInstructor,
      reviewInstructorRequest,
      createInstructorInvite,
      acceptInstructorInvite,
      changeUserRole,
      updateProfile,
      resetPassword,
      saveAssignment,
      removeAssignment,
      cancelAssignment,
      saveComparisonSet,
      markNotificationRead,
      sendInboxMessage,
      markInboxConversationRead,
    ]
  );

  return <LmsContext.Provider value={value}>{children}</LmsContext.Provider>;
}

export const useLms = (): LmsContextType => {
  const value = useContext(LmsContext);
  if (!value) throw new Error('useLms must be used within LmsProvider');
  return value;
};
