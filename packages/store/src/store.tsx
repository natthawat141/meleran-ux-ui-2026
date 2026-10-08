import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import { createId, DEMO_ACCOUNTS, flattenItems, initialData, seedCourseCoverReplacements } from './data';
import defaultCourseCover from '@melearn/ui/assets/generated/course-default-v2.png';
import { certificateRecipient, snapshotLegacyCertificateNames, validateProfile } from './lib/profile-model';
import { canManageCourse, contentRemovalIssue } from './lib/learning-history';
import { normalizeRedeemCode, preparePrototypeRedeem } from './lib/redeem-code';
import { normalizePrototypeSnapshot } from './lib/prototype-snapshot';
import { EMAIL_VERIFICATION_RESEND_COOLDOWN_MS, EMAIL_VERIFICATION_TTL_MS, verificationResendAvailable, verificationResendRemainingMs, verificationTokenState } from './lib/email-verification';
import { authenticatePrototypeUser } from './lib/auth-identity';
import { canEditCourse, canPublishCourse, canReviewCourse, canSubmitCourse, coursePublicationIssue, invalidateCourseReview } from './lib/course-review';
import { preserveCourseAiMetadata, preserveVideoTranscripts, saveVideoTranscript as saveVideoTranscriptRecord, setCourseAiEnabled as setCourseAiEnabledRecord } from './lib/ai-course-support';
import type {
  ActionResult,
  BlogPost,
  Certificate,
  Chapter,
  Course,
  CourseItem,
  EmailVerification,
  LmsContextType,
  LmsData,
  Notification,
  Quiz,
  QuizAnswerValue,
  QuizAttempt,
  ReorderResult,
  Role,
  SaveTranscriptResult,
  User,
  WorkspaceSaveResult,
} from './types';

const STORAGE_KEY = 'stay-elearn-ux-v2';
const LEGACY_DEFAULT_COVER = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=85';
const LmsContext = createContext<LmsContextType | null>(null);

type AppNotification = Notification;
type StoredLmsData = LmsData;

function addNotification(data: StoredLmsData, notification: AppNotification) {
  if (!notification.userId) return;
  if (!Array.isArray(data.notifications)) data.notifications = [];
  if (data.notifications.some((entry) => entry.id === notification.id)) return;
  data.notifications.unshift({ ...notification, createdAt: new Date().toISOString(), readAt: null });
}

function canLearnCourse(user: User | null, course: Course | undefined, data: LmsData): boolean {
  if (!user || !course || (user.role !== 'learner' && user.role !== 'instructor')) return false;
  if (user.status === 'suspended' || user.status === 'pending' || user.status === 'invited' || user.emailVerified === false) return false;
  if (course.instructorId === user.id) return false;
  return data.enrollments.some((entry) => entry.courseId === course.id && entry.userId === user.id);
}

function canJoinFreeCourse(user: User | null, course: Course | undefined): boolean {
  return Boolean(
    user && course &&
    (user.role === 'learner' || user.role === 'instructor') &&
    user.status !== 'suspended' && user.status !== 'pending' && user.status !== 'invited' &&
    user.emailVerified !== false && course.instructorId !== user.id
  );
}

