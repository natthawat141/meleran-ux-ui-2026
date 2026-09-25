import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createId, DEMO_ACCOUNTS, flattenItems, initialData, seedCourseCoverReplacements } from './data.js';
import defaultCourseCover from './assets/generated/course-default-v2.png';

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
      return { ...initialData, ...parsed, courses, blogPosts: Array.isArray(parsed.blogPosts) ? parsed.blogPosts : structuredClone(initialData.blogPosts) };
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

  const enrollFree = useCallback((courseId, userId = currentUser?.id) => update((next) => {
    if (!userId || next.enrollments.some((entry) => entry.courseId === courseId && entry.userId === userId)) return next;
    next.enrollments.push({ id: createId('enroll'), courseId, userId, createdAt: new Date().toISOString() });
    return next;
  }), [currentUser?.id, update]);

  const simulatePayment = useCallback((courseId, outcome) => {
    const orderId = createId('order');
    update((next) => {
      const course = next.courses.find((item) => item.id === courseId);
      if (!course || !currentUser) return next;
      const order = { id: orderId, courseId, userId: currentUser.id, amount: Number(course.price), status: outcome, method: 'บัตรจำลอง', createdAt: new Date().toISOString() };
      next.orders.unshift(order);
      if (outcome === 'paid' && !next.enrollments.some((entry) => entry.courseId === courseId && entry.userId === currentUser.id)) next.enrollments.push({ id: createId('enroll'), courseId, userId: currentUser.id, createdAt: new Date().toISOString() });
      return next;
    });
    return orderId;
  }, [currentUser, update]);

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

  const updateProfile = useCallback((values) => update((next) => {
    next.users = next.users.map((item) => item.id === currentUser?.id ? { ...item, ...values } : item);
    return next;
  }), [currentUser?.id, update]);

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
    saveChapter, saveChapterWorkspace, removeChapter, saveItem, removeItem, saveQuiz, removeQuiz, enrollFree, simulatePayment,
    markContentDone, startAttempt, saveAttemptDraft, submitAttempt, gradeAttempt, requestInstructor, reviewInstructorRequest,
    createInstructorInvite, acceptInstructorInvite,
    changeUserRole, updateProfile, resetPassword,
  }), [data, currentUser, signIn, signInDemo, signOut, register, resetDemo, saveBlogPost, removeBlogPost, saveCourse, removeCourse, saveChapter, saveChapterWorkspace, removeChapter, saveItem, removeItem, saveQuiz, removeQuiz, enrollFree, simulatePayment, markContentDone, startAttempt, saveAttemptDraft, submitAttempt, gradeAttempt, requestInstructor, reviewInstructorRequest, createInstructorInvite, acceptInstructorInvite, changeUserRole, updateProfile, resetPassword]);

  return <LmsContext.Provider value={value}>{children}</LmsContext.Provider>;
}

export const useLms = () => {
  const value = useContext(LmsContext);
  if (!value) throw new Error('useLms must be used within LmsProvider');
  return value;
};
