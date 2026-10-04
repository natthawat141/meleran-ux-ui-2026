import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createId, DEMO_ACCOUNTS, flattenItems, initialData, seedCourseCoverReplacements } from './data.js';
import defaultCourseCover from './assets/generated/course-default-v2.png';
import { certificateRecipient, snapshotLegacyCertificateNames, validateProfile } from './lib/profile-model.ts';

const STORAGE_KEY = 'stay-elearn-ux-v2';
const LEGACY_DEFAULT_COVER = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=85';
const LmsContext = createContext(null);

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const courses = Array.isArray(parsed.courses) ? parsed.courses.map((course) => {
        if (course.cover === LEGACY_DEFAULT_COVER || course.cover?.includes('course-default-v1')) return { ...course, cover: defaultCourseCover };
        const replacement = seedCourseCoverReplacements[course.id];
        return replacement && (course.cover === replacement.from || course.cover?.includes(replacement.previousGenerated))
          ? { ...course, cover: replacement.to } : course;
      }) : structuredClone(initialData.courses);
      courses.forEach((course) => course.chapters.forEach((chapter) => chapter.items.forEach((item) => { if (!item.id) item.id = createId('item'); })));
      const users = Array.isArray(parsed.users) ? parsed.users.map((user) => {
        if (user.role !== 'instructor') return user;
        const sample = initialData.users.find((entry) => entry.id === user.id);
        return {
          ...user,
          baseSharePercent: Number.isFinite(Number(user.baseSharePercent)) ? Number(user.baseSharePercent) : Number(sample?.baseSharePercent ?? 70),
          referralSharePercent: Number.isFinite(Number(user.referralSharePercent)) ? Number(user.referralSharePercent) : Number(sample?.referralSharePercent ?? 85),
        };
      }) : initialData.users;
      const certificates = snapshotLegacyCertificateNames(Array.isArray(parsed.certificates) ? parsed.certificates : initialData.certificates, users);
      const orders = Array.isArray(parsed.orders) ? parsed.orders : structuredClone(initialData.orders);
      const enrollments = Array.isArray(parsed.enrollments) ? parsed.enrollments : structuredClone(initialData.enrollments);
      const cartItems = Array.isArray(parsed.cartItems) ? parsed.cartItems : [];
      const mockPriceEmails = Array.isArray(parsed.mockPriceEmails) ? parsed.mockPriceEmails : [];
      const referralLinks = Array.isArray(parsed.referralLinks) ? parsed.referralLinks : structuredClone(initialData.referralLinks);
      const instructorPayouts = Array.isArray(parsed.instructorPayouts) ? parsed.instructorPayouts : [];
      if (!parsed.financeDemoSeedVersion && !orders.some((order) => order.status === 'paid')) {
        initialData.orders.forEach((order) => { if (!orders.some((item) => item.id === order.id)) orders.push(structuredClone(order)); });
        initialData.enrollments.forEach((enrollment) => {
          if (!enrollments.some((item) => item.courseId === enrollment.courseId && item.userId === enrollment.userId)) enrollments.push(structuredClone(enrollment));
        });
        initialData.referralLinks.forEach((link) => { if (!referralLinks.some((item) => item.code === link.code)) referralLinks.push(structuredClone(link)); });
      }
      return { ...initialData, ...parsed, users, certificates, courses, orders, enrollments, cartItems, mockPriceEmails, referralLinks, instructorPayouts, financeDemoSeedVersion: initialData.financeDemoSeedVersion, blogPosts: Array.isArray(parsed.blogPosts) ? parsed.blogPosts : structuredClone(initialData.blogPosts) };
    }
  } catch { /* Start with the sample data if storage is unavailable or invalid. */ }
  return structuredClone(initialData);
}