function normalizeBlogCover(cover?: string): string | undefined {
  if (typeof cover !== 'string') return undefined;
  const trimmed = cover.trim();
  if (!trimmed) return undefined;
  if (/^data:image\//i.test(trimmed) && trimmed.length < 80) return undefined;
  if (/^https?:\/\/127\.0\.0\.1:\d+\//i.test(trimmed)) return undefined;
  return trimmed;
}

function normalizeBlogPosts(posts: BlogPost[]): BlogPost[] {
  return posts.map((post) => {
    const cover = normalizeBlogCover(post.cover);
    const next: BlogPost = { ...post, coverKey: post.coverKey || 'writing' };
    if (cover) next.cover = cover;
    else delete next.cover;
    return next;
  });
}

function loadData(): LmsData & { notifications?: AppNotification[] } {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      const normalized = normalizePrototypeSnapshot(parsed, initialData, new Date().toISOString());
      const courses: Course[] = normalized.courses.map((course) => {
        if (course.cover === LEGACY_DEFAULT_COVER || course.cover?.includes('course-default-v1')) {
          return { ...course, cover: defaultCourseCover };
        }
        const replacement = seedCourseCoverReplacements[course.id];
        return replacement && (course.cover === replacement.from || course.cover?.includes(replacement.previousGenerated))
          ? { ...course, cover: replacement.to }
          : course;
      });
      courses.forEach((course) => {
        course.aiEnabled = course.aiEnabled === true;
        course.chapters.forEach((chapter) =>
          chapter.items.forEach((item) => {
            if (!item.id) item.id = createId('item');
          })
        );
      });
      const users = normalized.users;
      const next: LmsData & { notifications?: AppNotification[] } = {
        ...normalized,
        courses,
        blogPosts: normalizeBlogPosts(normalized.blogPosts),
        certificates: snapshotLegacyCertificateNames(normalized.certificates, users),
      };
      return next;
    }
  } catch {
    // Keep unreadable stored content losslessly instead of overwriting it with fixtures.
    if (stored !== null) return normalizePrototypeSnapshot({
      legacyPrototype: { collections: { unreadableStoredSnapshot: stored } },
    }, initialData, new Date().toISOString());
  }
  const initial = structuredClone(initialData);
  initial.courses.forEach((course) => { course.aiEnabled = false; });
  return initial;
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
    (identifier: string, password?: string, requiredRole?: Role): ActionResult => {
      const auth = authenticatePrototypeUser(data.users, identifier, password, requiredRole);
      if (!auth.ok) {
        return {
          ok: false,
          message: auth.reason === 'role'
            ? 'บัญชีนี้ไม่มีสิทธิ์เข้าสู่พื้นที่ผู้ดูแลระบบ'
            : 'ชื่อผู้ใช้ อีเมล หรือรหัสผ่านไม่ถูกต้อง',
        };
      }
      const user = auth.user;
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
    (rawValues: Partial<Course>, id?: string): string | null => {
      const target = data.courses.find((course) => course.id === id);
      if (
        !currentUser ||
        !['admin', 'instructor'].includes(currentUser.role) ||
        (target && currentUser.role !== 'admin' && target.instructorId !== currentUser.id)
      ) {
        return null;
      }
      const candidate = Object.assign({ id: id ?? '', slug: '', title: '', category: '', level: '', price: 0, instructorId: '', status: 'draft', cover: '', chapters: [] }, target ?? {}, rawValues) as Course;
      const values: Partial<Course> = preserveVideoTranscripts(target, preserveCourseAiMetadata(target, candidate));
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
        Object.assign(record, preserveCourseAiMetadata(existing, record));
        Object.assign(record, preserveVideoTranscripts(existing, record));
        if (!record.cover) record.cover = defaultCourseCover;
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

  const setCourseAiEnabled = useCallback((courseId: string, enabled: boolean): ActionResult => {
    const existing = data.courses.find((entry) => entry.id === courseId);
    const result = setCourseAiEnabledRecord(existing, currentUser?.role, enabled);
    if (!result.ok || !result.course) return { ok: false, message: result.message };
    const next = structuredClone(data);
    next.courses = next.courses.map((course) => course.id === courseId ? result.course! : course);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { return { ok: false, message: 'บันทึกการตั้งค่า AI ไม่ได้ พื้นที่เก็บในเบราว์เซอร์ไม่พอ' }; }
    setData(next);
    return { ok: true, message: result.message };
  }, [currentUser?.role, data, setData]);

  const saveVideoTranscript = useCallback((courseId: string, chapterId: string, videoId: string, transcript: string): SaveTranscriptResult => {
    const existing = data.courses.find((entry) => entry.id === courseId);
    const updatedAt = new Date().toISOString();
    const result = saveVideoTranscriptRecord(existing, currentUser?.role, chapterId, videoId, transcript, currentUser?.id ?? '', updatedAt);
    if (!result.ok || !result.course) return { ok: false, message: result.message };
    const next = structuredClone(data);
    next.courses = next.courses.map((course) => course.id === courseId ? result.course! : course);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { return { ok: false, message: 'บันทึก Transcript ไม่ได้ พื้นที่เก็บในเบราว์เซอร์อาจไม่พอ ลองลดขนาดเนื้อหา' }; }
    setData(next);
    return { ok: true, message: result.message, updatedAt, updatedBy: currentUser?.id };
  }, [currentUser?.id, currentUser?.role, data, setData]);

  const saveChapter = useCallback(
    (courseId: string, values: Partial<Chapter>, chapterId?: string) => {
      const course = data.courses.find((entry) => entry.id === courseId);
      if (!course || !canEditCourse(currentUser, course)) return;
      const now = new Date().toISOString();
      const targetId = chapterId ?? values.id;
      const original = targetId ? course.chapters.find((entry) => entry.id === targetId) : undefined;
      const candidate: Chapter = {
        id: targetId ?? createId('ch'),
        title: values.title ?? '',
        description: values.description ?? '',
        items: values.items ?? original?.items ?? [],
      };
      const safeChapter = preserveVideoTranscripts(course, { ...course, chapters: original
        ? course.chapters.map((entry) => entry.id === candidate.id ? candidate : entry)
        : [...course.chapters, candidate] }).chapters.find((entry) => entry.id === candidate.id)!;
      if (original && JSON.stringify(original) === JSON.stringify(safeChapter)) return;
      update((next) => {
        next.courses = next.courses.map((course) => {
          if (course.id !== courseId) return course;
          const chapters = original
            ? course.chapters.map((item) => (item.id === safeChapter.id ? safeChapter : item))
            : [...course.chapters, safeChapter];
          const editable = invalidateCourseReview(course, currentUser!.id, now);
          return { ...preserveVideoTranscripts(editable, { ...editable, chapters }), updatedAt: now };
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
        !course ||
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
      const safeChapter = preserveVideoTranscripts(course, { ...course, chapters: course.chapters.map((entry) => entry.id === chapter.id ? chapter : entry) }).chapters.find((entry) => entry.id === chapter.id)!;
      if (JSON.stringify({ chapter: safeChapter, quizzes }) === JSON.stringify({ chapter: existing, quizzes: oldQuizzes })) return { ok: true, message: 'ไม่มีการเปลี่ยนแปลงเนื้อหาหลัก' };
      for (const old of existing.items) {
        const replacement = chapter.items.find((item) => item.id === old.id);
        const hasProgress = Object.values(data.progress[`${courseId}:${old.id}`] || {}).some(Boolean);
        const oldQuizId = 'quizId' in old ? old.quizId : undefined;
        const hasAttempts = oldQuizId && data.attempts.some((attempt) => attempt.quizId === oldQuizId);
        if (!replacement && (hasProgress || hasAttempts)) {
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
      target.chapters = preserveVideoTranscripts(course!, { ...target, chapters: target.chapters.map((entry) => (entry.id === chapter.id ? structuredClone(safeChapter) : entry)) }).chapters;
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
    (courseId: string, chapterId: string, rawValues: Partial<CourseItem>) => {
      const course = data.courses.find((entry) => entry.id === courseId);
      if (!course || !canEditCourse(currentUser, course)) return;
      const { transcript: _transcript, transcriptUpdatedAt: _updatedAt, transcriptUpdatedBy: _updatedBy, ...values } = rawValues as Partial<CourseItem> & { transcript?: string; transcriptUpdatedAt?: string; transcriptUpdatedBy?: string };
      if (Object.keys(values).every((key) => key === 'id')) return;
      if (values.id) {
        const existingItem = course.chapters.find((entry) => entry.id === chapterId)?.items.find((item) => item.id === values.id);
        if (existingItem && JSON.stringify(existingItem) === JSON.stringify({ ...existingItem, ...values })) return;
      }
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
                          ? chapter.items.map((item) => {
                              if (item.id !== values.id) return item;
                              const { transcript: _injectedTranscript, transcriptUpdatedAt: _ignoredAt, transcriptUpdatedBy: _ignoredBy, ...safeValues } = values as Partial<CourseItem> & { transcript?: string; transcriptUpdatedAt?: string; transcriptUpdatedBy?: string };
                              return { ...item, ...safeValues } as CourseItem;
                            })
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

  const enrollFree = useCallback((courseId: string): ActionResult => {
    const course = data.courses.find((entry) => entry.id === courseId);
    if (!currentUser || !canJoinFreeCourse(currentUser, course)) return { ok: false, message: 'บัญชีนี้ลงเรียนคอร์สนี้ไม่ได้' };
    if (!course || course.status !== 'published' || course.price > 0) return { ok: false, message: 'คอร์สนี้ไม่พร้อมลงเรียนฟรี' };
    if (data.enrollments.some((entry) => entry.courseId === courseId && entry.userId === currentUser.id)) {
      return { ok: false, message: 'คุณมีคอร์สนี้อยู่แล้ว' };
    }
    const next = structuredClone(data);
    next.enrollments.push({ id: createId('enroll'), courseId, userId: currentUser.id, createdAt: new Date().toISOString() });
    return commitLearningChange(next);
  }, [currentUser, data, commitLearningChange]);

  const redeemCourseCode = useCallback((rawCode: string) => {
    const transition = preparePrototypeRedeem({
      codes: data.redeemCodes,
      enrollments: data.enrollments,
      courses: data.courses,
      user: currentUser,
      rawCode,
      now: new Date().toISOString(),
      enrollmentId: createId('enroll'),
    });
    if (!transition.result.ok || !transition.redeemCode || !transition.enrollment) return transition.result;
    if (transition.result.alreadyEnrolled) return transition.result;
    if (redeemingCodesRef.current.has(transition.redeemCode.id)) {
      return { ok: false as const, message: 'กำลังยืนยันรหัสนี้อยู่ กรุณารอสักครู่' };
    }

    redeemingCodesRef.current.add(transition.redeemCode.id);
    const next = structuredClone(data);
    next.redeemCodes = next.redeemCodes.map((entry) =>
      entry.id === transition.redeemCode?.id ? transition.redeemCode : entry
    );
    next.enrollments.push(transition.enrollment);
    const result = commitLearningChange(next);
    if (!result.ok) {
      redeemingCodesRef.current.delete(transition.redeemCode.id);
      return { ok: false as const, message: result.message ?? 'บันทึกการแลกรหัสไม่ได้' };
    }
    return transition.result;
  }, [currentUser, data, commitLearningChange]);

  const createRedeemCode = useCallback((courseId: string) => {
    if (currentUser?.role !== 'admin' || currentUser.status === 'suspended') {
      return { ok: false, message: 'เฉพาะแอดมินที่ใช้งานได้เท่านั้นจึงออกโค้ดได้' };
    }
    const course = data.courses.find((item) => item.id === courseId && item.status === 'published' && item.price > 0);
    if (!course) return { ok: false, message: 'เลือกคอร์สที่เผยแพร่และมีราคามากกว่าศูนย์' };

    let code = '';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = normalizeRedeemCode(`MELEARN-${createId('code').replace(/^code-/, '').slice(0, 8)}`);
      if (!data.redeemCodes.some((item) => normalizeRedeemCode(item.code) === candidate)) {
        code = candidate;
        break;
      }
    }
    if (!code) return { ok: false, message: 'สร้างรหัสที่ไม่ซ้ำไม่ได้ กรุณาลองอีกครั้ง' };

    const redeemCode = {
      id: createId('redeem-code'),
      code,
      courseId: course.id,
      status: 'unused' as const,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.id,
    };
    const next = structuredClone(data);
    next.redeemCodes.unshift(redeemCode);
    const result = commitLearningChange(next);
    return result.ok ? { ok: true, redeemCode } : { ok: false, message: result.message };
  }, [currentUser, data, commitLearningChange]);

  const revokeRedeemCode = useCallback((redeemCodeId: string): ActionResult => {
    if (currentUser?.role !== 'admin' || currentUser.status === 'suspended') {
      return { ok: false, message: 'เฉพาะแอดมินที่ใช้งานได้เท่านั้นจึงยกเลิกรหัสได้' };
    }
    const code = data.redeemCodes.find((item) => item.id === redeemCodeId);
    if (!code) return { ok: false, message: 'ไม่พบรหัสแลกคอร์สนี้' };
    if (code.status !== 'unused') return { ok: false, message: 'ยกเลิกได้เฉพาะรหัสที่ยังไม่ถูกใช้' };
    const next = structuredClone(data);
    next.redeemCodes = next.redeemCodes.map((item) =>
      item.id === redeemCodeId
        ? { ...item, status: 'revoked', revokedBy: currentUser.id, revokedAt: new Date().toISOString() }
        : item
    );
    return commitLearningChange(next);
  }, [currentUser, data, commitLearningChange]);
  const markContentDone = useCallback(
    (courseId: string, itemId: string) => {
      const course = data.courses.find((entry) => entry.id === courseId);
      if (!currentUser?.id || !canLearnCourse(currentUser, course, data) || !flattenItems(course).some((item) => item.id === itemId)) return;
      update((next) => {
        const key = `${courseId}:${itemId}`;
        next.progress[key] = { ...(next.progress[key] ?? {}), [currentUser.id]: true };
        return awardCertificate(next, courseId, currentUser.id);
      });
    },
    [currentUser, data, update]
  );

  const startAttempt = useCallback((quiz: Quiz): string | null => {
    const course = data.courses.find((entry) => entry.id === quiz.courseId);
    if (!currentUser || !canLearnCourse(currentUser, course, data) || !data.quizzes.some((entry) => entry.id === quiz.id && entry.courseId === quiz.courseId)) return null;
    const draft = data.attempts.find((entry) => entry.quizId === quiz.id && entry.userId === currentUser.id && entry.status === 'in_progress');
    if (draft) return draft.id;
    const id = createId('attempt');
    const next = structuredClone(data);
    next.attempts.unshift({ id, quizId: quiz.id, courseId: quiz.courseId, quizSnapshot: structuredClone(quiz), userId: currentUser.id, answers: {}, essayStatus: 'none', passed: null, status: 'in_progress', startedAt: new Date().toISOString() });
    return commitLearningChange(next).ok ? id : null;
  }, [currentUser, data, commitLearningChange]);

  const saveAttemptDraft = useCallback((attemptId: string, answers: Record<string, QuizAnswerValue>) => {
    const attempt = data.attempts.find((entry) => entry.id === attemptId);
    const course = data.courses.find((entry) => entry.id === attempt?.courseId);
    if (!currentUser || !attempt || attempt.userId !== currentUser.id || !canLearnCourse(currentUser, course, data)) return;
    update((next) => {
      next.attempts = next.attempts.map((entry) => entry.id === attemptId && entry.status === 'in_progress' ? { ...entry, answers: structuredClone(answers) } : entry);
      return next;
    });
  }, [currentUser, data, update]);

  const submitAttempt = useCallback(
    (quiz: Quiz, answers: Record<string, QuizAnswerValue>, existingAttemptId?: string): string | null => {
      let attemptId = existingAttemptId ?? createId('attempt');
      const course = data.courses.find((entry) => entry.id === quiz.courseId);
      if (!currentUser || !canLearnCourse(currentUser, course, data) || !data.quizzes.some((entry) => entry.id === quiz.id && entry.courseId === quiz.courseId)) return null;
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
    [currentUser, data, update]
  );

  const gradeAttempt = useCallback((attemptId: string, { score, feedback }: { score: number; feedback?: string }): ActionResult => {
    const source = data.attempts.find((entry) => entry.id === attemptId);
    const quiz = source?.quizSnapshot ?? data.quizzes.find((entry) => entry.id === source?.quizId);
    const course = data.courses.find((entry) => entry.id === source?.courseId);
    if (!source || !quiz || currentUser?.role !== 'instructor' || currentUser.status === 'suspended' || course?.instructorId !== currentUser.id || source.status !== 'submitted' || source.essayStatus !== 'pending') return { ok: false, message: 'ไม่มีสิทธิ์ตรวจคำตอบนี้ หรือรายการถูกตรวจไปแล้ว' };
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

  const assignInstructorRole = useCallback((userId: string): ActionResult => {
    if (currentUser?.role !== 'admin' || currentUser.status === 'suspended') {
      return { ok: false, message: 'เฉพาะแอดมินที่ใช้งานได้เท่านั้นจึงกำหนดบทบาทผู้สอนได้' };
    }
    const target = data.users.find((user) => user.id === userId);
    if (!target) return { ok: false, message: 'ไม่พบบัญชีผู้ใช้เดิม' };
    if (target.role === 'instructor') return { ok: true, message: 'บัญชีนี้เป็นผู้สอนอยู่แล้ว' };
    if (target.role !== 'learner' || target.status === 'suspended' || target.status === 'pending' || target.status === 'invited' || target.emailVerified === false) {
      return { ok: false, message: 'กำหนดบทบาทผู้สอนได้เฉพาะบัญชีผู้เรียนที่ใช้งานและยืนยันอีเมลแล้ว' };
    }
    const next = structuredClone(data);
    next.users = next.users.map((user) => user.id === userId ? { ...user, role: 'instructor' } : user);
    return commitLearningChange(next);
  }, [currentUser, data, commitLearningChange]);
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
      setCourseAiEnabled,
      saveVideoTranscript,
      saveChapter,
      saveChapterWorkspace,
      reorderCurriculum,
      removeChapter,
      saveItem,
      removeItem,
      saveQuiz,
      removeQuiz,
      enrollFree,
      redeemCourseCode,
      createRedeemCode,
      revokeRedeemCode,
      markContentDone,
      startAttempt,
      saveAttemptDraft,
      submitAttempt,
      gradeAttempt,
      assignInstructorRole,
      updateProfile,
      resetPassword,
      markNotificationRead,
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
      setCourseAiEnabled,
      saveVideoTranscript,
      saveChapter,
      saveChapterWorkspace,
      reorderCurriculum,
      removeChapter,
      saveItem,
      removeItem,
      saveQuiz,
      removeQuiz,
      enrollFree,
      redeemCourseCode,
      createRedeemCode,
      revokeRedeemCode,
      markContentDone,
      startAttempt,
      saveAttemptDraft,
      submitAttempt,
      gradeAttempt,
      assignInstructorRole,
      updateProfile,
      resetPassword,
      markNotificationRead,
    ]
  );

  return <LmsContext.Provider value={value}>{children}</LmsContext.Provider>;
}

export const useLms = (): LmsContextType => {
  const value = useContext(LmsContext);
  if (!value) throw new Error('useLms must be used within LmsProvider');
  return value;
};