function awardCertificate(data, courseId, userId) {
  const course = data.courses.find((item) => item.id === courseId);
  if (!course || data.certificates.some((item) => item.courseId === courseId && item.userId === userId)) return data;
  const items = flattenItems(course);
  const complete = items.every((item) => item.type === 'quiz'
    ? data.attempts.some((attempt) => attempt.quizId === item.quizId && attempt.userId === userId && attempt.passed === true)
    : Boolean(data.progress[`${courseId}:${item.id}`]?.[userId]));
  if (!complete || items.length === 0) return data;
  return { ...data, certificates: [...data.certificates, {
    id: createId('cert'), code: `STAY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    courseId, userId, issuedAt: new Date().toISOString(),
    recipientName: certificateRecipient(data.users.find((item) => item.id === userId) || { id: userId, name: 'ผู้เรียน' }),
  }] };
}

export function LmsProvider({ children }) {
  const [data, setData] = useState(loadData);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* The current session remains usable without persistence. */ }
  }, [data]);

  const update = useCallback((recipe) => setData((current) => recipe(structuredClone(current))), []);
  const currentUser = data.users.find((user) => user.id === data.currentUserId) ?? null;

  const signIn = useCallback((email, password) => {
    const user = data.users.find((item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.password === password);
    if (!user) return { ok: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
    if (user.status === 'pending') return { ok: false, message: 'บัญชีผู้สอนยังรอแอดมินอนุมัติ' };
    update((next) => { next.currentUserId = user.id; return next; });
    return { ok: true, user };
  }, [data.users, update]);

  const register = useCallback(({ name, email, password }) => {
    if (data.users.some((item) => item.email.toLowerCase() === email.trim().toLowerCase())) return { ok: false, message: 'อีเมลนี้มีบัญชีแล้ว' };
    const user = { id: createId('u'), name: name.trim(), email: email.trim(), password, role: 'learner', bio: '', status: 'active' };
    update((next) => { next.users.push(user); next.currentUserId = user.id; return next; });
    return { ok: true, user };
  }, [data.users, update]);

  const signOut = useCallback(() => update((next) => { next.currentUserId = null; return next; }), [update]);
  const signInDemo = useCallback((role) => {
    const account = DEMO_ACCOUNTS.find((item) => item.role === role);
    return account ? signIn(account.email, account.password) : { ok: false, message: 'ไม่พบบัญชีตัวอย่าง' };
  }, [signIn]);
  const resetDemo = useCallback(() => { setData(structuredClone(initialData)); }, []);

  const saveBlogPost = useCallback((values, postId) => {
    if (currentUser?.role !== 'admin') return null;
    const savedId = postId ?? createId('post');
    update((next) => {
      const existing = next.blogPosts.find((post) => post.id === postId);
      const now = new Date().toISOString();
      const record = {
        ...existing, ...values, id: savedId, authorId: existing?.authorId ?? currentUser.id,
        readingMinutes: Math.max(2, Math.ceil(values.body.length / 500)),
        createdAt: existing?.createdAt ?? now, updatedAt: now,
        publishedAt: values.status === 'published' ? existing?.publishedAt ?? now : null,
      };
      if (existing) next.blogPosts = next.blogPosts.map((post) => post.id === postId ? record : post);
      else next.blogPosts.unshift(record);
      return next;
    });
    return savedId;
  }, [currentUser, update]);

  const removeBlogPost = useCallback((postId) => {
    if (currentUser?.role !== 'admin') return false;
    update((next) => { next.blogPosts = next.blogPosts.filter((post) => post.id !== postId); return next; });
    return true;
  }, [currentUser?.role, update]);

  const saveCourse = useCallback((values, id) => {
    const target = data.courses.find((course) => course.id === id);
    if (!currentUser || !['admin', 'instructor'].includes(currentUser.role) || (target && currentUser.role !== 'admin' && target.instructorId !== currentUser.id)) return null;
    const savedId = id ?? createId('course');
    update((next) => {
      const existing = next.courses.find((course) => course.id === id);
      const record = { ...existing, ...values, id: savedId, slug: values.slug || values.title?.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-'), cover: values.cover ?? existing?.cover ?? defaultCourseCover, instructorId: currentUser.role === 'admin' ? values.instructorId || existing?.instructorId || currentUser.id : existing?.instructorId || currentUser.id, chapters: existing?.chapters ?? [], status: values.status ?? existing?.status ?? 'draft', updatedAt: new Date().toISOString() };
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
          next.mockPriceEmails.unshift({ id: createId('price-email'), userId: entry.userId, courseId: id, courseTitle: record.title, to: recipient.email, previousPrice, newPrice: nextPrice, createdAt: now, status: 'mock-sent' });
        });
      }
      if (existing) next.courses = next.courses.map((course) => course.id === id ? record : course);
      else next.courses.unshift(record);
      return next;
    });
    return savedId;
  }, [currentUser, data.courses, update]);

  const removeCourse = useCallback((courseId) => update((next) => {
    next.courses = next.courses.filter((course) => course.id !== courseId);
    next.quizzes = next.quizzes.filter((quiz) => quiz.courseId !== courseId);
    next.attempts = next.attempts.filter((attempt) => attempt.courseId !== courseId);
    next.enrollments = next.enrollments.filter((item) => item.courseId !== courseId);
    next.certificates = next.certificates.filter((item) => item.courseId !== courseId);
    next.cartItems = (next.cartItems ?? []).filter((item) => item.courseId !== courseId);
    Object.keys(next.progress).filter((key) => key.startsWith(`${courseId}:`)).forEach((key) => delete next.progress[key]);
    return next;
  }), [update]);

  const saveChapter = useCallback((courseId, values) => update((next) => {
    next.courses = next.courses.map((course) => {
      if (course.id !== courseId) return course;
      const chapter = { id: values.id ?? createId('ch'), title: values.title, description: values.description ?? '', items: values.items ?? course.chapters.find((item) => item.id === values.id)?.items ?? [] };
      const chapters = values.id ? course.chapters.map((item) => item.id === values.id ? chapter : item) : [...course.chapters, chapter];
      return { ...course, chapters, updatedAt: new Date().toISOString() };
    });
    return next;
  }), [update]);

  // Reordering changes IDs' positions only, preserving content and learning history.
  const reorderCurriculum = useCallback((courseId, chapterId, orderedIds) => {
    const course = data.courses.find((entry) => entry.id === courseId);
    if (!course || !currentUser || (currentUser.role !== 'admin' && !(currentUser.role === 'instructor' && course.instructorId === currentUser.id))) return { ok: false, message: 'ไม่มีสิทธิ์เรียงเนื้อหาในคอร์สนี้' };
    const entries = chapterId ? course.chapters.find((entry) => entry.id === chapterId)?.items : course.chapters;
    if (!entries || orderedIds.length !== entries.length || new Set(orderedIds).size !== entries.length || orderedIds.some((id) => !entries.some((entry) => entry.id === id))) return { ok: false, message: 'รายการถูกเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่' };
    const next = structuredClone(data);
    const target = next.courses.find((entry) => entry.id === courseId);
    if (chapterId) {
      const chapter = target.chapters.find((entry) => entry.id === chapterId);
      chapter.items = orderedIds.map((id) => chapter.items.find((entry) => entry.id === id));
    } else target.chapters = orderedIds.map((id) => target.chapters.find((entry) => entry.id === id));
    target.updatedAt = new Date().toISOString();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { return { ok: false, message: 'บันทึกลำดับไม่ได้ พื้นที่เก็บในเบราว์เซอร์ไม่พอ' }; }
    setData(next);
    return { ok: true };
  }, [currentUser, data]);

  // Commit the chapter workspace as one unit; a failed browser write keeps the draft open.
  const saveChapterWorkspace = useCallback((courseId, chapter, quizzes, baseline) => {
    const course = data.courses.find((entry) => entry.id === courseId);
    const existing = course?.chapters.find((entry) => entry.id === chapter.id);
    if (!existing || !currentUser || (currentUser.role !== 'admin' && !(currentUser.role === 'instructor' && course.instructorId === currentUser.id))) return { ok: false, message: 'ไม่มีสิทธิ์แก้บทนี้' };
    const oldQuizzes = existing.items.filter((item) => item.quizId).map((item) => data.quizzes.find((quiz) => quiz.id === item.quizId)).filter(Boolean);
    if (baseline !== JSON.stringify({ chapter: existing, quizzes: oldQuizzes })) return { ok: false, message: 'ข้อมูลบทถูกเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่ก่อนแก้ต่อ' };
    for (const old of existing.items) {
      const replacement = chapter.items.find((item) => item.id === old.id);
      const hasProgress = Object.values(data.progress[`${courseId}:${old.id}`] || {}).some(Boolean);
      const hasAttempts = old.quizId && data.attempts.some((attempt) => attempt.quizId === old.quizId);
      if (!replacement && (hasProgress || hasAttempts)) return { ok: false, message: 'นำรายการที่มีประวัติเรียนหรือคำตอบออกไม่ได้' };
      if (hasAttempts && JSON.stringify(oldQuizzes.find((quiz) => quiz.id === old.quizId)) !== JSON.stringify(quizzes.find((quiz) => quiz.id === old.quizId))) return { ok: false, message: 'แบบฝึกหัดมีประวัติแล้ว ให้สร้างชุดใหม่แทน' };
    }
    const next = structuredClone(data);
    const target = next.courses.find((entry) => entry.id === courseId);
    target.chapters = target.chapters.map((entry) => entry.id === chapter.id ? structuredClone(chapter) : entry);
    target.updatedAt = new Date().toISOString();
    const retained = new Set(quizzes.map((quiz) => quiz.id));
    const removed = new Set(oldQuizzes.filter((quiz) => !retained.has(quiz.id)).map((quiz) => quiz.id));
    next.quizzes = next.quizzes.filter((quiz) => !retained.has(quiz.id) && !removed.has(quiz.id)).concat(structuredClone(quizzes));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { return { ok: false, message: 'พื้นที่เก็บในเบราว์เซอร์ไม่พอ ลองลดขนาดรูปหรือใช้ลิงก์วิดีโอ งานที่แก้ยังอยู่ในหน้านี้' }; }
    setData(next);
    return { ok: true };
  }, [currentUser, data]);

  const removeChapter = useCallback((courseId, chapterId) => update((next) => {
    const chapter = next.courses.find((course) => course.id === courseId)?.chapters.find((item) => item.id === chapterId);
    const quizIds = chapter?.items.filter((item) => item.quizId).map((item) => item.quizId) ?? [];
    next.quizzes = next.quizzes.filter((quiz) => !quizIds.includes(quiz.id));
    next.attempts = next.attempts.filter((attempt) => !quizIds.includes(attempt.quizId));
    chapter?.items.forEach((item) => { delete next.progress[`${courseId}:${item.id}`]; });
    next.courses = next.courses.map((course) => course.id === courseId ? { ...course, chapters: course.chapters.filter((chapter) => chapter.id !== chapterId) } : course);
    return next;
  }), [update]);

  const saveItem = useCallback((courseId, chapterId, values) => update((next) => {
    next.courses = next.courses.map((course) => course.id !== courseId ? course : {
      ...course,
      chapters: course.chapters.map((chapter) => chapter.id !== chapterId ? chapter : {
        ...chapter,
        items: values.id ? chapter.items.map((item) => item.id === values.id ? { ...item, ...values } : item) : [...chapter.items, { ...values, id: createId('item') }],
      }),
    });
    return next;
  }), [update]);

  const removeItem = useCallback((courseId, chapterId, itemId) => update((next) => {
    const course = next.courses.find((item) => item.id === courseId);
    const chapter = course?.chapters.find((item) => item.id === chapterId);
    const item = chapter?.items.find((entry) => entry.id === itemId);
    if (item?.quizId) {
      next.quizzes = next.quizzes.filter((quiz) => quiz.id !== item.quizId);
      next.attempts = next.attempts.filter((attempt) => attempt.quizId !== item.quizId);
    }
    delete next.progress[`${courseId}:${itemId}`];
    next.courses = next.courses.map((item) => item.id !== courseId ? item : { ...item, chapters: item.chapters.map((entry) => entry.id === chapterId ? { ...entry, items: entry.items.filter((content) => content.id !== itemId) } : entry) });
    return next;
  }), [update]);

  const saveQuiz = useCallback((values, quizId) => {
    const resultId = quizId ?? createId('quiz');
    update((next) => {
      const existing = next.quizzes.find((quiz) => quiz.id === quizId);
      const quiz = { ...existing, ...values, id: resultId, questions: values.questions ?? existing?.questions ?? [] };
      if (existing) next.quizzes = next.quizzes.map((item) => item.id === quizId ? quiz : item);
      else next.quizzes.push(quiz);
      const previousItem = next.courses.flatMap((course) => course.chapters.flatMap((chapter) => chapter.items)).find((item) => item.quizId === resultId);
      if (existing) next.courses = next.courses.map((course) => ({ ...course, chapters: course.chapters.map((chapter) => ({ ...chapter, items: course.id === values.courseId && chapter.id === values.chapterId ? chapter.items.map((item) => item.quizId === resultId ? { ...item, title: quiz.title } : item) : chapter.items.filter((item) => item.quizId !== resultId) })) }));
      if (values.courseId && values.chapterId) {
        const course = next.courses.find((item) => item.id === values.courseId);
        const chapter = course?.chapters.find((item) => item.id === values.chapterId);
        if (course && chapter && !chapter.items.some((item) => item.quizId === resultId)) {
          const courseCopy = structuredClone(course);
          const chapterCopy = courseCopy.chapters.find((item) => item.id === values.chapterId);
          chapterCopy.items.push({ id: previousItem?.id ?? createId('item'), type: 'quiz', title: quiz.title, quizId: resultId });
          next.courses = next.courses.map((item) => item.id === courseCopy.id ? courseCopy : item);
        }
      }
      return next;
    });
    return resultId;
  }, [update]);

  const removeQuiz = useCallback((quizId) => update((next) => {
    next.quizzes = next.quizzes.filter((quiz) => quiz.id !== quizId);
    next.courses = next.courses.map((course) => ({ ...course, chapters: course.chapters.map((chapter) => ({ ...chapter, items: chapter.items.filter((item) => item.quizId !== quizId) })) }));
    return next;
  }), [update]);

  const enrollFree = useCallback((courseId, userId = currentUser?.id, referralCode = null) => update((next) => {
    const course = next.courses.find((entry) => entry.id === courseId);
    if (!userId || !course || course.price > 0 || next.enrollments.some((entry) => entry.courseId === courseId && entry.userId === userId)) return next;
    const link = (next.referralLinks ?? []).find((item) => item.code.toLowerCase() === String(referralCode ?? '').toLowerCase() && item.courseId === course.id && item.instructorId === course.instructorId);
    next.enrollments.push({ id: createId('enroll'), courseId, userId, createdAt: new Date().toISOString(), ...(link ? { referralCode: link.code, referralLinkId: link.id, referralInstructorId: link.instructorId } : {}) });
    return next;
  }), [currentUser?.id, update]);

  const addCourseToCart = useCallback((courseId, referralCode = null) => {
    const course = data.courses.find((item) => item.id === courseId && item.status === 'published');
    if (!currentUser || !['learner', 'admin'].includes(currentUser.role)) return { ok: false, message: 'เข้าสู่ระบบในฐานะผู้เรียนก่อนเพิ่มคอร์ส' };
    if (!course || course.price <= 0) return { ok: false, message: 'คอร์สนี้ไม่ต้องใช้ตะกร้า' };
    if (data.enrollments.some((item) => item.courseId === courseId && item.userId === currentUser.id) || data.orders.some((item) => item.courseId === courseId && item.userId === currentUser.id && item.status === 'paid')) return { ok: false, message: 'คุณมีคอร์สนี้อยู่แล้ว' };
    if (data.cartItems.some((item) => item.courseId === courseId && item.userId === currentUser.id)) return { ok: true, alreadyAdded: true };
    const referral = data.referralLinks.find((item) => item.code.toLowerCase() === String(referralCode ?? '').toLowerCase() && item.courseId === course.id && item.instructorId === course.instructorId);
    update((next) => { next.cartItems.push({ id: createId('cart'), courseId, userId: currentUser.id, createdAt: new Date().toISOString(), priceAlertEnabled: false, ...(referral ? { referralCode: referral.code } : {}) }); return next; });
    return { ok: true };
  }, [currentUser, data.courses, data.enrollments, data.orders, data.cartItems, data.referralLinks, update]);

  const removeCourseFromCart = useCallback((cartItemId) => {
    if (!currentUser || !data.cartItems.some((entry) => entry.id === cartItemId && entry.userId === currentUser.id)) return false;
    update((next) => {
      next.cartItems = next.cartItems.filter((entry) => entry.id !== cartItemId);
      return next;
    });
    return true;
  }, [currentUser, data.cartItems, update]);

  const setCoursePriceAlert = useCallback((courseId, enabled) => {
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

  const simulatePayment = useCallback((courseId, outcome, referralCode = null) => {
    const orderId = createId('order');
    update((next) => {
      const course = next.courses.find((item) => item.id === courseId);
      if (!course || course.price <= 0 || !currentUser) return next;
      const instructor = next.users.find((user) => user.id === course.instructorId);
      const link = (next.referralLinks ?? []).find((item) => item.code.toLowerCase() === String(referralCode ?? '').toLowerCase() && item.courseId === course.id && item.instructorId === course.instructorId);
      const sharePercent = Number(link ? instructor?.referralSharePercent ?? 85 : instructor?.baseSharePercent ?? 70);
      const amount = Number(course.price);
      const instructorShareAmount = Math.round((amount * sharePercent + Number.EPSILON) * 100) / 100;
      const order = { id: orderId, courseId, userId: currentUser.id, amount, status: outcome, method: 'บัตรจำลอง', createdAt: new Date().toISOString(), instructorId: course.instructorId, ...(outcome === 'paid' ? { instructorSharePercent: sharePercent, instructorShareAmount, platformShareAmount: Math.round((amount - instructorShareAmount + Number.EPSILON) * 100) / 100, payoutStatus: 'pending' } : {}), ...(link ? { referralCode: link.code, referralLinkId: link.id } : {}) };
      next.orders.unshift(order);
      if (outcome === 'paid') {
        next.cartItems = (next.cartItems ?? []).filter((entry) => entry.courseId !== courseId || entry.userId !== currentUser.id);
        if (!next.enrollments.some((entry) => entry.courseId === courseId && entry.userId === currentUser.id)) next.enrollments.push({ id: createId('enroll'), courseId, userId: currentUser.id, createdAt: new Date().toISOString(), ...(link ? { referralCode: link.code, referralLinkId: link.id, referralInstructorId: link.instructorId } : {}) });
      }
      return next;
    });
    return orderId;
  }, [currentUser, update]);

  const createReferralLink = useCallback((courseId) => {
    const course = data.courses.find((item) => item.id === courseId);
    if (currentUser?.role !== 'instructor' || !course || course.instructorId !== currentUser.id || course.status !== 'published') return { ok: false, message: 'สร้างลิงก์ได้เฉพาะคอร์สที่เผยแพร่ของคุณ' };
    const link = { id: createId('ref'), code: createId('code').replace(/^code-/, '').toUpperCase(), instructorId: currentUser.id, courseId, createdAt: new Date().toISOString() };
    update((next) => { next.referralLinks ??= []; next.referralLinks.unshift(link); return next; });
    return { ok: true, link };
  }, [currentUser, data.courses, update]);

  const saveInstructorCommission = useCallback((userId, baseSharePercent, referralSharePercent) => {
    if (currentUser?.role !== 'admin') return { ok: false, message: 'เฉพาะแอดมินเท่านั้นที่กำหนดสัดส่วนได้' };
    const base = Number(baseSharePercent);
    const referral = Number(referralSharePercent);
    const instructor = data.users.find((user) => user.id === userId && user.role === 'instructor');
    if (!instructor) return { ok: false, message: 'ไม่พบผู้สอน' };
    if (!Number.isFinite(base) || !Number.isFinite(referral) || base < 0 || base > 100 || referral <= base || referral > 100) return { ok: false, message: 'สัดส่วนลิงก์แนะนำต้องสูงกว่าสัดส่วนปกติ และทั้งคู่ต้องไม่เกิน 100%' };
    update((next) => { next.users = next.users.map((user) => user.id === userId ? { ...user, baseSharePercent: base, referralSharePercent: referral } : user); return next; });
    return { ok: true };
  }, [currentUser, data.users, update]);

  const markInstructorPayout = useCallback((instructorId) => {
    if (currentUser?.role !== 'admin') return { ok: false, message: 'เฉพาะแอดมินเท่านั้นที่ยืนยันยอดโอนได้' };
    const eligible = data.orders.filter((order) => {
      const course = data.courses.find((item) => item.id === order.courseId);
      return order.status === 'paid' && order.payoutStatus !== 'transferred' && (order.instructorId ?? course?.instructorId) === instructorId;
    });
    if (!eligible.length) return { ok: false, message: 'ไม่มียอดรอโอนสำหรับผู้สอนคนนี้' };
    const teacher = data.users.find((user) => user.id === instructorId);
    const amount = Math.round(eligible.reduce((sum, order) => {
      const course = data.courses.find((item) => item.id === order.courseId);
      const rate = Number(order.instructorSharePercent ?? (order.referralLinkId ? teacher?.referralSharePercent : teacher?.baseSharePercent) ?? 70);
      return sum + Number(order.instructorShareAmount ?? (Number(order.amount) * rate / 100));
    }, 0) * 100) / 100;
    const payout = { id: createId('payout'), instructorId, orderIds: eligible.map((order) => order.id), amount, orderCount: eligible.length, createdAt: new Date().toISOString() };
    const orderIds = new Set(payout.orderIds);
    update((next) => {
      next.orders = next.orders.map((order) => orderIds.has(order.id) ? { ...order, payoutStatus: 'transferred', payoutId: payout.id, paidOutAt: payout.createdAt } : order);
      next.instructorPayouts ??= [];
      next.instructorPayouts.unshift(payout);
      return next;
    });
    return { ok: true, payout };
  }, [currentUser, data.courses, data.orders, data.users, update]);

  const markContentDone = useCallback((courseId, itemId) => update((next) => {
    const key = `${courseId}:${itemId}`;
    next.progress[key] = { ...(next.progress[key] ?? {}), [currentUser.id]: true };
    return awardCertificate(next, courseId, currentUser.id);
  }), [currentUser?.id, update]);

  const startAttempt = useCallback((quiz) => {
    const attemptId = createId('attempt');
    update((next) => {
      next.attempts.unshift({ id: attemptId, quizId: quiz.id, courseId: quiz.courseId, userId: currentUser.id, answers: {}, status: 'in_progress', submittedAt: null });
      return next;
    });
    return attemptId;
  }, [currentUser?.id, update]);

  const saveAttemptDraft = useCallback((attemptId, answers) => update((next) => {
    next.attempts = next.attempts.map((attempt) => attempt.id === attemptId && attempt.status === 'in_progress' ? { ...attempt, answers } : attempt);
    return next;
  }), [update]);

  const submitAttempt = useCallback((quiz, answers, existingAttemptId) => {
    let attemptId = existingAttemptId;
    update((next) => {
      const choiceQuestions = quiz.questions.filter((question) => question.type === 'choice');
      const essayQuestions = quiz.questions.filter((question) => question.type === 'essay');
      const maxChoice = choiceQuestions.reduce((sum, question) => sum + Number(question.points || 1), 0);
      const score = choiceQuestions.reduce((sum, question) => sum + (Number(answers[question.id]) === Number(question.answer) ? Number(question.points || 1) : 0), 0);
      const percent = maxChoice ? Math.round(score / maxChoice * 100) : 0;
      const passed = essayQuestions.length ? null : percent >= Number(quiz.passPercent || 60);
      const attempt = { ...(next.attempts.find((entry) => entry.id === existingAttemptId) ?? {}), id: existingAttemptId ?? createId('attempt'), quizId: quiz.id, courseId: quiz.courseId, userId: currentUser.id, answers, score, maxChoice, percent, essayStatus: essayQuestions.length ? 'pending' : 'none', passed, status: 'submitted', submittedAt: new Date().toISOString() };
      attemptId = attempt.id;
      if (existingAttemptId) next.attempts = next.attempts.map((entry) => entry.id === existingAttemptId ? attempt : entry);
      else next.attempts.unshift(attempt);
      if (passed) {
        const course = next.courses.find((entry) => entry.id === quiz.courseId);
        const item = flattenItems(course).find((entry) => entry.quizId === quiz.id);
        if (item) next.progress[`${quiz.courseId}:${item.id}`] = { ...(next.progress[`${quiz.courseId}:${item.id}`] ?? {}), [currentUser.id]: true };
      }
      return passed ? awardCertificate(next, quiz.courseId, currentUser.id) : next;
    });
    return attemptId;
  }, [currentUser?.id, update]);

  const gradeAttempt = useCallback((attemptId, { score, feedback }) => update((next) => {
    const attempt = next.attempts.find((item) => item.id === attemptId);
    const quiz = next.quizzes.find((item) => item.id === attempt?.quizId);
    if (!attempt || !quiz) return next;
    const essayMax = quiz.questions.filter((question) => question.type === 'essay').reduce((sum, question) => sum + Number(question.points || 1), 0);
    const max = attempt.maxChoice + essayMax;
    const total = attempt.score + Number(score || 0);
    const passed = max > 0 && total / max * 100 >= Number(quiz.passPercent || 60);
    next.attempts = next.attempts.map((item) => item.id === attemptId ? { ...item, essayStatus: 'graded', essayScore: Number(score || 0), essayFeedback: feedback, totalScore: total, maxScore: max, finalPercent: Math.round(total / max * 100), passed, gradedAt: new Date().toISOString() } : item);
    if (passed) {
      const course = next.courses.find((entry) => entry.id === quiz.courseId);
      const quizItem = flattenItems(course).find((entry) => entry.quizId === quiz.id);
      if (quizItem) next.progress[`${quiz.courseId}:${quizItem.id}`] = { ...(next.progress[`${quiz.courseId}:${quizItem.id}`] ?? {}), [attempt.userId]: true };
      return awardCertificate(next, quiz.courseId, attempt.userId);
    }
    return next;
  }), [update]);

  const requestInstructor = useCallback((values) => update((next) => {
    next.instructorRequests.unshift({ id: createId('req'), userId: currentUser?.id, userName: currentUser?.name ?? values.name, email: currentUser?.email ?? values.email, intro: values.intro, status: 'pending', createdAt: new Date().toISOString() });
    return next;
  }), [currentUser, update]);

  const reviewInstructorRequest = useCallback((requestId, decision, note = '') => update((next) => {
    const request = next.instructorRequests.find((item) => item.id === requestId);
    if (!request) return next;
    next.instructorRequests = next.instructorRequests.map((item) => item.id === requestId ? { ...item, status: decision, reviewNote: note } : item);
    if (decision === 'approved') {
      const existing = next.users.find((item) => item.id === request.userId || item.email === request.email);
      if (existing) next.users = next.users.map((item) => item.id === existing.id ? { ...item, role: 'instructor', status: 'active' } : item);
      else next.users.push({ id: createId('u'), name: request.userName, email: request.email, password: 'Teach123!', role: 'instructor', bio: request.intro, status: 'active' });
    }
    return next;
  }), [update]);

  const createInstructorInvite = useCallback(({ name, email }) => {
    const token = createId('invite');
    update((next) => {
      const user = next.users.find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
      if (user) {
        next.invitations.unshift({ id: createId('inv'), token, userId: user.id, name: user.name, email: user.email, status: 'pending', createdAt: new Date().toISOString() });
      } else {
        const newUser = { id: createId('u'), name: name.trim(), email: email.trim(), password: '', role: 'instructor', bio: '', status: 'invited' };
        next.users.push(newUser);
        next.invitations.unshift({ id: createId('inv'), token, userId: newUser.id, name: newUser.name, email: newUser.email, status: 'pending', createdAt: new Date().toISOString() });
      }
      return next;
    });
    return token;
  }, [update]);

  const acceptInstructorInvite = useCallback((token, password) => {
    let result = { ok: false, message: 'ไม่พบคำเชิญนี้' };
    update((next) => {
      const invite = next.invitations.find((item) => item.token === token && item.status === 'pending');
      if (!invite) return next;
      next.invitations = next.invitations.map((item) => item.id === invite.id ? { ...item, status: 'accepted' } : item);
      next.users = next.users.map((item) => item.id === invite.userId ? { ...item, role: 'instructor', status: 'active', password } : item);
      next.currentUserId = invite.userId;
      result = { ok: true, user: next.users.find((item) => item.id === invite.userId) };
      return next;
    });
    return result;
  }, [update]);

  const changeUserRole = useCallback((userId, role) => update((next) => {
    next.users = next.users.map((item) => item.id === userId ? { ...item, role } : item);
    return next;
  }), [update]);

  const updateProfile = useCallback((values) => {
    if (!currentUser) return { ok: false, message: 'ไม่พบบัญชีผู้ใช้' };
    const validation = validateProfile(values, data.users, currentUser.id);
    if (validation) return { ok: false, message: validation };
    const editable = { name: values.name.trim(), username: values.username?.trim(), firstName: values.firstName?.trim(), lastName: values.lastName?.trim(), firstNameEnglish: values.firstNameEnglish?.trim(), lastNameEnglish: values.lastNameEnglish?.trim(), certificateName: values.certificateName?.trim(), birthDate: values.birthDate?.trim(), phone: values.phone?.trim(), school: values.school?.trim(), educationLevel: values.educationLevel, interests: values.interests ?? [], learningGoals: values.learningGoals ?? [], googleLinkedEmail: values.googleLinkedEmail, bio: values.bio, avatar: values.avatar };
    update((next) => { next.users = next.users.map((item) => item.id === currentUser.id ? { ...item, ...editable } : item); return next; });
    return { ok: true };
  }, [currentUser, data.users, update]);

  const resetPassword = useCallback((email, password) => {
    const user = data.users.find((item) => item.email.toLowerCase() === email?.trim().toLowerCase());
    if (!user) return { ok: false, message: 'ไม่พบอีเมลนี้ในข้อมูลตัวอย่าง' };
    update((next) => {
      next.users = next.users.map((item) => item.id === user.id ? { ...item, password } : item);
      return next;
    });
    return { ok: true };
  }, [data.users, update]);

  const value = useMemo(() => ({
    data, currentUser, signIn, signInDemo, signOut, register, resetDemo, saveBlogPost, removeBlogPost, saveCourse, removeCourse,
    saveChapter, saveChapterWorkspace, reorderCurriculum, removeChapter, saveItem, removeItem, saveQuiz, removeQuiz, enrollFree, simulatePayment,
    addCourseToCart, removeCourseFromCart, setCoursePriceAlert,
    createReferralLink, saveInstructorCommission, markInstructorPayout,
    markContentDone, startAttempt, saveAttemptDraft, submitAttempt, gradeAttempt, requestInstructor, reviewInstructorRequest,
    createInstructorInvite, acceptInstructorInvite,
    changeUserRole, updateProfile, resetPassword,
  }), [data, currentUser, signIn, signInDemo, signOut, register, resetDemo, saveBlogPost, removeBlogPost, saveCourse, removeCourse, saveChapter, saveChapterWorkspace, reorderCurriculum, removeChapter, saveItem, removeItem, saveQuiz, removeQuiz, enrollFree, simulatePayment, addCourseToCart, removeCourseFromCart, setCoursePriceAlert, createReferralLink, saveInstructorCommission, markInstructorPayout, markContentDone, startAttempt, saveAttemptDraft, submitAttempt, gradeAttempt, requestInstructor, reviewInstructorRequest, createInstructorInvite, acceptInstructorInvite, changeUserRole, updateProfile, resetPassword]);

  return <LmsContext.Provider value={value}>{children}</LmsContext.Provider>;
}

export const useLms = () => {
  const value = useContext(LmsContext);
  if (!value) throw new Error('useLms must be used within LmsProvider');
  return value;
};
